
/* LeaseAccom catalog engine: shortlets, commercial, student housing, hotels */
(function () {
    "use strict";
    const cfg = window.LEASEACCOM_CATALOG;
    if (!cfg) return;

    const byId = id => document.getElementById(id);
    const safe = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
    const money = v => `₦${new Intl.NumberFormat("en-NG").format(Number(v)||0)}`;
    const getList = () => Array.isArray(window.properties) ? window.properties.filter(p => {
        if (typeof isPropertyRejected === "function" && isPropertyRejected(p)) return false;
        return cfg.match(p);
    }) : [];

    let selected = null;
    let detailRoot = byId("catalogDetail");

    function card(p) {
        const pid = String(p.id);
        const saved = (typeof getSavedProperties === "function" ? getSavedProperties() : []).map(String).includes(pid);
        const verified = typeof isPropertyVerified === "function" ? isPropertyVerified(p) : p.verified === true;
        const img = p.image || (p.images && p.images[0]) || "";
        const extra = cfg.cardExtra ? cfg.cardExtra(p) : "";
        return `<article class="property-card leaseaccom-enhanced-card" data-id="${safe(pid)}">
            <div class="property-image">
                <img src="${safe(img)}" alt="${safe(p.title || "Listing")}" loading="lazy">
                <span class="badge ${verified ? "" : "pending-badge"}"><i class="bx ${verified ? "bx-check-circle" : "bx-time-five"}"></i>${verified ? "Verified" : "Pending Verification"}</span>
                <button type="button" class="save-btn ${saved ? "saved":""}" data-id="${safe(pid)}" aria-label="${saved ? "Remove saved listing":"Save listing"}"><i class="bx bx-heart"></i></button>
            </div>
            <div class="property-info">
                <div class="property-type">${safe(p.type || "Listing")}</div>
                <h3>${safe(p.title || "Untitled listing")}</h3>
                <div class="property-location"><i class="bx bx-map"></i>${safe(p.location || p.city || "Nigeria")}</div>
                <div class="property-price">${money(p.price)} <span>/ ${safe(p.period || "year")}</span></div>
                <div class="property-meta">
                    ${Number(p.bedrooms)>0 ? `<span><i class="bx bx-bed"></i>${p.bedrooms} bed</span>`:""}
                    ${Number(p.bathrooms)>0 ? `<span><i class="bx bx-bath"></i>${p.bathrooms} bath</span>`:""}
                    ${p.size ? `<span><i class="bx bx-area"></i>${safe(p.size)}</span>`:""}
                </div>
                ${extra}
                <button type="button" class="view-property-btn" data-view-id="${safe(pid)}">View ${cfg.viewLabel || "Listing"} <i class="bx bx-arrow-right"></i></button>
            </div>
        </article>`;
    }

    function render() {
        const grid = byId("catalogGrid");
        if (!grid) return;
        const query = (byId("catalogSearch")?.value || "").trim().toLowerCase();
        const price = Number(byId("catalogPrice")?.value || 0);
        const verifiedOnly = !!byId("catalogVerified")?.checked;
        const type = byId("catalogType")?.value || "all";
        const sort = byId("catalogSort")?.value || "recommended";
        let list = getList().filter(p => {
            const text = [p.title,p.location,p.city,p.state,p.university,p.accommodationType,p.type].join(" ").toLowerCase();
            if (query && !text.includes(query)) return false;
            if (price && Number(p.price) > price) return false;
            if (verifiedOnly && !(typeof isPropertyVerified === "function" ? isPropertyVerified(p) : p.verified)) return false;
            if (type !== "all" && String(p.type) !== type && String(p.accommodationType) !== type) return false;
            return true;
        });
        if (sort === "low") list.sort((a,b)=>Number(a.price)-Number(b.price));
        if (sort === "high") list.sort((a,b)=>Number(b.price)-Number(a.price));
        if (sort === "newest") list.sort((a,b)=>String(b.submittedAt||"").localeCompare(String(a.submittedAt||"")));
        const count = byId("catalogCount");
        if (count) count.textContent = `${list.length} ${list.length === 1 ? "listing" : "listings"} found`;
        if (!list.length) {
            grid.innerHTML = `<div class="leaseaccom-empty"><i class="bx bx-search-alt-2"></i><h3>No listings found</h3><p>Try changing your search or filters.</p><button type="button" class="primary-btn" id="catalogClearEmpty">Clear filters</button></div>`;
            byId("catalogClearEmpty")?.addEventListener("click", clear);
            return;
        }
        grid.innerHTML = list.map(card).join("");
        grid.classList.add("leaseaccom-stagger");
        grid.querySelectorAll(".save-btn").forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                const id=String(btn.dataset.id);
                let saved=typeof getSavedProperties==="function"?getSavedProperties():[];
                const has=saved.map(String).includes(id);
                saved=has?saved.filter(x=>String(x)!==id):[...saved,id];
                if(typeof saveSavedProperties==="function")saveSavedProperties(saved);
                if(typeof window.persistSavedProperty==="function")window.persistSavedProperty(id,!has).catch(()=>{});
                btn.classList.toggle("saved",!has);
                leaseaccomToast(has?"Removed from saved":"Saved");
            });
        });
        grid.querySelectorAll("[data-view-id]").forEach(btn => btn.addEventListener("click", e => {
            e.stopPropagation(); openDetail(btn.dataset.viewId);
        }));
        grid.querySelectorAll(".property-card").forEach(c => c.addEventListener("click", () => openDetail(c.dataset.id)));
    }

    function clear() {
        const ids=["catalogSearch","catalogPrice","catalogType","catalogSort"];
        ids.forEach(id=>{const el=byId(id); if(el) el.value=id==="catalogType"||id==="catalogSort"?"all":"";});
        const sort=byId("catalogSort"); if(sort) sort.value="recommended";
        const check=byId("catalogVerified"); if(check) check.checked=false;
        render();
    }

    function openDetail(id) {
        selected = getList().find(p=>String(p.id)===String(id));
        if(!selected) return;
        if(typeof addRecentlyViewed==="function") addRecentlyViewed(id);
        detailRoot = byId("catalogDetail");
        if(!detailRoot) return;
        const images=Array.from(new Set((selected.images||[]).concat(selected.image||[]).filter(Boolean)));
        let idx=0;
        detailRoot.hidden=false;
        detailRoot.innerHTML=`
            <div class="leaseaccom-detail-card">
                <div class="leaseaccom-gallery">
                    <div class="leaseaccom-gallery-main">
                        <img id="catalogMainImage" src="${safe(images[0]||"")}" alt="${safe(selected.title)}">
                        <span class="leaseaccom-gallery-counter" id="catalogCounter">1 / ${images.length||1}</span>
                    </div>
                    <div class="leaseaccom-gallery-thumbs" id="catalogThumbs"></div>
                </div>
                <div class="leaseaccom-detail-info">
                    <span class="badge ${selected.verified?"":"pending-badge"}"><i class="bx ${selected.verified?"bx-check-circle":"bx-time-five"}"></i>${selected.verified?"Verified":"Pending Verification"}</span>
                    <h1>${safe(selected.title)}</h1>
                    <p><i class="bx bx-map"></i> ${safe(selected.location || selected.city || "Nigeria")}</p>
                    <div class="leaseaccom-detail-price">${money(selected.price)} <span>/ ${safe(selected.period||"year")}</span></div>
                    <div class="leaseaccom-detail-meta">
                        <div><small>Type</small><strong>${safe(selected.accommodationType||selected.type||"Listing")}</strong></div>
                        <div><small>Bedrooms</small><strong>${selected.bedrooms||"N/A"}</strong></div>
                        <div><small>Bathrooms</small><strong>${selected.bathrooms||"N/A"}</strong></div>
                        <div><small>Availability</small><strong>Available</strong></div>
                    </div>
                    ${cfg.detailExtra ? cfg.detailExtra(selected) : ""}
                    <div class="leaseaccom-action-stack">
                        <button class="primary-btn" id="catalogActionBtn">${cfg.actionLabel||"Request viewing"}</button>
                        <button class="leaseaccom-secondary-btn" id="catalogCloseBtn"><i class="bx bx-arrow-back"></i> Back to listings</button>
                    </div>
                </div>
            </div>`;
        const thumbs=byId("catalogThumbs");
        images.forEach((src,i)=>{const b=document.createElement("button");b.type="button";b.className=i===0?"active":"";b.innerHTML=`<img src="${safe(src)}" alt="">`;b.onclick=()=>{idx=i;update();};thumbs.appendChild(b);});
        function update(){byId("catalogMainImage").src=images[idx]||"";byId("catalogCounter").textContent=`${idx+1} / ${images.length||1}`;thumbs.querySelectorAll("button").forEach((b,i)=>b.classList.toggle("active",i===idx));}
        byId("catalogCloseBtn").onclick=()=>{detailRoot.hidden=true; window.scrollTo({top:0,behavior:"smooth"});};
        byId("catalogActionBtn").onclick=()=>leaseaccomToast(cfg.actionMessage||"Request recorded for this frontend demo.");
        detailRoot.scrollIntoView({behavior:"smooth",block:"start"});
    }

    byId("catalogSearch")?.addEventListener("input",render);
    byId("catalogPrice")?.addEventListener("change",render);
    byId("catalogType")?.addEventListener("change",render);
    byId("catalogVerified")?.addEventListener("change",render);
    byId("catalogSort")?.addEventListener("change",render);
    byId("catalogSearchBtn")?.addEventListener("click",render);
    byId("catalogClearBtn")?.addEventListener("click",clear);
    const grid = byId("catalogGrid");
    if (window.loadLeaseAccomPropertyCatalog) {
        if (grid) {
            grid.setAttribute("aria-busy", "true");
            grid.innerHTML = '<p role="status">Loading listings...</p>';
        }
        window.loadLeaseAccomPropertyCatalog()
            .catch(() => [])
            .then(() => {
                if (grid) grid.removeAttribute("aria-busy");
                render();
            });
    } else {
        render();
    }
})();
