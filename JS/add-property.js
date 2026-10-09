document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("addPropertyForm");
    const imageInput = document.getElementById("propertyImage");
    const imagePreview = document.getElementById("imagePreview");
    const formStatus = document.getElementById("propertyFormStatus");
    if (!form) return;

    const MIN_IMAGES = 8;
    const MAX_IMAGES = 20;
    let selectedImages = [];
    let coverIndex = 0;

    function showFormStatus(message, type = "error") {
        if (!formStatus) return;
        formStatus.textContent = message;
        formStatus.className = `form-status is-visible is-${type}`;
    }
    function readCurrentUser() {
        try { return JSON.parse(localStorage.getItem("leasehubCurrentUser") || "null"); }
        catch { return null; }
    }
    const currentUser = readCurrentUser();
    if (!currentUser || currentUser.accountType !== "owner") {
        window.location.href = "login.html";
        return;
    }
    // Landlords must be verified before listing
    const vStatus = String(currentUser.verificationStatus || currentUser.ownerVerificationStatus || "unverified").toLowerCase();
    if (vStatus !== "verified") {
        window.location.replace("owner-verification.html?need=list");
        return;
    }

    // Subscription unit limit
    function enforceUnitLimit() {
        if (!window.LeaseHubPlans || typeof window.LeaseHubPlans.canAddUnit !== "function") {
            return true;
        }
        const gate = window.LeaseHubPlans.canAddUnit(currentUser);
        if (!gate.ok) {
            showFormStatus(
                gate.message + " Open Payments / Plans to upgrade (Basic ₦5k · Standard ₦10k · Premium ₦20k).",
                "error"
            );
            const upgrade = document.createElement("p");
            upgrade.className = "plan-upgrade-hint";
            upgrade.innerHTML = '<a href="owner-payments.html#plans" class="owner-btn">View plans &amp; upgrade</a>';
            if (formStatus && formStatus.parentNode && !document.getElementById("planUpgradeHint")) {
                upgrade.id = "planUpgradeHint";
                formStatus.parentNode.insertBefore(upgrade, formStatus.nextSibling);
            }
            return false;
        }
        return true;
    }
    if (!enforceUnitLimit()) {
        // Still show the form locked messaging; block submit
    }

    function compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("Unable to read image."));
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const maxSide = 1280;
                    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
                    const canvas = document.createElement("canvas");
                    canvas.width = Math.max(1, Math.round(img.width * scale));
                    canvas.height = Math.max(1, Math.round(img.height * scale));
                    const ctx = canvas.getContext("2d", { alpha: false });
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL("image/jpeg", 0.72));
                };
                img.onerror = () => reject(new Error("Invalid image."));
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function renderPreview() {
        if (!imagePreview) return;
        imagePreview.innerHTML = `
            <div class="leasehub-image-upload-summary">
                <strong>${selectedImages.length} / ${MAX_IMAGES} photos selected</strong>
                <span>${selectedImages.length < MIN_IMAGES ? `Add ${MIN_IMAGES - selectedImages.length} more to continue.` : "Minimum reached — you can add more photos."}</span>
            </div>
            <div class="leasehub-upload-grid">
                ${selectedImages.map((src, index) => `
                    <div class="leasehub-upload-thumb ${index === coverIndex ? "is-cover" : ""}" draggable="true" data-index="${index}">
                        <img src="${src}" alt="Property photo ${index + 1}">
                        ${index === coverIndex ? '<span class="leasehub-cover-label">Cover</span>' : ''}
                        <button type="button" class="leasehub-remove-photo" data-remove="${index}" aria-label="Remove photo ${index + 1}"><i class="bx bx-x"></i></button>
                        <button type="button" class="leasehub-set-cover" data-cover="${index}">${index === coverIndex ? "Cover photo" : "Set as cover"}</button>
                    </div>
                `).join("")}
            </div>
        `;
        imagePreview.querySelectorAll("[data-remove]").forEach(btn => btn.addEventListener("click", () => {
            const index = Number(btn.dataset.remove);
            selectedImages.splice(index, 1);
            if (coverIndex >= selectedImages.length) coverIndex = Math.max(0, selectedImages.length - 1);
            else if (index < coverIndex) coverIndex -= 1;
            renderPreview();
        }));
        imagePreview.querySelectorAll("[data-cover]").forEach(btn => btn.addEventListener("click", () => {
            coverIndex = Number(btn.dataset.cover);
            renderPreview();
        }));
        let dragIndex = null;
        imagePreview.querySelectorAll(".leasehub-upload-thumb").forEach(card => {
            card.addEventListener("dragstart", () => { dragIndex = Number(card.dataset.index); });
            card.addEventListener("dragover", e => e.preventDefault());
            card.addEventListener("drop", e => {
                e.preventDefault();
                const target = Number(card.dataset.index);
                if (dragIndex === null || dragIndex === target) return;
                const [moved] = selectedImages.splice(dragIndex, 1);
                selectedImages.splice(target, 0, moved);
                if (coverIndex === dragIndex) coverIndex = target;
                else if (dragIndex < coverIndex && target >= coverIndex) coverIndex -= 1;
                else if (dragIndex > coverIndex && target <= coverIndex) coverIndex += 1;
                renderPreview();
            });
        });
    }

    imageInput?.addEventListener("change", async () => {
        const files = Array.from(imageInput.files || []);
        if (!files.length) return;
        const valid = files.filter(file => file.type.startsWith("image/"));
        if (valid.length !== files.length) showFormStatus("Some selected files were skipped because they are not images.");
        const room = MAX_IMAGES - selectedImages.length;
        if (valid.length > room) showFormStatus(`You can add only ${room} more photo${room === 1 ? "" : "s"}.`);
        const filesToAdd = valid.slice(0, room);
        try {
            for (const file of filesToAdd) selectedImages.push(await compressImage(file));
            renderPreview();
            if (selectedImages.length >= MIN_IMAGES) showFormStatus("Photo set ready. You can continue through the property wizard.", "success");
        } catch (error) {
            showFormStatus("One or more images could not be processed. Please try again.");
        }
        imageInput.value = "";
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (typeof enforceUnitLimit === "function" && !enforceUnitLimit()) return;
        const title = document.getElementById("propertyTitle")?.value.trim();
        const type = document.getElementById("propertyType")?.value;
        const purpose = document.getElementById("listingPurpose")?.value;
        const state = document.getElementById("propertyState")?.value;
        const city = document.getElementById("propertyCity")?.value.trim();
        const location = document.getElementById("propertyLocation")?.value.trim();
        const price = Number(document.getElementById("propertyPrice")?.value);
        const period = document.getElementById("propertyPeriod")?.value;
        const bedrooms = Number(document.getElementById("propertyBedrooms")?.value) || 0;
        const bathrooms = Number(document.getElementById("propertyBathrooms")?.value) || 0;
        const size = document.getElementById("propertySize")?.value.trim() || "";
        const description = document.getElementById("propertyDescription")?.value.trim();

        if (!title || !type || !purpose || !state || !city || !location || !Number.isFinite(price) || price <= 0 || !description) {
            showFormStatus("Please complete all required fields."); return;
        }
        if (description.length < 40) {
            showFormStatus("Please write a clearer description (at least 40 characters) so tenants trust the listing."); return;
        }
        if (selectedImages.length < MIN_IMAGES) {
            showFormStatus(`Please upload at least ${MIN_IMAGES} property photos before submitting.`); return;
        }
        // Owner must still be verified (extra safety if page was opened directly)
        const ownerV = String(currentUser.verificationStatus || currentUser.ownerVerificationStatus || "unverified").toLowerCase();
        if (ownerV !== "verified") {
            showFormStatus("Your owner account must be verified before you can submit a listing.");
            window.setTimeout(() => { window.location.href = "owner-verification.html?need=list"; }, 900);
            return;
        }
        const amenities = Array.from(document.querySelectorAll('input[name="amenity"]:checked')).map(c => c.value);
        let ownerProfile = {};
        try { ownerProfile = JSON.parse(localStorage.getItem("leasehubOwnerProfile") || "{}") || {}; } catch {}
        const ownerName = ownerProfile.name || ownerProfile.displayName || currentUser.name || "Property Owner";
        const serviceChargeEl = document.getElementById("propertyServiceCharge");
        const cautionEl = document.getElementById("propertyCautionFee");
        const serviceCharge = serviceChargeEl && serviceChargeEl.value !== "" ? Number(serviceChargeEl.value) : null;
        const cautionFee = cautionEl && cautionEl.value !== "" ? Number(cautionEl.value) : null;

        const newProperty = {
            id: Date.now(), title, type, purpose, state, city, location, price, period, bedrooms, bathrooms, size,
            description, amenities, image: selectedImages[coverIndex] || selectedImages[0], images: selectedImages.slice(),
            ownerId: currentUser.id, ownerName, ownerAvatar: ownerProfile.avatar || currentUser.avatar || "",
            ownerPhone: ownerProfile.phone || currentUser.phone || "",
            ownerVerified: true,
            ownerVerificationStatus: "verified",
            verified: false,
            verificationStatus: "pending",
            verificationLabel: "Pending review",
            listingStatus: "pending",
            quality: {
                photos: selectedImages.length,
                descriptionLength: description.length,
                minPhotosRequired: MIN_IMAGES
            },
            serviceCharge: Number.isFinite(serviceCharge) ? serviceCharge : undefined,
            cautionFee: Number.isFinite(cautionFee) ? cautionFee : undefined,
            submittedAt: new Date().toISOString()
        };
        let storedProperties = [];
        try { const parsed = JSON.parse(localStorage.getItem("leasehubProperties") || "[]"); storedProperties = Array.isArray(parsed) ? parsed : []; } catch {}
        storedProperties.push(newProperty);
        // Always keep local copy (fallback / offline)
        localStorage.setItem("leasehubProperties", JSON.stringify(storedProperties));
        const currentUserProperties = Array.isArray(currentUser.properties) ? currentUser.properties : [];
        if (!currentUserProperties.some(id => String(id) === String(newProperty.id))) currentUserProperties.push(newProperty.id);
        currentUser.properties = currentUserProperties;
        localStorage.setItem("leasehubCurrentUser", JSON.stringify(currentUser));
        try {
            const users = JSON.parse(localStorage.getItem("leasehubUsers") || "[]");
            if (Array.isArray(users)) {
                const index = users.findIndex(user => String(user.id) === String(currentUser.id));
                if (index !== -1) { users[index] = currentUser; localStorage.setItem("leasehubUsers", JSON.stringify(users)); }
            }
        } catch {}

        // Cloud save (Supabase) so listings work across devices
        showFormStatus("Submitting listing…", "success");
        try {
            if (window.LeaseHubData && typeof window.LeaseHubData.createProperty === "function") {
                const cloud = await window.LeaseHubData.createProperty(newProperty);
                if (cloud && cloud.ok) {
                    if (cloud.mapped && cloud.mapped.id) {
                        newProperty.id = cloud.mapped.id;
                    }
                    showFormStatus("Property saved to LeaseHub cloud. Pending review before it goes live.", "success");
                } else if (cloud && cloud.offline) {
                    showFormStatus("Saved on this device only (offline). Sign in again to sync to the cloud.", "success");
                } else {
                    console.warn("Supabase createProperty:", cloud && cloud.error);
                    showFormStatus("Saved on this device. Cloud sync failed: " + ((cloud && cloud.error) || "unknown") + ". Check Supabase RLS/columns.", "error");
                    // still redirect so owner sees local pending
                }
            } else {
                showFormStatus("Property submitted on this device (Supabase client not loaded). Pending verification.", "success");
            }
        } catch (err) {
            console.warn(err);
            showFormStatus("Saved locally. Cloud error: " + (err && err.message ? err.message : "failed"), "error");
        }
        window.setTimeout(() => { window.location.href = "owner-dashboard.html"; }, 900);
    });


    function renderQualityChecklist() {
        let box = document.getElementById("listingQualityChecklist");
        if (!box) {
            box = document.createElement("div");
            box.id = "listingQualityChecklist";
            box.className = "listing-quality-box";
            const status = document.getElementById("propertyFormStatus");
            if (status && status.parentNode) status.parentNode.insertBefore(box, status);
            else form.appendChild(box);
        }
        const desc = document.getElementById("propertyDescription")?.value.trim() || "";
        const titleOk = Boolean(document.getElementById("propertyTitle")?.value.trim());
        const priceOk = Number(document.getElementById("propertyPrice")?.value) > 0;
        const locOk = Boolean(document.getElementById("propertyLocation")?.value.trim());
        const items = [
            { ok: selectedImages.length >= MIN_IMAGES, label: `${MIN_IMAGES}+ photos`, meta: `${selectedImages.length}/${MIN_IMAGES}` },
            { ok: desc.length >= 40, label: "Description 40+ chars", meta: `${desc.length}` },
            { ok: titleOk, label: "Title", meta: "" },
            { ok: priceOk, label: "Price", meta: "" },
            { ok: locOk, label: "Location", meta: "" }
        ];
        const passed = items.filter(i => i.ok).length;
        box.innerHTML = `
            <div class="listing-quality-head">
                <strong>Listing quality</strong>
                <span>${passed}/${items.length} ready</span>
            </div>
            <ul class="listing-quality-list">
                ${items.map(i => `<li class="${i.ok ? "is-ok" : "is-miss"}"><i class="bx ${i.ok ? "bx-check-circle" : "bx-circle"}"></i> ${i.label}${i.meta ? ` <small>${i.meta}</small>` : ""}</li>`).join("")}
            </ul>
            <p class="listing-quality-note">After submit, status is <strong>Pending</strong> until LeaseHub approves — then it goes <strong>Live</strong> on the marketplace.</p>
        `;
    }

    form.querySelectorAll("input, textarea, select").forEach(el => {
        el.addEventListener("input", renderQualityChecklist);
        el.addEventListener("change", renderQualityChecklist);
    });
    const _origRenderPreview = renderPreview;
    renderPreview = function () {
        _origRenderPreview();
        renderQualityChecklist();
    };

    renderPreview();
    renderQualityChecklist();
});
