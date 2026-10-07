// Service worker registration (extracted from an inline next/script block
// so the hash-based CSP for prerendered pages doesn't need to allow
// runtime-injected inline scripts).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
