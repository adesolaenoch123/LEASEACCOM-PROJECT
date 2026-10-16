document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("addPropertyForm");
    const imageInput = document.getElementById("propertyImage");
    const imagePreview = document.getElementById("imagePreview");
    const formStatus = document.getElementById("propertyFormStatus");
    if (!form) return;

    const MIN_IMAGES = 3;
    const MAX_IMAGES = 20;
    const MAX_VIDEOS = 3;
    let selectedVideos = [];
    let selectedImages = [];
    let coverIndex = 0;

    function showFormStatus(message, type = "error") {
        if (!formStatus) return;
        formStatus.textContent = message;
        formStatus.className = `form-status is-visible is-${type}`;
    }
    function readCurrentUser() {
        try { return JSON.parse(
            localStorage.getItem("leasehubCurrentUser") ||
            localStorage.getItem("leaseHubCurrentUser") ||
            localStorage.getItem("leaseaccomCurrentUser") ||
            localStorage.getItem("currentUser") ||
            "null"
        ); }
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
        if (!window.LeaseAccomPlans || typeof window.LeaseAccomPlans.canAddUnit !== "function") {
            return true;
        }
        const gate = window.LeaseAccomPlans.canAddUnit(currentUser);
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
                const dataUrl = reader.result;
                // Fast path: if browser can't decode (HEIC etc), keep original data URL
                const img = new Image();
                img.onload = () => {
                    try {
                        const maxSide = 1280;
                        const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
                        const canvas = document.createElement("canvas");
                        canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
                        canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
                        const ctx = canvas.getContext("2d", { alpha: false });
                        if (!ctx) {
                            resolve(dataUrl);
                            return;
                        }
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        resolve(canvas.toDataURL("image/jpeg", 0.72));
                    } catch (e) {
                        resolve(dataUrl);
                    }
                };
                img.onerror = () => {
                    // Still keep the file as data URL so preview/submit can work
                    resolve(dataUrl);
                };
                img.src = dataUrl;
            };
            reader.readAsDataURL(file);
        });
    }

    function readVideoFile(file) {
        return new Promise((resolve, reject) => {
            if (file.size > 40 * 1024 * 1024) {
                reject(new Error("Video must be under 40MB."));
                return;
            }
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("Unable to read video."));
            reader.onload = () => {
                resolve({
                    name: file.name,
                    type: file.type || "video/mp4",
                    size: file.size,
                    dataUrl: reader.result
                });
            };
            reader.readAsDataURL(file);
        });
    }

    function renderPreview() {
        if (!imagePreview) return;
        const photoMsg = selectedImages.length < MIN_IMAGES
            ? `Add ${MIN_IMAGES - selectedImages.length} more photo(s) to continue.`
            : "Photos ready — you can add more or continue.";
        imagePreview.innerHTML = `
            <div class="leaseaccom-image-upload-summary">
                <strong>${selectedImages.length} / ${MAX_IMAGES} photos · ${selectedVideos.length} / ${MAX_VIDEOS} videos</strong>
                <span>${photoMsg}</span>
            </div>
            <div class="leaseaccom-upload-grid">
                ${selectedImages.map((src, index) => `
                    <div class="leaseaccom-upload-thumb ${index === coverIndex ? "is-cover" : ""}" draggable="true" data-index="${index}">
                        <img src="${src}" alt="Property photo ${index + 1}">
                        ${index === coverIndex ? '<span class="leaseaccom-cover-label">Cover</span>' : ''}
                        <button type="button" class="leaseaccom-remove-photo" data-remove="${index}" aria-label="Remove photo"><i class="bx bx-x"></i></button>
                        <button type="button" class="leaseaccom-set-cover" data-cover="${index}">${index === coverIndex ? "Cover photo" : "Set as cover"}</button>
                    </div>
                `).join("")}
                ${selectedVideos.map((vid, index) => `
                    <div class="leaseaccom-upload-thumb is-video" data-video-index="${index}">
                        <video src="${vid.dataUrl}" muted playsinline preload="metadata"></video>
                        <span class="leaseaccom-cover-label">Video</span>
                        <button type="button" class="leaseaccom-remove-photo" data-remove-video="${index}" aria-label="Remove video"><i class="bx bx-x"></i></button>
                        <span class="leaseaccom-set-cover" style="pointer-events:none">${(vid.name || "clip").slice(0, 18)}</span>
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
            renderQualityChecklist();
        }));
        imagePreview.querySelectorAll("[data-remove-video]").forEach(btn => btn.addEventListener("click", () => {
            selectedVideos.splice(Number(btn.dataset.removeVideo), 1);
            renderPreview();
            renderQualityChecklist();
        }));
        imagePreview.querySelectorAll("[data-cover]").forEach(btn => btn.addEventListener("click", () => {
            coverIndex = Number(btn.dataset.cover);
            renderPreview();
        }));
        let dragIndex = null;
        imagePreview.querySelectorAll(".leaseaccom-upload-thumb[data-index]").forEach(card => {
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
        showFormStatus("Processing photos…", "success");
        // Accept image/* and common mobile types with empty type
        const valid = files.filter(file =>
            (file.type && file.type.startsWith("image/")) ||
            /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(file.name || "")
        );
        if (!valid.length) {
            showFormStatus("No usable images found. Use JPG, PNG or WEBP.");
            imageInput.value = "";
            return;
        }
        if (valid.length !== files.length) showFormStatus("Some files were skipped (not images).");
        const room = MAX_IMAGES - selectedImages.length;
        if (room <= 0) {
            showFormStatus(`Maximum ${MAX_IMAGES} photos reached.`);
            imageInput.value = "";
            return;
        }
        const filesToAdd = valid.slice(0, room);
        try {
            for (const file of filesToAdd) {
                const dataUrl = await compressImage(file);
                if (dataUrl) selectedImages.push(dataUrl);
            }
            renderPreview();
            if (selectedImages.length >= MIN_IMAGES) showFormStatus("Photo set ready. You can continue through the property wizard.", "success");
        } catch (error) {
            showFormStatus("One or more images could not be processed. Please try again.");
        }
        imageInput.value = "";
        renderQualityChecklist();
    });

    const videoInput = document.getElementById("propertyVideo");
    videoInput?.addEventListener("change", async () => {
        const files = Array.from(videoInput.files || []);
        if (!files.length) return;
        showFormStatus("Processing video…", "success");
        const valid = files.filter(f =>
            (f.type && f.type.startsWith("video/")) || /\.(mp4|webm|mov|m4v)$/i.test(f.name || "")
        );
        if (!valid.length) {
            showFormStatus("Use MP4, WEBM or MOV video files.");
            videoInput.value = "";
            return;
        }
        const room = MAX_VIDEOS - selectedVideos.length;
        if (room <= 0) {
            showFormStatus(`Maximum ${MAX_VIDEOS} videos reached.`);
            videoInput.value = "";
            return;
        }
        try {
            for (const file of valid.slice(0, room)) {
                selectedVideos.push(await readVideoFile(file));
            }
            renderPreview();
            showFormStatus(`${selectedVideos.length} video(s) attached.`, "success");
        } catch (err) {
            showFormStatus(err.message || "Could not read video.");
        }
        videoInput.value = "";
        renderQualityChecklist();
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
        try { ownerProfile = JSON.parse(localStorage.getItem("leaseaccomOwnerProfile") || "{}") || {}; } catch {}
        const ownerName = ownerProfile.name || ownerProfile.displayName || currentUser.name || "Property Owner";
        const serviceChargeEl = document.getElementById("propertyServiceCharge");
        const cautionEl = document.getElementById("propertyCautionFee");
        const serviceCharge = serviceChargeEl && serviceChargeEl.value !== "" ? Number(serviceChargeEl.value) : null;
        const cautionFee = cautionEl && cautionEl.value !== "" ? Number(cautionEl.value) : null;

        const newProperty = {
            id: Date.now(), title, type, purpose, state, city, location, price, period, bedrooms, bathrooms, size,
            description, amenities, image: selectedImages[coverIndex] || selectedImages[0], images: selectedImages.slice(), videos: selectedVideos.map(v => v.dataUrl), videoMeta: selectedVideos.map(v => ({ name: v.name, type: v.type, size: v.size })), views: 0, viewHistory: [],
            ownerId: currentUser.id, ownerName, ownerAvatar: ownerProfile.avatar || currentUser.avatar || "",
            ownerPhone: ownerProfile.phone || currentUser.phone || "",
            ownerVerified: true,
            ownerVerificationStatus: "verified",
            verified: false,
            verificationStatus: "pending",
            verificationLabel: "Pending review",
            listingStatus: "pending",
            quality: {
                photos: selectedImages.length, videos: selectedVideos.length,
                descriptionLength: description.length,
                minPhotosRequired: MIN_IMAGES
            },
            serviceCharge: Number.isFinite(serviceCharge) ? serviceCharge : undefined,
            cautionFee: Number.isFinite(cautionFee) ? cautionFee : undefined,
            submittedAt: new Date().toISOString()
        };
        let storedProperties = [];
        try { const parsed = JSON.parse(localStorage.getItem("leaseaccomProperties") || "[]"); storedProperties = Array.isArray(parsed) ? parsed : []; } catch {}
        storedProperties.push(newProperty);
        // Always keep local copy (fallback / offline)
        localStorage.setItem("leaseaccomProperties", JSON.stringify(storedProperties));
        const currentUserProperties = Array.isArray(currentUser.properties) ? currentUser.properties : [];
        if (!currentUserProperties.some(id => String(id) === String(newProperty.id))) currentUserProperties.push(newProperty.id);
        currentUser.properties = currentUserProperties;
        localStorage.setItem("leaseaccomCurrentUser", JSON.stringify(currentUser));
        try {
            const users = JSON.parse(localStorage.getItem("leaseaccomUsers") || "[]");
            if (Array.isArray(users)) {
                const index = users.findIndex(user => String(user.id) === String(currentUser.id));
                if (index !== -1) { users[index] = currentUser; localStorage.setItem("leaseaccomUsers", JSON.stringify(users)); }
            }
        } catch {}

        // Cloud: upload media to Storage, then insert property row
        showFormStatus("Uploading photos to LeaseAccom cloud…", "success");
        try {
            let imageUrls = selectedImages.slice();
            let videoUrls = selectedVideos.map(v => v.dataUrl);
            if (window.LeaseAccomCloud && typeof window.LeaseAccomCloud.uploadListingMedia === "function") {
                const media = await window.LeaseAccomCloud.uploadListingMedia(selectedImages, selectedVideos);
                if (media && media.images && media.images.length) {
                    imageUrls = media.images;
                    videoUrls = media.videos || [];
                    newProperty.images = imageUrls;
                    newProperty.image = imageUrls[Math.min(coverIndex, imageUrls.length - 1)] || imageUrls[0];
                    newProperty.videos = videoUrls;
                    showFormStatus("Photos uploaded. Saving listing…", "success");
                } else if (media && media.offline) {
                    showFormStatus("Offline — saving on this device only.", "success");
                } else if (media && media.error) {
                    console.warn("media upload", media.error);
                    showFormStatus("Photo upload issue: " + media.error + ". Trying to save listing…", "error");
                }
            }
            let cloud = null;
            if (window.LeaseAccomCloud && typeof window.LeaseAccomCloud.createProperty === "function") {
                cloud = await window.LeaseAccomCloud.createProperty(newProperty);
            } else if (window.LeaseAccomData && typeof window.LeaseAccomData.createProperty === "function") {
                cloud = await window.LeaseAccomData.createProperty(newProperty);
            }
            if (cloud && cloud.ok) {
                if (cloud.data && cloud.data.id) newProperty.id = cloud.data.id;
                if (cloud.mapped && cloud.mapped.id) newProperty.id = cloud.mapped.id;
                showFormStatus("Property saved to cloud. Pending admin approval before it goes live.", "success");
            } else if (cloud && cloud.offline) {
                showFormStatus("Saved on this device only (offline).", "success");
            } else if (cloud) {
                console.warn("createProperty", cloud.error);
                showFormStatus("Saved on this device. Cloud: " + (cloud.error || "failed"), "error");
            } else {
                showFormStatus("Saved on this device (cloud client not loaded).", "success");
            }
        } catch (err) {
            console.warn(err);
            showFormStatus("Saved locally. Cloud error: " + (err && err.message ? err.message : "failed"), "error");
        }
        window.setTimeout(() => { window.location.href = "owner-dashboard.html"; }, 1200);
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
            <p class="listing-quality-note">After submit, status is <strong>Pending</strong> until LeaseAccom approves — then it goes <strong>Live</strong> on the marketplace.</p>
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
