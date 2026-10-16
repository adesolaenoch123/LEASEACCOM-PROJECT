/* LeaseAccom property gallery + detail enhancements */
document.addEventListener("DOMContentLoaded", function () {
    const container = document.getElementById("propertyDetails");
    if (!container || !Array.isArray(window.properties)) return;
    const id = Number(new URLSearchParams(location.search).get("id"));
    const property = window.properties.find(p => Number(p.id) === id);
    if (!property) return;
    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
    const images = [...new Set((Array.isArray(property.images) ? property.images : []).concat(property.image ? [property.image] : []).filter(Boolean))];
    if (!images.length) return;
    document.title = `${property.title || "Property"} — LeaseAccom`;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) { meta=document.createElement("meta"); meta.name="description"; document.head.appendChild(meta); }
    meta.content = `View ${property.title || "this property"} in ${property.location || property.city || "Nigeria"} on LeaseAccom.`;
    const original = container.querySelector(".property-details-image");
    if (!original || container.querySelector(".leaseaccom-gallery")) return;

    const gallery=document.createElement("div"); gallery.className="leaseaccom-gallery";
    gallery.innerHTML=`
      <div class="leaseaccom-gallery-main">
        <img id="leaseaccomGalleryMain" src="${esc(images[0])}" alt="${esc(property.title||"Property")}" loading="eager">
        <button class="gallery-nav gallery-prev" type="button" aria-label="Previous property photo"><i class="bx bx-chevron-left"></i></button>
        <button class="gallery-nav gallery-next" type="button" aria-label="Next property photo"><i class="bx bx-chevron-right"></i></button>
        <button class="gallery-open-btn" type="button" aria-label="Open full-screen gallery"><i class="bx bx-expand-alt"></i></button>
        <span class="leaseaccom-gallery-counter" id="leaseaccomGalleryCounter">1 / ${images.length}</span>
      </div>
      <div class="leaseaccom-gallery-thumbs" id="leaseaccomGalleryThumbs"></div>`;
    original.replaceWith(gallery);
    const main=gallery.querySelector("#leaseaccomGalleryMain"), counter=gallery.querySelector("#leaseaccomGalleryCounter"), thumbs=gallery.querySelector("#leaseaccomGalleryThumbs");
    let current=0;
    function setImage(index, direction=0){
      current=(index+images.length)%images.length;
      main.classList.remove("gallery-swap"); void main.offsetWidth; main.src=images[current]; main.classList.add("gallery-swap");
      counter.textContent=`${current+1} / ${images.length}`;
      thumbs.querySelectorAll("button").forEach((b,i)=>b.classList.toggle("active",i===current));
      if(direction) main.dataset.direction=direction>0?"next":"prev";
    }
    images.forEach((src,index)=>{const b=document.createElement("button");b.type="button";b.className=index===0?"active":"";b.setAttribute("aria-label",`View image ${index+1}`);b.innerHTML=`<img src="${esc(src)}" alt="">`;b.addEventListener("click",()=>setImage(index));thumbs.appendChild(b);});
    gallery.querySelector(".gallery-prev").addEventListener("click",()=>setImage(current-1,-1));
    gallery.querySelector(".gallery-next").addEventListener("click",()=>setImage(current+1,1));

    const lightbox=document.createElement("div"); lightbox.className="leaseaccom-lightbox"; lightbox.innerHTML=`
      <button class="leaseaccom-lightbox-close" type="button" aria-label="Close gallery"><i class="bx bx-x"></i></button>
      <button class="leaseaccom-lightbox-prev" type="button" aria-label="Previous image"><i class="bx bx-chevron-left"></i></button>
      <figure><img src="${esc(images[0])}" alt="${esc(property.title||"Property")}"><figcaption id="leaseaccomLightboxCaption">1 / ${images.length}</figcaption></figure>
      <button class="leaseaccom-lightbox-next" type="button" aria-label="Next image"><i class="bx bx-chevron-right"></i></button>`;
    document.body.appendChild(lightbox);
    const lbImg=lightbox.querySelector("img"), caption=lightbox.querySelector("figcaption");
    function syncLightbox(){lbImg.src=images[current];caption.textContent=`${current+1} / ${images.length}`;}
    function openBox(){syncLightbox();lightbox.classList.add("is-open");document.body.classList.add("modal-open");}
    function closeBox(){lightbox.classList.remove("is-open");document.body.classList.remove("modal-open");}
    gallery.querySelector(".gallery-open-btn").addEventListener("click",openBox);
    lightbox.querySelector(".leaseaccom-lightbox-close").addEventListener("click",closeBox);
    lightbox.addEventListener("click",e=>{if(e.target===lightbox)closeBox();});
    lightbox.querySelector(".leaseaccom-lightbox-prev").addEventListener("click",()=>{setImage(current-1,-1);syncLightbox();});
    lightbox.querySelector(".leaseaccom-lightbox-next").addEventListener("click",()=>{setImage(current+1,1);syncLightbox();});
    document.addEventListener("keydown",e=>{if(!lightbox.classList.contains("is-open"))return;if(e.key==="Escape")closeBox();if(e.key==="ArrowLeft"){setImage(current-1,-1);syncLightbox();}if(e.key==="ArrowRight"){setImage(current+1,1);syncLightbox();}});
    let touchStartX=0; gallery.addEventListener("touchstart",e=>touchStartX=e.changedTouches[0].clientX,{passive:true}); gallery.addEventListener("touchend",e=>{const delta=e.changedTouches[0].clientX-touchStartX;if(Math.abs(delta)>45)setImage(current+(delta<0?1:-1),delta<0?1:-1);},{passive:true});

    const actionTarget=container.querySelector(".property-heading");
    if(actionTarget&&!container.querySelector(".leaseaccom-extra-actions")){
      const actions=document.createElement("div");actions.className="leaseaccom-extra-actions";actions.innerHTML=`<button type="button" class="leaseaccom-secondary-btn" id="leaseaccomShareBtn"><i class="bx bx-share-alt"></i> Share</button><button type="button" class="leaseaccom-secondary-btn" id="leaseaccomWhatsAppBtn"><i class="bx bxl-whatsapp"></i> Chat owner on WhatsApp</button>`;actionTarget.insertAdjacentElement("afterend",actions);
      const phone=property.ownerPhone||property.whatsapp||property.phone,wa=actions.querySelector("#leaseaccomWhatsAppBtn");
      if(!phone)wa.hidden=true;else wa.addEventListener("click",()=>{const clean=String(phone).replace(/\D/g,"");const intl=clean.startsWith("0")?"234"+clean.slice(1):clean;window.open(`https://wa.me/${intl}?text=${encodeURIComponent(`Hello, I'm interested in ${property.title} on LeaseAccom.`)}`,"_blank","noopener");});
      actions.querySelector("#leaseaccomShareBtn").addEventListener("click",async()=>{try{if(navigator.share)await navigator.share({title:property.title,text:`View ${property.title} on LeaseAccom`,url:location.href});else{await navigator.clipboard.writeText(location.href);leaseaccomToast("Property link copied");}}catch{}});
    }
});
