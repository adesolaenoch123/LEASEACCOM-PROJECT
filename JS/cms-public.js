(function(){
  'use strict';
  const fallback={heroTitle:'Find your place without the unnecessary stress.',heroSubtitle:'Search verified properties across Nigeria.',heroButton:'Explore Properties',heroImage:'',footerText:'Find your place without the unnecessary stress.'};
  let content;try{content={...fallback,...JSON.parse(localStorage.getItem('leaseaccomCmsPublished')||'{}')}}catch(e){content=fallback}
  const hero=document.querySelector('.hero');
  const title=document.querySelector('.hero h1');
  const subtitle=document.querySelector('.hero-content > p');
  const footer=document.querySelector('.footer-main > div:first-child > p');
  if(title&&content.heroTitle) title.innerHTML=content.heroTitle.split(/(?<=\.)\s+/).map((part,i)=>i?`<span>${escapeHtml(part)}</span>`:escapeHtml(part)).join(' ');
  if(subtitle&&content.heroSubtitle) subtitle.textContent=content.heroSubtitle;
  if(footer&&content.footerText) footer.textContent=content.footerText;
  if(hero&&content.heroImage){hero.style.backgroundImage=`linear-gradient(90deg,rgba(8,28,18,.66),rgba(8,28,18,.12)),url("${content.heroImage.replace(/["\\]/g,'')}")`;hero.style.backgroundSize='cover';hero.style.backgroundPosition='center'}
  function escapeHtml(value){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}
})();
