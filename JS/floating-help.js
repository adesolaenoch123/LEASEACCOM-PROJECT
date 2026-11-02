/**
 * LeaseAccom floating help button and assistant bootstrap.
 */
(function () {
  "use strict";
  if (window.leaseaccomHelpInitialized) return;
  window.leaseaccomHelpInitialized = true;
  var scriptBase = document.currentScript
    ? new URL(".", document.currentScript.src)
    : new URL("JS/", document.baseURI);

  function loadAssistantGuide() {
    if (window.LeaseAccomAssistantGuide || document.querySelector('script[data-assistant-guide]')) return;
    var script = document.createElement("script");
    script.src = new URL("assistant-guide.js", scriptBase).href;
    script.dataset.assistantGuide = "true";
    script.defer = true;
    document.body.appendChild(script);
  }

  function installButton() {
    if (!document.getElementById("laFloatingHelpStyles")) {
      var style = document.createElement("style");
      style.id = "laFloatingHelpStyles";
      style.textContent =
        ".assistant-launcher{position:fixed;right:24px;bottom:24px;z-index:1100;width:56px;height:56px;border:0;border-radius:50%;background:#0d7547;color:#fff;font-size:25px;cursor:pointer;box-shadow:0 12px 30px rgba(13,117,71,.3)}" +
        "@media(max-width:820px){.assistant-launcher{right:16px;bottom:calc(76px + env(safe-area-inset-bottom,0px))}}";
      document.head.appendChild(style);
    }

    var panel = document.getElementById("assistantPanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.className = "assistant-panel";
      panel.id = "assistantPanel";
      panel.setAttribute("aria-label", "LeaseAccom Assistant");
      panel.setAttribute("aria-hidden", "true");
      panel.innerHTML =
        '<div class="assistant-header"><div><strong>LeaseAccom Assistant</strong><span>Here to help you find a place</span></div>' +
        '<button class="assistant-close" id="assistantClose" type="button" aria-label="Close assistant">×</button></div>' +
        '<div class="assistant-messages" id="assistantMessages" aria-live="polite"><div class="assistant-message assistant-message-ai">Tell me what you need, such as “a 2-bedroom apartment in Lagos under ₦3m”.</div></div>' +
        '<div class="assistant-suggestions"><button type="button" data-assistant-prompt="Show me apartments in Lagos">Apartments in Lagos</button><button type="button" data-assistant-prompt="Show me homes under ₦5m">Homes under ₦5m</button></div>' +
        '<form class="assistant-form" id="assistantForm"><input id="assistantInput" type="text" placeholder="Ask me anything..." autocomplete="off" aria-label="Ask LeaseAccom Assistant">' +
        '<button type="submit" class="assistant-send-btn" aria-label="Send message"><i class="bx bx-right-arrow-alt" aria-hidden="true"></i></button></form>';
      document.body.appendChild(panel);
    }

    var button = document.getElementById("assistantLauncher") || document.getElementById("laFloatingHelp");
    if (!button) {
      button = document.createElement("button");
      button.id = "laFloatingHelp";
      button.type = "button";
      button.className = "assistant-launcher";
      button.innerHTML = '<i class="bx bx-message-dots" aria-hidden="true"></i>';
      button.setAttribute("aria-label", "Open LeaseAccom Assistant");
      button.setAttribute("aria-expanded", "false");
      document.body.appendChild(button);
    }

    if (button.dataset.leaseaccomAppLauncher !== "true") {
      button.addEventListener("click", function () {
        var assistant = document.getElementById("assistantPanel");
        if (!assistant) return;
        var open = !assistant.classList.contains("is-open");
        assistant.classList.toggle("is-open", open);
        assistant.setAttribute("aria-hidden", open ? "false" : "true");
        button.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) {
          var input = document.getElementById("assistantInput");
          if (input) window.setTimeout(function () { input.focus(); }, 150);
        }
      });
    }

    document.getElementById("assistantClose")?.addEventListener("click", function () {
      var assistant = document.getElementById("assistantPanel");
      assistant?.classList.remove("is-open");
      assistant?.setAttribute("aria-hidden", "true");
      button.setAttribute("aria-expanded", "false");
    });

    loadAssistantGuide();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installButton, { once: true });
  } else {
    installButton();
  }
})();
