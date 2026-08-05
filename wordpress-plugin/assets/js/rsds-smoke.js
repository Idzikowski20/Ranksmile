/**
 * RSDS JS smoke — load after ranksmile-general in debug if needed.
 * Expect: window.ranksmile object with .version; window.wpsurfer undefined.
 */
(function () {
  if (typeof window.ranksmile !== 'object' || window.ranksmile === null) {
    console.error('[rsds-smoke] window.ranksmile missing');
    return;
  }
  if (typeof window.wpsurfer !== 'undefined') {
    console.error('[rsds-smoke] window.wpsurfer still defined');
    return;
  }
  if (!window.ranksmile.version) {
    console.warn('[rsds-smoke] window.ranksmile.version missing');
  }
  console.info('[rsds-smoke] ok', window.ranksmile.version);
})();
