(function () {
  "use strict";

  var installPrompt = null;
  var installButton = document.getElementById("installAppBtn");
  if (!installButton) return;

  var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var isAndroid = /android/i.test(navigator.userAgent);
  var isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  if (isStandalone) {
    installButton.hidden = true;
    return;
  }
  if (isIos || isAndroid) {
    installButton.hidden = false;
    installButton.textContent = isIos ? "Add to Home Screen" : "Install app";
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener("click", async function () {
    if (!installPrompt) {
      window.alert(isIos
        ? "In Safari, tap Share, then choose Add to Home Screen."
        : "Open your browser menu and choose Install app or Add to Home screen.");
      return;
    }
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
