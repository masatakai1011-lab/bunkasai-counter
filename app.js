// Shared by the register page and the hand-over page.
// Both iPads read and write one record per day in Firebase Realtime Database:
//   crepe/<YYYY-MM-DD>/ordered/{choco,anko}  orders taken at the register
//   crepe/<YYYY-MM-DD>/handed/{choco,anko}   crepes handed over at the pick-up window
// Waiting to be picked up = ordered − handed.
(function () {
  var ITEMS = ["choco", "anko"];
  var NAMES = { choco: "チョコ", anko: "あんこ" };

  function $(id) { return document.getElementById(id); }
  function num(v) { v = parseInt(v, 10); return v > 0 ? v : 0; }

  function dayKey(d) {
    d = d || new Date();
    function two(n) { return (n < 10 ? "0" : "") + n; }
    return d.getFullYear() + "-" + two(d.getMonth() + 1) + "-" + two(d.getDate());
  }

  function readState(v) {
    v = v || {};
    var s = { ordered: {}, handed: {}, waiting: {} };
    ITEMS.forEach(function (k) {
      s.ordered[k] = num(v.ordered && v.ordered[k]);
      s.handed[k] = Math.min(num(v.handed && v.handed[k]), s.ordered[k]);
      s.waiting[k] = s.ordered[k] - s.handed[k];
    });
    s.ordered.total = s.ordered.choco + s.ordered.anko;
    s.handed.total = s.handed.choco + s.handed.anko;
    s.waiting.total = s.waiting.choco + s.waiting.anko;
    return s;
  }

  // ---- Data: Firebase ----
  var db = null, dayRef = null, listener = null, currentDay = null, onStateCb = null;

  function showSetup(message) {
    document.querySelector(".app").innerHTML =
      '<div class="setup"><h1>準備がまだです</h1><p>' + message + "</p></div>";
  }

  function subscribe() {
    var day = dayKey();
    if (day === currentDay) return;
    if (dayRef && listener) dayRef.off("value", listener);
    currentDay = day;
    dayRef = db.ref("crepe/" + day);
    listener = dayRef.on("value", function (snap) {
      onStateCb(readState(snap.val()));
    }, function () {
      showSetup("Firebaseのデータを読めませんでした。Realtime Database の「ルール」が README のとおりになっているか確かめてください。");
    });
  }

  // change(kind, item, delta): kind is "ordered" or "handed".
  // Runs as a transaction so two iPads tapping at once never lose a count.
  // Never lets handed go above ordered, and nothing goes below 0.
  function change(kind, item, delta) {
    if (!dayRef) return;
    dayRef.transaction(function (cur) {
      var s = readState(cur);
      var next = s[kind][item] + delta;
      if (next < 0) return; // abort
      if (kind === "ordered" && next < s.handed[item]) return; // already handed over, cannot un-order
      if (kind === "handed" && next > s.ordered[item]) return; // nothing waiting
      cur = cur || {};
      cur.ordered = { choco: s.ordered.choco, anko: s.ordered.anko };
      cur.handed = { choco: s.handed.choco, anko: s.handed.anko };
      cur[kind][item] = next;
      return cur;
    });
  }

  function resetToday() { if (dayRef) dayRef.set(null); }

  function start(onState, onConnection) {
    onStateCb = onState;
    var cfg = window.FIREBASE_CONFIG;
    if (!window.firebase) {
      showSetup("Firebaseの部品を読み込めませんでした。ネットにつながっているか確かめて、開き直してください。");
      return;
    }
    if (!cfg || !cfg.databaseURL) {
      showSetup("Firebase の設定が入っていません。README の「Firebaseの準備」をして、<code>firebase-config.js</code> に設定を書いてください。");
      return;
    }
    firebase.initializeApp(cfg);
    db = firebase.database();
    db.ref(".info/connected").on("value", function (snap) { onConnection(snap.val() === true); });
    subscribe();
    // A new day starts a new record (checked every minute, so a page left open overnight rolls over)
    setInterval(subscribe, 60 * 1000);
  }

  // ---- Ticket numbers ----
  // The n-th order of a flavor today gets ticket No.(TICKET_START + n − 1): 201, 202, ...
  // Both flavors start from the same number; the ticket color tells them apart.
  var TICKET_START = 201;
  function ticketNo(n) { return TICKET_START + n - 1; }

  // ---- Shared behaviour ----
  // Toggle between two class names with identical keyframes so the animation replays on every change
  function replay(el, a, b) {
    var next = el.classList.contains(a) ? b : a;
    el.classList.remove(a, b);
    el.classList.add(next);
  }

  function renderConnection(online) {
    var el = $("conn");
    el.classList.toggle("off", !online);
    el.textContent = online ? "つながっています" : "ネットが切れています（つながると反映されます）";
  }

  // Reset needs a second tap within 3 seconds, since confirm() is not available in Home Screen apps
  function twoTapButton(btn, armedText, action) {
    var label = btn.textContent, timer = null;
    function disarm() { clearTimeout(timer); timer = null; btn.classList.remove("armed"); btn.textContent = label; }
    btn.addEventListener("click", function () {
      if (timer) { disarm(); action(); }
      else { btn.classList.add("armed"); btn.textContent = armedText; timer = setTimeout(disarm, 3000); }
    });
  }

  function common() {
    // iOS Safari only shows :active press feedback when a touch listener exists
    document.addEventListener("touchstart", function () {}, { passive: true });
    // Keep the iPad screen awake while the page is open, if allowed
    function keepAwake() {
      if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
      navigator.wakeLock.request("screen").catch(function () {});
    }
    document.addEventListener("visibilitychange", keepAwake);
    keepAwake();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  window.Crepe = {
    ITEMS: ITEMS, NAMES: NAMES, $: $, start: start, change: change, resetToday: resetToday,
    ticketNo: ticketNo, replay: replay, renderConnection: renderConnection, twoTapButton: twoTapButton, common: common
  };
})();
