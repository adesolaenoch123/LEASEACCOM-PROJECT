/**
 * LeaseAccom Assistant — expanded guide + floating liquid loader
 * Shows a liquid loader for 3 seconds before every answer.
 */
(function () {
  "use strict";

  var guides = [
    { test: /\b(shortlet|short let|short-let|airbnb|daily|nightly)\b/i, answer: "Shortlets on LeaseAccom:\n1. Go to the Shortlets page or filter by Shortlet.\n2. Check the nightly/daily price and available dates.\n3. Open the listing to see photos and house rules.\n4. Message the owner or request a viewing if needed.\n5. Book according to the owner’s instructions." },
    { test: /\b(commercial|office|shop|warehouse|store)\b/i, answer: "Commercial spaces:\n1. Open the Commercial page.\n2. Filter by location, size, or price.\n3. View details, floor plans (if available), and service charges.\n4. Contact the owner directly through Messages to discuss lease terms." },
    { test: /\b(student|hostel|campus|university)\b/i, answer: "Student housing:\n1. Go to Student Housing.\n2. Look for listings near your campus.\n3. Check if it’s shared or private, and what’s included (power, water, Wi-Fi).\n4. Message the owner or apply if there’s an application option." },
    { test: /\b(hotel|lodge|guest house)\b/i, answer: "Hotels & Lodges:\n1. Open the Hotels & Lodges section.\n2. Compare prices and amenities.\n3. Contact the owner for availability and booking.\n4. Some may allow direct messaging for reservations." },
    { test: /\b(power|light|electricity|generator|inverter)\b/i, answer: "Power information:\nMany listings show power details (PHCN, generator, inverter, solar). Use the filters on the Properties page to find homes with the power setup you need. Always confirm with the owner before paying." },
    { test: /\b(water|borehole|well)\b/i, answer: "Water supply:\nListings can indicate water source (borehole, well, public). Filter by water type when searching. Confirm reliability with the owner during your viewing or chat." },
    { test: /\b(furnish|furniture|equipped)\b/i, answer: "Furnished vs unfurnished:\nUse the Furnished filter when browsing. Furnished listings usually include basic furniture. Always check the photos and ask the owner exactly what is included." },
    { test: /\b(agent|fee|commission|charge)\b/i, answer: "LeaseAccom is built to reduce unnecessary agent fees. Owners list directly. Any service charge or agency fee should be clearly stated on the listing. If something looks unclear, message the owner or report the listing." },
    { test: /\b(service charge|caution|agreement|legal)\b/i, answer: "Service charge, caution fee, and agreements are between you and the owner. LeaseAccom provides the platform to connect you. Always read the listing details and ask for a proper agreement before making large payments." },
    { test: /\b(whatsapp|continue on whatsapp)\b/i, answer: "After starting a chat in the app, some listings show a “Continue on WhatsApp” option. This lets you move the conversation to WhatsApp if both sides prefer it." },
    { test: /\b(response time|replies|how fast)\b/i, answer: "Some owners have a response-time badge (e.g. “Usually replies in a few hours”). This is based on how quickly they reply to messages. It’s a guide, not a guarantee." },
    { test: /\b(quality|meter|score|badge)\b/i, answer: "Listings can show quality indicators and verified badges. Verified means the owner and listing passed LeaseAccom review. A quality meter helps you see how complete the listing is." },
    { test: /\b(report resolved|stamp|outcome)\b/i, answer: "If a listing was reported and the issue was handled, you may see a “Report resolved” stamp. This shows admin has reviewed it." },
    { test: /\b(bottom nav|navigation|menu|home button)\b/i, answer: "On mobile you’ll see a bottom navigation bar: Home, Properties, Messages, and Profile. Use it to move around the app quickly after you log in." },
    { test: /\b(filter|sort|price|bedroom|location)\b/i, answer: "Use filters on the Properties page to narrow results by location, price range, bedrooms, property type, power, water, furnished status, and more. You can also sort by newest or price." },
    { test: /\b(photo|image|video|media|upload)\b/i, answer: "Owners can upload multiple photos (and sometimes video) when adding a property. Good photos help tenants decide faster. Make sure images are clear and show the real space." },
    { test: /\b(pending|approved|rejected|status)\b/i, answer: "Listing status:\n• Pending — waiting for admin review\n• Approved — live on the site\n• Rejected — needs changes (you’ll see the reason)\nOwners can check status in their dashboard." },
    { test: /\b(safety|scam|trust|secure)\b/i, answer: "Stay safe:\n• Prefer verified owners and listings.\n• Never pay outside the agreed process without meeting or proper documentation.\n• Use in-app messaging first.\n• Report anything suspicious.\nLeaseAccom moderates listings and reports." },
    { test: /\b(terms|privacy|legal page)\b/i, answer: "You can read our Terms of Use and Privacy Policy from the footer links on most pages. They explain how the platform works and how your data is handled." },
    { test: /\b(find|search|browse|property|home|house|listing)\b/i, answer: "To find a property:\n1. Go to Properties or use homepage search.\n2. Apply filters (location, type, price, bedrooms…).\n3. Open a listing for full details and photos.\n4. Save, Request Viewing, Apply, or Message the owner." },
    { test: /\b(list|add|upload|create).*(property|listing)|\bhow (do|to) list\b/i, answer: "To list a property:\n1. Register/login as Owner.\n2. Complete verification.\n3. Owner Dashboard → Add Property.\n4. Fill details + upload photos → Submit.\n5. Wait for admin approval." },
    { test: /\b(verif|nin|document|kyc)\b/i, answer: "Owner verification:\nOpen Owner Verification to see the currently available steps and status. Full Nigerian identity-verification checks are paused for now; do not submit sensitive identity documents unless the platform explicitly enables and requests them." },
    { test: /\b(viewing|schedule|visit)\b/i, answer: "Request a viewing:\n1. Open the property.\n2. Tap Request Viewing.\n3. Pick date + time slot.\n4. Submit. Owner responds from their dashboard." },
    { test: /\b(apply|application)\b/i, answer: "Apply for a property:\n1. Open listing → Apply Now.\n2. Complete the form.\n3. Submit.\nTrack progress in your Tenant Dashboard." },
    { test: /\b(message|chat|contact)\b/i, answer: "Message an owner:\n1. Open property → Contact / Message.\n2. Chat continues in the Messages page.\n3. Optional WhatsApp continue on some listings." },
    { test: /\b(dashboard)\b/i, answer: "Dashboards:\n• Tenant: saved homes, viewings, applications, messages.\n• Owner: your listings, requests, applications, verification, add property.\nOpen from the Profile icon or menu after login." },
    { test: /\b(hi|hello|hey|help|what can you)\b/i, answer: "Hi! I can guide you through everything on LeaseAccom — finding homes, listing properties, verification, viewings, applications, messages, shortlets, commercial spaces, student housing, and more. What do you need help with?" }
  ];

  function findAnswer(text) {
    var q = text || "";
    if (/\b(list|add|upload|create)\b.*\b(property|listing)\b|\bhow (do|to) list\b/i.test(q)) {
      return "To list a property:\n1. Register or sign in as an owner.\n2. Open Owner Dashboard → Add Property.\n3. Enter the property details and upload photos.\n4. Submit the listing and check its review status in your dashboard.";
    }
    for (var i = 0; i < guides.length; i++) {
      if (guides[i].test.test(q)) return guides[i].answer;
    }
    return "I can help with most things about using LeaseAccom. Try asking about:\n• Finding or listing a property\n• Shortlets, commercial, or student housing\n• Verification, viewings, or applications\n• Messaging, dashboards, or safety tips";
  }

  function ensurePanel() {
    if (document.getElementById("assistantPanel")) return;
    var panel = document.createElement("section");
    panel.className = "assistant-panel";
    panel.id = "assistantPanel";
    panel.setAttribute("aria-label", "LeaseAccom Assistant");
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = `
      <div class="assistant-header">
        <div><strong>LeaseAccom Assistant</strong><span>Help for every part of LeaseAccom</span></div>
        <button class="assistant-close" id="assistantClose" type="button" aria-label="Close assistant">×</button>
      </div>
      <div class="assistant-messages" id="assistantMessages" aria-live="polite">
        <div class="assistant-message assistant-message-ai">Ask me how to find a property, list a property, manage viewings, applications, or messages.</div>
      </div>
      <form class="assistant-form" id="assistantForm">
        <input id="assistantInput" type="text" placeholder="Ask me anything..." autocomplete="off" aria-label="Ask LeaseAccom Assistant">
        <button type="submit" aria-label="Send message">→</button>
      </form>
    `;
    document.body.appendChild(panel);
  }

  function isPropertySearch(text) {
    var query = String(text || "");
    if (window.LeaseAccomAssistantHasPendingSearch?.()) return true;
    if (/\b(how|steps|explain|guide|instructions|teach)\b/i.test(query)) return false;
    var propertyIntent = /\b(apartment|apartments|house|homes?|duplex|shortlets?|office|shop|property|properties|rent|bedrooms?)\b/i.test(query);
    var searchIntent = /\b(find|show|search|looking for|need|want|recommend|suggest|match|near|around|in)\b/i.test(query);
    return propertyIntent && searchIntent;
  }

  function createLoader(question) {
    var loader = document.createElement("div");
    loader.className = "la-liquid-loader";
    loader.setAttribute("role", "status");
    loader.setAttribute("aria-live", "polite");
    var query = String(question || "");
    var hasSearchIntent = isPropertySearch(query);
    var area = query.match(/\b(?:in|near|around)\s+([^,.?!]+)/i);
    var propertyType = query.match(/\b(apartments?|houses?|homes?|duplex(?:es)?|shortlets?|offices?|shops?)\b/i);
    var title = hasSearchIntent
      ? "Searching for " + (propertyType ? propertyType[0].toLowerCase() + (area ? " in " + area[1].trim() : "") : "matching properties") + "..."
      : "Thinking about your question...";
    loader.innerHTML = '<div class="la-liquid-art" aria-hidden="true"><i></i><i></i><i></i><span></span></div><div class="la-liquid-copy"><strong></strong><span>This may take a few seconds</span></div>';
    loader.querySelector(".la-liquid-copy strong").textContent = title;
    return loader;
  }

  // ---------- Voice features ----------
  var recognition = null;
  var synth = window.speechSynthesis || null;
  var voiceEnabled = true;

  function setupVoice() {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.lang = "en-NG";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onerror = function (event) {
        if (typeof window.leaseaccomToast === "function") {
          window.leaseaccomToast(event.error === "not-allowed" ? "Microphone access was denied." : "Voice input could not be started.", "error");
        }
      };
    }
  }

  function speak(text) {
    if (!voiceEnabled || !synth) return;
    synth.cancel();
    if (typeof window.SpeechSynthesisUtterance !== "function") return;
    var utt = new window.SpeechSynthesisUtterance(text);
    utt.lang = "en-NG";
    synth.speak(utt);
  }
  window.LeaseAccomAssistantSpeak = speak;

  function addVoiceUI() {
    var form = document.getElementById("assistantForm");
    if (!form || document.getElementById("laVoiceBtn")) return;

    var mic = document.createElement("button");
    mic.type = "button";
    mic.id = "laVoiceBtn";
    mic.innerHTML = '<i class="bx bx-microphone" aria-hidden="true"></i>';
    mic.title = "Speak your question";
    mic.setAttribute("aria-label", "Speak your question");
    mic.className = "assistant-voice-btn";

    var speaker = document.createElement("button");
    speaker.type = "button";
    speaker.id = "laSpeakerBtn";
    speaker.innerHTML = '<i class="bx bx-volume-full" aria-hidden="true"></i>';
    speaker.title = "Toggle voice replies";
    speaker.setAttribute("aria-label", "Toggle spoken replies");
    speaker.setAttribute("aria-pressed", "true");
    speaker.className = "assistant-voice-btn assistant-speaker-btn";

    form.appendChild(mic);
    form.appendChild(speaker);

    mic.addEventListener("click", function () {
      if (!recognition) {
        if (typeof window.leaseaccomToast === "function") {
          window.leaseaccomToast("Voice input is not supported by this browser.", "info");
        }
        return;
      }
      mic.classList.add("is-listening");
      mic.innerHTML = '<i class="bx bx-stop" aria-hidden="true"></i>';
      recognition.onresult = function (e) {
        var text = e.results[0][0].transcript;
        var input = document.getElementById("assistantInput");
        if (input) input.value = text;
        mic.classList.remove("is-listening");
        mic.innerHTML = '<i class="bx bx-microphone" aria-hidden="true"></i>';
        // auto-submit
        var submitEvent = new Event("submit", { cancelable: true });
        form.dispatchEvent(submitEvent);
      };
      recognition.onerror = function () {
        mic.classList.remove("is-listening");
        mic.innerHTML = '<i class="bx bx-microphone" aria-hidden="true"></i>';
      };
      recognition.onend = function () {
        mic.classList.remove("is-listening");
        mic.innerHTML = '<i class="bx bx-microphone" aria-hidden="true"></i>';
      };
      try {
        recognition.start();
      } catch (error) {
        mic.classList.remove("is-listening");
        mic.innerHTML = '<i class="bx bx-microphone" aria-hidden="true"></i>';
        if (typeof window.leaseaccomToast === "function") {
          window.leaseaccomToast("Voice input is already active or unavailable.", "info");
        }
      }
    });

    speaker.addEventListener("click", function () {
      voiceEnabled = !voiceEnabled;
      speaker.classList.toggle("is-muted", !voiceEnabled);
      speaker.setAttribute("aria-pressed", String(voiceEnabled));
      speaker.title = voiceEnabled ? "Voice replies on" : "Voice replies off";
    });
  }

  function enhance() {
    ensurePanel();
    setupVoice();
    addVoiceUI();
    var input = document.getElementById("assistantInput");
    var form = document.getElementById("assistantForm");
    var messages = document.getElementById("assistantMessages");
    if (!messages) return;

    document.getElementById("assistantClose")?.addEventListener("click", function () {
      var panel = document.getElementById("assistantPanel");
      var launcher = document.getElementById("assistantLauncher");
      panel?.classList.remove("is-open");
      panel?.setAttribute("aria-hidden", "true");
      launcher?.setAttribute("aria-expanded", "false");
    });

    document.getElementById("assistantLauncher")?.addEventListener("click", function () {
      document.getElementById("assistantPanel")?.setAttribute("aria-hidden", "false");
    });

    function addBot(text) {
      var div = document.createElement("div");
      div.className = "assistant-message assistant-message-ai";
      div.style.whiteSpace = "pre-line";
      div.textContent = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }

    function handle(q) {
      if (!q || !q.trim()) return;
      var userDiv = document.createElement("div");
      userDiv.className = "assistant-message assistant-message-user";
      userDiv.textContent = q;
      messages.appendChild(userDiv);

      var loader = createLoader(q);
      messages.appendChild(loader);
      messages.scrollTop = messages.scrollHeight;

      setTimeout(function () {
        if (loader.parentNode) loader.remove();
        if (isPropertySearch(q) && typeof window.LeaseAccomAssistantSearch === "function") {
          window.LeaseAccomAssistantSearch(q);
          return;
        }
        var answer = findAnswer(q);
        addBot(answer);
        speak(answer);
      }, 3000);
    }

    document.querySelectorAll("[data-assistant-prompt]").forEach(function (button) {
      if (button.dataset.guidePromptBound === "true") return;
      button.dataset.guidePromptBound = "true";
      button.addEventListener("click", function () {
        var query = button.dataset.assistantPrompt || "";
        var inputField = document.getElementById("assistantInput");
        if (inputField) inputField.value = "";
        handle(query);
      });
    });

    if (form && form.dataset.guideBound !== "true") {
      form.dataset.guideBound = "true";
      form.addEventListener("submit", function (e) {
        var val = input ? input.value.trim() : "";
        e.preventDefault();
        e.stopImmediatePropagation();
        if (input) input.value = "";
        handle(val);
      }, true);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhance);
  } else {
    enhance();
  }
})();
