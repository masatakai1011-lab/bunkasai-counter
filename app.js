// Shared by the register page and the hand-over page.
// Both iPads read and write one record per day in Firebase Realtime Database:
//   crepe/<YYYY-MM-DD>/ordered/{choco,anko}  orders taken at the register
//   crepe/<YYYY-MM-DD>/handed/{choco,anko}   crepes handed over at the pick-up window
// Waiting to be picked up = ordered − handed.
(function () {
  var ITEMS = ["choco", "anko"];
  var NAMES = { choco: "チョコ", anko: "あんこ" };
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  // ---- Shared look & feel ----
  function animate(el, frames, opts) {
    if (reduceMotion || !el.animate) return null;
    return el.animate(frames, opts);
  }

  // Stroke order of 正 in a 100×100 box: top bar, center post, right arm, left post, base
  var STROKES = ["M18 14 H82", "M50 14 V88", "M50 50 H76", "M26 46 V88", "M12 88 H88"];
  var MAX_GROUPS = 12;
  function renderTally(box, n, grew, emptyText) {
    if (n === 0) { box.innerHTML = '<span class="empty">' + emptyText + "</span>"; return; }
    var full = Math.floor(n / 5), rest = n % 5;
    var groups = full + (rest ? 1 : 0);
    var shown = Math.min(groups, MAX_GROUPS);
    var html = groups > MAX_GROUPS ? '<span class="more">…</span>' : "";
    for (var g = groups - shown; g < groups; g++) {
      var size = (g < full) ? 5 : rest, fresh = grew && g === groups - 1 ? size - 1 : -1, paths = "";
      for (var i = 0; i < size; i++) {
        paths += '<path pathLength="100" d="' + STROKES[i] + '"' + (i === fresh ? ' class="fresh"' : "") + "></path>";
      }
      html += '<svg viewBox="0 0 100 100">' + paths + "</svg>";
    }
    box.innerHTML = html;
  }

  function setCount(el, n, dir) {
    if (el.textContent === String(n)) return;
    el.textContent = n;
    el.style.setProperty("--n", String(n).length);
    if (dir) {
      animate(el, [
        { transform: "translateY(" + (dir > 0 ? "-38%" : "38%") + ") scale(.9)", opacity: 0 },
        { transform: "translateY(0) scale(1.06)", opacity: 1, offset: .7 },
        { transform: "translateY(0) scale(1)", opacity: 1 }
      ], { duration: 260, easing: "cubic-bezier(.2,.8,.3,1)" });
    }
  }

  function swayNoren(item) {
    document.querySelectorAll('.stall[data-item="' + item + '"] .flap').forEach(function (f, i) {
      var amp = 7 - i * 1.5;
      animate(f, [
        { transform: "rotate(0deg)" }, { transform: "rotate(" + amp + "deg)" },
        { transform: "rotate(" + (-amp * .55) + "deg)" }, { transform: "rotate(" + (amp * .25) + "deg)" },
        { transform: "rotate(0deg)" }
      ], { duration: 620, delay: i * 40, easing: "ease-out" });
    });
  }

  function floatText(btn, ev, text) {
    if (reduceMotion) return;
    var stall = btn.parentNode, r = stall.getBoundingClientRect();
    // Keyboard activation has no pointer position: rise from the middle instead
    var x = ev.clientX ? ev.clientX - r.left : r.width / 2;
    var y = ev.clientY ? ev.clientY - r.top : r.height / 2;
    var f = document.createElement("span");
    f.className = "float"; f.textContent = text;
    f.style.left = x + "px"; f.style.top = y + "px";
    stall.appendChild(f);
    var a = f.animate([
      { transform: "translate(-50%,-50%) scale(.6)", opacity: 0 },
      { transform: "translate(-50%,-90%) scale(1.1)", opacity: 1, offset: .25 },
      { transform: "translate(-50%,-220%) scale(1)", opacity: 0 }
    ], { duration: 700, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" });
    a.onfinish = function () { f.remove(); };
  }

  function renderConnection(online) {
    var el = $("conn");
    el.classList.toggle("off", !online);
    el.textContent = online ? "つながっています" : "ネットが切れています（つながると反映されます）";
  }

  function openingCurtains() {
    document.querySelectorAll(".flap").forEach(function (f, i) {
      animate(f, [
        { transform: "translateY(-110%)", opacity: 0 },
        { transform: "translateY(4%)", opacity: 1, offset: .7 },
        { transform: "translateY(0)", opacity: 1 }
      ], { duration: 520, delay: 80 + i * 60, easing: "cubic-bezier(.2,.8,.3,1)", fill: "backwards" });
    });
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
    openingCurtains();
  }

  window.Crepe = {
    ITEMS: ITEMS, NAMES: NAMES, $: $, start: start, change: change, resetToday: resetToday,
    animate: animate, renderTally: renderTally, setCount: setCount, swayNoren: swayNoren,
    floatText: floatText, renderConnection: renderConnection, twoTapButton: twoTapButton, common: common
  };
})();
