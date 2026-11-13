/* DailyVet — synchronous login guard. Load in <head> of every protected page.
   Hides the page and redirects BEFORE any content renders; re-checks when the
   page is restored from the back/forward cache (Back button). */
(function () {
  'use strict';
  function loggedIn() {
    try {
      return !!(localStorage.getItem('userPhone') || sessionStorage.getItem('userPhone'));
    } catch (e) { return false; }
  }
  function enforce() {
    if (loggedIn()) {
      document.documentElement.style.visibility = '';
      return;
    }
    document.documentElement.style.visibility = 'hidden';
    // replace() keeps this page out of history so Back cannot return to it
    window.location.replace('login.html');
  }
  enforce();
  window.addEventListener('pageshow', function (e) {
    if (e.persisted || !loggedIn()) enforce();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') enforce();
  });
  window.addEventListener('storage', function () { if (!loggedIn()) enforce(); });
})();
