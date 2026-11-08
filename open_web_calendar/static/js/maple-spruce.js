/*
 * Maple & Spruce: let the embedding page size the calendar iframe.
 *
 * The agenda is a long list. In a fixed-height iframe it scrolls inside the
 * page, which itself scrolls: two scrollbars on a phone. In agenda view this
 * reports the content's full height to the parent page, which grows the
 * iframe to fit, so only the page scrolls. Other views report null and the
 * parent keeps its default height (month and week fit a fixed frame).
 *
 * Loaded with ?javascript_url=https://<this host>/js/maple-spruce.js
 * Sends:    { type: "maple-calendar-height", height: number | null }
 * Receives: { type: "maple-calendar-height-applied" } once the parent resized
 */
(function () {
  if (window.parent === window) return; // not embedded

  var lastSent;

  function contentHeight() {
    if (typeof scheduler === "undefined" || !scheduler.getState) return null;
    if (scheduler.getState().mode !== "agenda") return null;
    var nav = document.querySelector(".dhx_cal_navline");
    var data = document.querySelector(".dhx_cal_data");
    if (!nav || !data) return null;
    var header = document.querySelector(".dhx_cal_header");
    var headerHeight = header ? header.offsetHeight : 0;
    // Measure the rows, not data.scrollHeight: once the frame fits, the
    // scroll area is as tall as the frame, and any rounding fed back through
    // the parent shrinks it a pixel per frame.
    var rows = 0;
    for (var i = 0; i < data.children.length; i++) {
      var child = data.children[i];
      rows = Math.max(rows, child.offsetTop + child.offsetHeight);
    }
    return Math.ceil(nav.offsetHeight + headerHeight + rows);
  }

  function report() {
    var height = contentHeight();
    if (height === lastSent) return;
    // Ignore sub-pixel jitter so the frame never chases its own rounding.
    if (typeof height === "number" && typeof lastSent === "number" &&
        Math.abs(height - lastSent) < 2) return;
    lastSent = height;
    window.parent.postMessage(
      { type: "maple-calendar-height", height: height },
      "*"
    );
  }

  var queued = false;
  function queueReport() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      report();
    });
  }

  // The parent answers once it has sized the frame. Only then is it safe to
  // drop the agenda's own scrollbar: a page without the listener keeps it.
  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) return;
    if (!event.data || event.data.type !== "maple-calendar-height-applied") return;
    document.documentElement.classList.add("ms-auto-height");
  });

  function start() {
    if (typeof scheduler === "undefined") return;
    scheduler.attachEvent("onViewChange", queueReport);
    scheduler.attachEvent("onXLE", queueReport);
    var container = document.getElementById("scheduler_here");
    if (container && window.MutationObserver) {
      new MutationObserver(queueReport).observe(container, {
        childList: true,
        subtree: true,
      });
    }
    window.addEventListener("resize", queueReport);
    queueReport();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
