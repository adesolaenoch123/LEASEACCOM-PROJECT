(function () {
  "use strict";
  const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  function addWidget() {
    if (document.getElementById("adminAiPanel")) return;
    const root = document.createElement("section"); root.id = "adminAiPanel"; root.className = "admin-ai-panel";
    root.innerHTML = '<button type="button" class="admin-ai-toggle" id="adminAiToggle" aria-expanded="false">✦ Admin AI <span>Ask about your dashboard</span></button><div class="admin-ai-window" id="adminAiWindow" hidden><header><strong>LeaseAccom Admin Assistant</strong><button type="button" id="adminAiClose" aria-label="Close">×</button></header><div class="admin-ai-messages" id="adminAiMessages" aria-live="polite"><p class="admin-ai-welcome">Ask me to find records, review activity, detect duplicates, check overdue work, prepare drafts, or report trends.</p></div><form id="adminAiForm"><input id="adminAiInput" autocomplete="off" maxlength="4000" placeholder="Message your admin assistant…" required><button type="submit">Send</button></form><div class="admin-ai-hint">Changes are previewed first. You confirm before anything is changed.</div></div>';
    document.body.appendChild(root);
    const toggle=document.getElementById("adminAiToggle"), panel=document.getElementById("adminAiWindow");
    toggle.addEventListener("click",()=>{panel.hidden=!panel.hidden;toggle.setAttribute("aria-expanded",String(!panel.hidden));if(!panel.hidden)document.getElementById("adminAiInput").focus();});
    document.getElementById("adminAiClose").addEventListener("click",()=>{panel.hidden=true;toggle.setAttribute("aria-expanded","false");});
    document.getElementById("adminAiForm").addEventListener("submit",send);
  }
  function addMessage(text, who) { const box=document.getElementById("adminAiMessages");const p=document.createElement("p");p.className="admin-ai-message "+who;p.textContent=text;box.appendChild(p);box.scrollTop=box.scrollHeight;return p; }
  function asText(data) { if (data == null) return ""; if (typeof data === "string") return data; return JSON.stringify(data,null,2); }
  async function send(event) {
    event.preventDefault(); const input=document.getElementById("adminAiInput"), message=input.value.trim(); if(!message)return; input.value="";addMessage(message,"user");const pending=addMessage("Checking the admin dashboard…","assistant");
    try {
      const result=await window.LeaseAccomApi.request("/admin/assistant/chat",{method:"POST",body:{message}}); pending.remove();addMessage(result.response||"Done.","assistant");
      if(result.data!==undefined) addMessage(asText(result.data),"data");
      if (result.draft) addMessage(`DRAFT (not sent)\n${result.draft.subject}\n\n${result.draft.body}`, "data");
      if(result.suggested_rule) addRule(result.suggested_rule);
      if(result.proposed_operation && result.confirmation_required) addConfirm(result.proposed_operation);
    } catch(error) { pending.textContent=error.message||"Could not reach the admin assistant."; }
  }
  function addConfirm(proposal) { const box=document.getElementById("adminAiMessages");const wrap=document.createElement("div");wrap.className="admin-ai-confirm";wrap.innerHTML='<p>Review bulk action: '+esc(proposal.record_ids.length)+' listing(s) → '+esc(proposal.status)+'.</p><button type="button">Confirm this action</button>';wrap.querySelector("button").addEventListener("click",async()=>{if(!window.confirm("Apply this change to the listed records?"))return;const b=wrap.querySelector("button");b.disabled=true;try{const res=await window.LeaseAccomApi.request("/admin/assistant/confirm",{method:"POST",body:{...proposal,confirmed:true}});wrap.textContent="Action completed: "+res.updated+" record(s) changed. This was recorded in the audit log.";}catch(e){wrap.textContent=e.message;} });box.appendChild(wrap);box.scrollTop=box.scrollHeight; }
  function addRule(rule) { const box=document.getElementById("adminAiMessages");const wrap=document.createElement("div");wrap.className="admin-ai-confirm";wrap.innerHTML='<p>Save suggested reminder: '+esc(rule.name)+'</p><button type="button">Save workflow rule</button>';wrap.querySelector("button").addEventListener("click",async()=>{try{const res=await window.LeaseAccomApi.request("/admin/assistant/workflows",{method:"POST",body:rule});wrap.textContent=res.message;}catch(e){wrap.textContent=e.message;}});box.appendChild(wrap); }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",addWidget);else addWidget();
})();
