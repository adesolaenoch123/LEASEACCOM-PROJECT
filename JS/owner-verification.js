/**
 * LeaseAccom — landlord verification & documentation
 * Stores queue in localStorage (leaseaccomOwnerVerifications).
 * Ready to swap uploads to Supabase Storage later.
 */
(function () {
  "use strict";

  var QUEUE_KEY = "leaseaccomOwnerVerifications";
  var CURRENT_KEYS = ["leaseaccomCurrentUser", "leaseaccomCurrentUser", "currentUser"];
  var MAX_BYTES = 5 * 1024 * 1024;

  var step = 1;
  var idFileMeta = null;
  var proofFileMeta = null;

  function readJSON(key, fallback) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  function getCurrentUser() {
    for (var i = 0; i < CURRENT_KEYS.length; i++) {
      var u = readJSON(CURRENT_KEYS[i], null);
      if (u) return u;
    }
    return null;
  }
  function saveCurrentUser(user) {
    var payload = JSON.stringify(user);
    CURRENT_KEYS.forEach(function (k) {
      try {
        localStorage.setItem(k, payload);
      } catch (e) {}
    });
    var users = readJSON("leaseaccomUsers", []);
    if (Array.isArray(users) && user.id) {
      var idx = users.findIndex(function (x) {
        return String(x.id) === String(user.id);
      });
      if (idx >= 0) users[idx] = Object.assign({}, users[idx], user);
      else users.push(user);
      writeJSON("leaseaccomUsers", users);
    }
  }

  function showStep(n) {
    step = n;
    document.querySelectorAll(".ov-panel").forEach(function (p) {
      p.classList.toggle("is-active", Number(p.getAttribute("data-panel")) === n);
    });
    document.querySelectorAll("[data-step-indicator]").forEach(function (el) {
      var s = Number(el.getAttribute("data-step-indicator"));
      el.classList.toggle("is-active", s === n);
      el.classList.toggle("is-done", s < n);
    });
    if (n === 4) buildReview();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validateStep(n) {
    if (n === 1) {
      if (!document.getElementById("ovFullName").value.trim()) return "Enter your full legal name.";
      if (!document.getElementById("ovPhone").value.trim()) return "Enter your phone number.";
      if (!document.getElementById("ovEmail").value.trim()) return "Enter your email.";
      if (!document.getElementById("ovRole").value) return "Select your listing role.";
      if (!document.getElementById("ovCity").value.trim()) return "Enter your city.";
      if (!document.getElementById("ovState").value) return "Select your state.";
      if (!document.getElementById("ovAddress").value.trim()) return "Enter your address.";
    }
    if (n === 2) {
      if (!document.getElementById("ovIdType").value) return "Select an ID type.";
      if (!document.getElementById("ovIdNumber").value.trim()) return "Enter the ID number.";
      if (!idFileMeta) return "Upload your government ID document.";
    }
    if (n === 3) {
      if (!document.getElementById("ovProofType").value) return "Select proof document type.";
      if (!proofFileMeta) return "Upload proof of ownership or authority.";
    }
    return null;
  }

  function setMsg(text, type) {
    var el = document.getElementById("ovMsg");
    if (!el) return;
    el.textContent = text || "";
    el.className = "ov-msg" + (type === "error" ? " err" : type === "success" ? " ok" : "");
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) return reject(new Error("No file"));
      if (file.size > MAX_BYTES) return reject(new Error("File must be under 5MB."));
      var ok = /image\/|application\/pdf/.test(file.type) || /\.pdf$/i.test(file.name);
      if (!ok) return reject(new Error("Use JPG, PNG or PDF only."));
      var reader = new FileReader();
      reader.onload = function () {
        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result
        });
      };
      reader.onerror = function () {
        reject(new Error("Could not read file."));
      };
      reader.readAsDataURL(file);
    });
  }

  function renderPreview(targetId, meta, clearFn) {
    var box = document.getElementById(targetId);
    if (!box || !meta) {
      if (box) box.innerHTML = "";
      return;
    }
    var isImg = String(meta.type).indexOf("image/") === 0;
    box.innerHTML =
      '<div class="ov-preview">' +
      (isImg
        ? '<img src="' + meta.dataUrl + '" alt="Preview">'
        : '<i class="bx bx-file" style="font-size:28px;color:#0d7547"></i>') +
      "<div><strong>" +
      escapeHtml(meta.name) +
      "</strong><div style=\"font-size:11px;color:#66706a\">" +
      Math.round(meta.size / 1024) +
      " KB</div></div>" +
      '<button type="button" class="rm" data-clear="' +
      targetId +
      '">Remove</button></div>';
    var btn = box.querySelector("[data-clear]");
    if (btn) {
      btn.onclick = function () {
        clearFn();
        box.innerHTML = "";
      };
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setupUpload(dropId, inputId, kind) {
    var drop = document.getElementById(dropId);
    var input = document.getElementById(inputId);
    if (!drop || !input) return;
    drop.addEventListener("click", function () {
      input.click();
    });
    drop.addEventListener("dragover", function (e) {
      e.preventDefault();
      drop.classList.add("is-drag");
    });
    drop.addEventListener("dragleave", function () {
      drop.classList.remove("is-drag");
    });
    drop.addEventListener("drop", function (e) {
      e.preventDefault();
      drop.classList.remove("is-drag");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0], kind);
    });
    input.addEventListener("change", function () {
      if (input.files && input.files[0]) handleFile(input.files[0], kind);
    });
  }

  function handleFile(file, kind) {
    readFile(file)
      .then(function (meta) {
        if (kind === "id") {
          idFileMeta = meta;
          renderPreview("ovIdPreview", meta, function () {
            idFileMeta = null;
            document.getElementById("ovIdFile").value = "";
          });
        } else {
          proofFileMeta = meta;
          renderPreview("ovProofPreview", meta, function () {
            proofFileMeta = null;
            document.getElementById("ovProofFile").value = "";
          });
        }
        setMsg("");
      })
      .catch(function (err) {
        setMsg(err.message || "Upload failed", "error");
      });
  }

  function buildReview() {
    var list = document.getElementById("ovReviewList");
    if (!list) return;
    var rows = [
      ["Name", document.getElementById("ovFullName").value],
      ["Phone", document.getElementById("ovPhone").value],
      ["Email", document.getElementById("ovEmail").value],
      ["Role", document.getElementById("ovRole").value],
      ["Business", document.getElementById("ovBusiness").value || "—"],
      ["Location", document.getElementById("ovCity").value + ", " + document.getElementById("ovState").value],
      ["Address", document.getElementById("ovAddress").value],
      ["ID type", document.getElementById("ovIdType").value],
      ["ID number", document.getElementById("ovIdNumber").value],
      ["ID file", idFileMeta ? idFileMeta.name : "Missing"],
      ["Proof type", document.getElementById("ovProofType").value],
      ["Proof file", proofFileMeta ? proofFileMeta.name : "Missing"],
      ["Note", document.getElementById("ovProofNote").value || "—"]
    ];
    list.innerHTML = rows
      .map(function (r) {
        return "<li><i class=\"bx bx-check\"></i><div><strong>" + escapeHtml(r[0]) + ":</strong> " + escapeHtml(r[1]) + "</div></li>";
      })
      .join("");
  }

  function renderBanner(user) {
    var banner = document.getElementById("ovBanner");
    if (!banner || !user) return;
    var status = String(user.ownerVerificationStatus || user.verificationStatus || "unverified").toLowerCase();
    if (status === "unverified" || !status) {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    banner.className = "ov-banner " + (status === "pending" ? "pending" : status === "rejected" ? "rejected" : "verified");
    var icon = status === "verified" ? "bx-check-shield" : status === "rejected" ? "bx-error-circle" : "bx-time-five";
    var title =
      status === "verified"
        ? "You are verified"
        : status === "rejected"
          ? "Verification rejected"
          : "Verification pending";
    var body =
      status === "verified"
        ? "You can publish listings (each property still needs listing approval)."
        : status === "rejected"
          ? user.verificationNote || "Please correct your documents and resubmit."
          : "Our team is reviewing your documents. You will be notified when a decision is made.";
    banner.innerHTML = "<i class=\"bx " + icon + "\"></i><div><strong>" + title + "</strong><p>" + escapeHtml(body) + "</p></div>";

    if (status === "pending" || status === "verified") {
      document.getElementById("ovSubmitBtn").disabled = status === "pending";
      if (status === "verified") {
        document.getElementById("ovSubmitBtn").textContent = "Already verified";
        document.getElementById("ovSubmitBtn").disabled = true;
      }
    }
  }

  function prefill(user) {
    if (!user) return;
    if (user.name) document.getElementById("ovFullName").value = user.name;
    if (user.phone) document.getElementById("ovPhone").value = user.phone;
    if (user.email) document.getElementById("ovEmail").value = user.email;
    var app = user.ownerVerification;
    if (!app) return;
    if (app.fullName) document.getElementById("ovFullName").value = app.fullName;
    if (app.phone) document.getElementById("ovPhone").value = app.phone;
    if (app.email) document.getElementById("ovEmail").value = app.email;
    if (app.listingRole) document.getElementById("ovRole").value = app.listingRole;
    if (app.businessName) document.getElementById("ovBusiness").value = app.businessName;
    if (app.city) document.getElementById("ovCity").value = app.city;
    if (app.state) document.getElementById("ovState").value = app.state;
    if (app.address) document.getElementById("ovAddress").value = app.address;
    if (app.idType) document.getElementById("ovIdType").value = app.idType;
    if (app.idNumber) document.getElementById("ovIdNumber").value = app.idNumber;
    if (app.proofType) document.getElementById("ovProofType").value = app.proofType;
    if (app.proofNote) document.getElementById("ovProofNote").value = app.proofNote;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var user = getCurrentUser();
    if (!user) {
      // allow demo fill but encourage login
    }
    prefill(user);
    renderBanner(user);
    setupUpload("ovIdDrop", "ovIdFile", "id");
    setupUpload("ovProofDrop", "ovProofFile", "proof");

    document.querySelectorAll("[data-next]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var next = Number(btn.getAttribute("data-next"));
        var err = validateStep(step);
        if (err) {
          setMsg(err, "error");
          return;
        }
        setMsg("");
        showStep(next);
      });
    });
    document.querySelectorAll("[data-prev]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showStep(Number(btn.getAttribute("data-prev")));
      });
    });

    document.getElementById("ovForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var err = validateStep(1) || validateStep(2) || validateStep(3);
      if (err) {
        setMsg(err, "error");
        return;
      }
      if (!document.getElementById("ovConsent").checked) {
        setMsg("Please confirm the consent checkbox.", "error");
        return;
      }

      var application = {
        fullName: document.getElementById("ovFullName").value.trim(),
        phone: document.getElementById("ovPhone").value.trim(),
        email: document.getElementById("ovEmail").value.trim().toLowerCase(),
        city: document.getElementById("ovCity").value.trim(),
        address: document.getElementById("ovAddress").value.trim(),
        state: document.getElementById("ovState").value,
        idType: document.getElementById("ovIdType").value,
        idNumber: document.getElementById("ovIdNumber").value.trim(),
        listingRole: document.getElementById("ovRole").value,
        businessName: document.getElementById("ovBusiness").value.trim(),
        proofType: document.getElementById("ovProofType").value,
        proofNote: document.getElementById("ovProofNote").value.trim(),
        idFileName: idFileMeta ? idFileMeta.name : "",
        proofFileName: proofFileMeta ? proofFileMeta.name : "",
        hasIdUpload: Boolean(idFileMeta),
        hasProofUpload: Boolean(proofFileMeta),
        // Keep small preview only in queue for admin (truncated for storage safety)
        idPreview: idFileMeta && String(idFileMeta.type).indexOf("image/") === 0 ? idFileMeta.dataUrl : "",
        proofPreview: proofFileMeta && String(proofFileMeta.type).indexOf("image/") === 0 ? proofFileMeta.dataUrl : "",
        submittedAt: new Date().toISOString()
      };

      var current = getCurrentUser() || {
        id: "owner-" + Date.now(),
        accountType: "owner"
      };
      current.name = application.fullName;
      current.phone = application.phone;
      current.email = application.email || current.email;
      current.accountType = current.accountType || "owner";
      current.verificationStatus = "pending";
      current.ownerVerificationStatus = "pending";
      current.ownerVerification = application;
      current.verificationSubmittedAt = application.submittedAt;
      current.verificationNote = "";
      saveCurrentUser(current);

      var queue = readJSON(QUEUE_KEY, []);
      var entry = {
        id: "ov-" + Date.now(),
        userId: current.id,
        email: current.email,
        status: "pending",
        application: application,
        createdAt: application.submittedAt
      };
      queue = (Array.isArray(queue) ? queue : []).filter(function (q) {
        return String(q.userId) !== String(current.id) && String(q.email) !== String(current.email);
      });
      queue.unshift(entry);
      writeJSON(QUEUE_KEY, queue.slice(0, 100));

      setMsg("Submitted successfully. Status: Pending review.", "success");
      renderBanner(current);
      document.getElementById("ovSubmitBtn").disabled = true;
      document.getElementById("ovSubmitBtn").textContent = "Submitted — pending";
    });
  });
})();
