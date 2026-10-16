document.addEventListener("DOMContentLoaded", function () {
  const grid = document.getElementById("savedGrid");
  const empty = document.getElementById("savedEmpty");
  const count = document.getElementById("savedCountLabel");
  if (!grid || !empty || !count) return;

  let cloudSavedIds = null;

  function currentSavedIds() {
    return cloudSavedIds === null
      ? (typeof getSavedProperties === "function" ? getSavedProperties() : [])
      : cloudSavedIds;
  }

  function render() {
    const savedIds = new Set(currentSavedIds().map(String));
    const listings = (window.properties || []).filter(property =>
      savedIds.has(String(property.id)) &&
      !(typeof isPropertyRejected === "function" && isPropertyRejected(property))
    );

    count.textContent = `${listings.length} ${listings.length === 1 ? "property" : "properties"} saved`;
    grid.innerHTML = listings.map(createLeaseAccomPropertyCard).join("");
    empty.hidden = listings.length > 0;
    grid.hidden = listings.length === 0;
    bindSaved();
  }

  function bindSaved() {
    grid.querySelectorAll(".save-btn").forEach(button => {
      button.addEventListener("click", async function (event) {
        event.stopPropagation();
        const propertyId = String(button.dataset.id);
        const updatedIds = currentSavedIds().filter(id => String(id) !== propertyId);

        if (cloudSavedIds !== null && typeof window.persistSavedProperty === "function") {
          const saved = await window.persistSavedProperty(propertyId, false);
          if (!saved) {
            if (typeof leaseaccomToast === "function") leaseaccomToast("Could not remove saved property");
            return;
          }
          cloudSavedIds = updatedIds;
        }

        if (typeof saveSavedProperties === "function") saveSavedProperties(updatedIds);
        render();
        if (typeof leaseaccomToast === "function") leaseaccomToast("Removed from saved");
      });
    });

    grid.querySelectorAll(".compare-card-btn").forEach(button => {
      button.addEventListener("click", event => event.stopPropagation());
    });
  }

  async function loadSavedProperties() {
    if (typeof window.loadLeaseAccomPropertyCatalog === "function") {
      await window.loadLeaseAccomPropertyCatalog();
    }

    if (typeof window.getSavedPropertyIds === "function") {
      const ids = await window.getSavedPropertyIds();
      if (Array.isArray(ids)) {
        cloudSavedIds = ids.map(String);
        if (typeof saveSavedProperties === "function") saveSavedProperties(cloudSavedIds);
      }
    }

    render();
  }

  loadSavedProperties().catch(function (error) {
    console.warn("Saved properties could not be loaded from Supabase.", error);
    render();
  });
  window.addEventListener("storage", function () {
    if (cloudSavedIds === null) render();
  });
});