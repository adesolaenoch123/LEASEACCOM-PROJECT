/* LeaseAccom marketplace-specific enhancements */
document.addEventListener("DOMContentLoaded", function () {
    const mapButton=document.getElementById("mapViewBtn");
    const map=document.getElementById("marketMap");
    const savedButton=document.getElementById("savedOnlyBtn");
    const searchSave=document.getElementById("saveSearchBtn");
    if(savedButton){
        savedButton.addEventListener("click",function(){
            const ids=typeof getSavedProperties==="function"?getSavedProperties():[];
            const grid=document.getElementById("marketplaceProperties");
            if(!grid)return;
            const cards=grid.querySelectorAll(".property-card");
            let visible=0;
            cards.forEach(card=>{
                const show=ids.map(String).includes(String(card.dataset.propertyId));
                card.hidden=!show; if(show)visible++;
            });
            savedButton.classList.toggle("active",savedButton.classList.contains("active")?false:true);
            if(!savedButton.classList.contains("active")) cards.forEach(c=>c.hidden=false);
            if(typeof leaseaccomToast==="function")leaseaccomToast(savedButton.classList.contains("active")?`${visible} saved properties shown`:"Showing all properties");
        });
    }
    if(searchSave){
        searchSave.addEventListener("click",function(){
            const query=document.getElementById("marketSearch")?.value.trim()||"";
            const type=document.getElementById("filterType")?.value||"all";
            const budget=document.getElementById("filterBudget")?.value||"all";
            localStorage.setItem("leaseaccomSavedSearch",JSON.stringify({query,type,budget,savedAt:new Date().toISOString()}));
            if(typeof leaseaccomToast==="function")leaseaccomToast("Search saved on this device");
        });
    }
    if(mapButton&&map){
        mapButton.addEventListener("click",()=>map.classList.toggle("is-visible"));
    }
});