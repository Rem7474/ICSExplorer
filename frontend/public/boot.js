/*
 * Start-up safety net (classic script, runs before the app module).
 * If the app has not rendered after a few seconds — e.g. a JavaScript feature
 * missing on an older Safari, or a failed download — replace the blank page
 * with a readable message, a reload button and the technical details needed
 * to diagnose it. Written in old-style JS on purpose so it runs everywhere.
 */
(function () {
  var errors = [];
  var BOOT_TIMEOUT_MS = 6000;

  function record(message) {
    if (message && errors.length < 5) errors.push(String(message));
  }

  window.addEventListener("error", function (e) {
    var where = e.filename ? " (" + e.filename.replace(location.origin, "") + ":" + e.lineno + ")" : "";
    record((e.message || (e.target && e.target.src ? "Échec de chargement : " + e.target.src : "Erreur inconnue")) + where);
  }, true);

  window.addEventListener("unhandledrejection", function (e) {
    record("Promesse rejetée : " + (e.reason && (e.reason.message || e.reason)));
  });

  function appRendered() {
    var root = document.getElementById("app");
    return root && root.children.length > 0;
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function showFallback() {
    if (appRendered()) return;
    var root = document.getElementById("app") || document.body;
    var details = errors.length ? errors.join("\n") : "Aucune erreur JavaScript capturée.";
    root.innerHTML =
      '<div style="font-family:-apple-system,system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:24px;color:#1f2937">' +
      '<h1 style="font-size:1.3rem;margin:0 0 8px">ICSExplorer n\'a pas pu démarrer</h1>' +
      '<p style="margin:0 0 16px;color:#4b5563">Rechargez la page. Si le problème persiste, mettez à jour votre navigateur ou votre système.</p>' +
      '<button id="boot-reload" style="font:inherit;padding:10px 18px;border:0;border-radius:10px;background:#1e3a8a;color:#fff">Recharger</button>' +
      '<details style="margin-top:20px;font-size:0.8rem;color:#6b7280"><summary>Détails techniques</summary>' +
      '<pre style="white-space:pre-wrap;word-break:break-word">' + escapeHtml(details + "\n\n" + navigator.userAgent) + "</pre></details></div>";
    var button = document.getElementById("boot-reload");
    if (button) button.addEventListener("click", function () { location.reload(); });
  }

  setTimeout(showFallback, BOOT_TIMEOUT_MS);
})();
