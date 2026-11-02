(function () {
  "use strict";

  var installPrompt = null;
  var installButton = document.getElementById("installAppBtn");
  if (!installButton) return;

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener("click", async function () {
    if (!installPrompt) return;
    installButton.disabled = true;
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      installButton.hidden = true;
    } catch (error) {
      console.error("LeaseAccom install prompt could not be completed.", error);
    } finally {
      installButton.disabled = false;
    }
  });

  window.addEventListener("appinstalled", function () {
    installPrompt = null;
    installButton.hidden = true;
  });
})();
