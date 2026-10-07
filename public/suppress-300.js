// Transient error #300 suppressor for @cloudflare/next-on-pages + React 19.
// The deprecated adapter sometimes produces raw RSC objects during
// client-side navigation that React can't render. This patches console.error
// to downgrade the known transient #300 errors from error to debug level,
// reducing noise while the ProvidersErrorBoundary auto-retries and recovers.
// (Extracted from an inline next/script block for the hash-based CSP.)
(function () {
  var origError = console.error;
  var navStart = Date.now();

  // Track navigation timing
  var origPushState = history.pushState;
  var origReplaceState = history.replaceState;
  history.pushState = function () { navStart = Date.now(); return origPushState.apply(this, arguments); };
  history.replaceState = function () { navStart = Date.now(); return origReplaceState.apply(this, arguments); };

  // Also track popstate (back/forward)
  window.addEventListener('popstate', function () { navStart = Date.now(); });

  console.error = function () {
    var msg = Array.prototype.slice.call(arguments).join(' ');
    var isTransient300 = msg.indexOf('Objects are not valid as a React child') !== -1
      || msg.indexOf('#300') !== -1;
    var isDuringNav = (Date.now() - navStart) < 3000;

    if (isTransient300 && isDuringNav) {
      // Downgrade to debug during navigation — the error boundary handles recovery
      if (console.debug) console.debug('[suppressed transient #300]', msg);
      return;
    }
    return origError.apply(console, arguments);
  };
})();
