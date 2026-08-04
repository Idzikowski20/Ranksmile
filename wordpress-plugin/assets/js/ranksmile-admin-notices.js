/**
 * Ranksmile admin notices guard.
 * WP common.js moves .notice after h1 inside .wrap — foreign banners end up in rs-shell.
 * Root fix: PHP remove_all_actions on Ranksmile screens. This is defense-in-depth:
 * relocate any leftover banners to a host above the Ranksmile dashboard card.
 */
(function () {
  function ensureHost(shell) {
    var parent = shell.parentNode;
    if (!parent) return null;
    var prev = shell.previousElementSibling;
    if (prev && prev.classList && prev.classList.contains('ranksmile-admin-notices-host')) {
      return prev;
    }
    var host = document.createElement('div');
    host.className = 'ranksmile-admin-notices-host';
    host.setAttribute('data-ranksmile-notices', '1');
    parent.insertBefore(host, shell);
    return host;
  }

  function relocate() {
    var shell = document.querySelector('.wrap.ranksmile-admin');
    if (!shell) return 0;
    var host = ensureHost(shell);
    if (!host) return 0;
    var nodes = shell.querySelectorAll(
      '.notice, .e-notice, .updated, .error, .update-nag'
    );
    var moved = 0;
    nodes.forEach(function (el) {
      if (el.closest('.rs-notice-stack') || el.classList.contains('rs-notice')) return;
      host.appendChild(el);
      moved += 1;
    });
    // Also catch notices WP already parked as direct children after h1 but still in shell.
    return moved;
  }

  function run() {
    relocate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  // WP common.js relocates on DOM ready — catch that pass.
  window.setTimeout(run, 0);
  window.setTimeout(run, 250);
})();
