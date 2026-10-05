/**
 * Owner identity verification — required before listing properties.
 * Stores application on user + leasehubOwnerVerifications queue for admin.
 */
(function () {
  const USERS_KEY = "leasehubUsers";
  const CURRENT_KEY = "leasehubCurrentUser";
  const QUEUE_KEY = "leasehubOwnerVerifications";

  function readJSON(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      return v == null ? fallback : v;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getCurrentUser() {
    return readJSON(CURRENT_KEY, null) || readJSON("leaseHubCurrentUser", null);
  }

  function saveCurrentUser(user) {
    const payload = JSON.stringify(user);
    localStorage.setItem(CURRENT_KEY, payload);
    localStorage.setItem("leaseHubCurrentUser", payload);
    localStorage.setItem("currentUser", payload);
    const users = readJSON(USERS_KEY, []);
    if (Array.isArray(users)) {
      const idx = users.findIndex(
        (u) => Number(u.id) === Number(user.id) || String(u.email || "").toLowerCase() === String(user.email || "").toLowerCase()
      );
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...user };
        writeJSON(USERS_KEY, users);
      }
    }
  }

  function statusOf(user) {
    return String(user?.verificationStatus || user?.ownerVerificationStatus || "unverified").toLowerCase();
  }

  function renderBanner(user) {
    const el = document.getElementById("ovStatusBanner");
    if (!el) return;
    const st = statusOf(user);
    el.hidden = false;
    el.classList.remove("pending", "verified", "rejected");
    if (st === "verified") {
      el.classList.add("verified");
      el.innerHTML = `<i class="bx bx-badge-check"></i><div><strong>You are verified</strong><p>You can publish property listings. Keep your details up to date.</p></div>`;
    } else if (st === "pending") {
      el.classList.add("pending");
      el.innerHTML = `<i class="bx bx-time-five"></i><div><strong>Verification pending</strong><p>We are reviewing your details. You cannot publish listings until approved.</p></div>`;
    } else if (st === "rejected") {
      el.classList.add("rejected");
      el.innerHTML = `<i class="bx bx-x-circle"></i><div><strong>Verification rejected</strong><p>${user.verificationNote || "Please correct your details and submit again."}</p></div>`;
    } else {
      el.innerHTML = `<i class="bx bx-shield"></i><div><strong>Not verified yet</strong><p>Complete the form below. Listing stays locked until you are verified.</p></div>`;
    }
  }

  function lockFormIfNeeded(user) {
    const form = document.getElementById("ownerVerificationForm");
    const page = document.getElementById("ownerVerificationPage");
    const st = statusOf(user);
    if (!form) return;
    if (st === "pending" || st === "verified") {
      page && page.classList.add("ov-locked");
      form.querySelectorAll("input, select, textarea, button[type=submit]").forEach((n) => {
        if (n.id === "ovSubmitBtn") {
          n.disabled = true;
          n.textContent = st === "verified" ? "Already verified" : "Submitted — pending review";
        } else if (n.type !== "checkbox") {
          n.disabled = true;
        }
      });
    }
  }

  function fillFromUser(user) {
    const v = user.ownerVerification || {};
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && val != null) el.value = val;
    };
    set("ovFullName", v.fullName || user.name || "");
    set("ovPhone", v.phone || user.phone || "");
    set("ovEmail", v.email || user.email || "");
    set("ovCity", v.city || "");
    set("ovAddress", v.address || "");
    set("ovState", v.state || "");
    set("ovIdType", v.idType || "");
    set("ovIdNumber", v.idNumber || "");
    set("ovRole", v.listingRole || "");
    set("ovBusiness", v.businessName || "");
    set("ovProofNote", v.proofNote || "");
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve("");
      if (file.size > 2.5 * 1024 * 1024) {
        reject(new Error("File is too large (max ~2.5MB in demo)."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
    });
  }

  function showStatus(msg, type) {
    const el = document.getElementById("ovFormStatus");
    if (!el) return;
    el.textContent = msg;
    el.className = `form-status is-visible is-${type || "error"}`;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const user = getCurrentUser();
    if (!user || String(user.accountType || "").toLowerCase() !== "owner") {
      window.location.replace("login.html");
      return;
    }

    // Ensure default status
    if (!user.verificationStatus && !user.ownerVerificationStatus) {
      user.verificationStatus = "unverified";
      saveCurrentUser(user);
    }

    renderBanner(user);
    fillFromUser(user);
    lockFormIfNeeded(user);

    const form = document.getElementById("ownerVerificationForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const st = statusOf(getCurrentUser());
      if (st === "verified" || st === "pending") {
        showStatus("Your verification is already " + st + ".", "success");
        return;
      }

      try {
        const idFile = document.getElementById("ovIdFile")?.files?.[0];
        const proofFile = document.getElementById("ovProofFile")?.files?.[0];
        const idData = await fileToDataUrl(idFile);
        const proofData = await fileToDataUrl(proofFile);

        const application = {
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
          proofNote: document.getElementById("ovProofNote").value.trim(),
          idFileName: idFile ? idFile.name : "",
          proofFileName: proofFile ? proofFile.name : "",
          idData: idData ? idData.slice(0, 200) + "…" : "", // avoid huge storage; flag presence
          hasIdUpload: Boolean(idData),
          hasProofUpload: Boolean(proofData),
          submittedAt: new Date().toISOString()
        };

        if (!application.fullName || !application.phone || !application.idNumber) {
          showStatus("Please complete all required fields.", "error");
          return;
        }

        const current = getCurrentUser();
        current.name = application.fullName;
        current.phone = application.phone;
        current.email = application.email || current.email;
        current.verificationStatus = "pending";
        current.ownerVerificationStatus = "pending";
        current.ownerVerification = application;
        current.verificationSubmittedAt = application.submittedAt;
        saveCurrentUser(current);

        const queue = readJSON(QUEUE_KEY, []);
        const entry = {
          id: "ov-" + Date.now(),
          userId: current.id,
          email: current.email,
          status: "pending",
          application,
          createdAt: application.submittedAt
        };
        const withoutDup = Array.isArray(queue)
          ? queue.filter((q) => String(q.userId) !== String(current.id) && String(q.email) !== String(current.email))
          : [];
        withoutDup.unshift(entry);
        writeJSON(QUEUE_KEY, withoutDup.slice(0, 100));

        showStatus("Submitted. Status is Pending — you can list only after approval.", "success");
        renderBanner(current);
        lockFormIfNeeded(current);
      } catch (err) {
        showStatus(err.message || "Could not submit verification.", "error");
      }
    });
  });
})();
