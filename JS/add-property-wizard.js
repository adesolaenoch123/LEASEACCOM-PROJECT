/**
 * Multi-step Add Property wizard + live listing preview.
 */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('addPropertyForm');
  if (!form) return;

  const sections = Array.from(form.querySelectorAll('.form-section'));
  if (sections.length < 2) return;

  // Progress bar
  const bar = document.createElement('div');
  bar.className = 'leaseaccom-wizard-bar';
  bar.innerHTML = sections
    .map((_, i) => `<button type="button" data-step="${i}">${i + 1}</button>`)
    .join('');
  form.parentNode.insertBefore(bar, form);

  // Live preview panel
  let preview = document.getElementById('addPropertyLivePreview');
  if (!preview) {
    preview = document.createElement('aside');
    preview.id = 'addPropertyLivePreview';
    preview.className = 'add-property-live-preview owner-panel';
    preview.innerHTML = `
      <div class="owner-panel-head"><span>LIVE PREVIEW</span></div>
      <div class="live-listing-card">
        <div class="live-listing-image" id="livePrevImage">No photo yet</div>
        <div class="live-listing-body">
          <strong id="livePrevTitle">Property title</strong>
          <p id="livePrevMeta">Type · City</p>
          <div class="live-listing-price" id="livePrevPrice">₦0</div>
          <p id="livePrevDesc" class="owner-muted">Description preview…</p>
        </div>
      </div>`;
    const layout = document.querySelector('.add-property-layout');
    if (layout) layout.appendChild(preview);
    else form.parentNode.appendChild(preview);
  }

  const controls = document.createElement('div');
  controls.className = 'leaseaccom-wizard-controls';
  controls.innerHTML = `
    <button type="button" class="leaseaccom-secondary-btn" id="wizardBack"><i class="bx bx-arrow-back"></i> Back</button>
    <span id="wizardStepLabel">Step 1 of ${sections.length}</span>
    <button type="button" class="primary-btn" id="wizardNext">Next <i class="bx bx-arrow-right"></i></button>`;
  form.appendChild(controls);

  let current = 0;

  function validCurrent() {
    let ok = true;
    sections[current].querySelectorAll('input,select,textarea').forEach((el) => {
      if (el.hasAttribute('required') && !el.checkValidity()) {
        el.reportValidity();
        ok = false;
      }
    });
    return ok;
  }

  function render() {
    sections.forEach((s, i) => s.classList.toggle('wizard-hidden', i !== current));
    bar.querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', i === current));
    document.getElementById('wizardStepLabel').textContent = `Step ${current + 1} of ${sections.length}`;
    document.getElementById('wizardBack').disabled = current === 0;
    const submitBox = form.querySelector('.form-submit');
    if (submitBox) submitBox.style.display = current === sections.length - 1 ? 'flex' : 'none';
    const next = document.getElementById('wizardNext');
    next.innerHTML =
      current === sections.length - 1
        ? `Submit property <i class="bx bx-check"></i>`
        : `Next <i class="bx bx-arrow-right"></i>`;
    updatePreview();
  }

  function updatePreview() {
    const title = document.getElementById('propertyTitle')?.value || 'Property title';
    const type = document.getElementById('propertyType')?.value || 'Type';
    const city = document.getElementById('propertyCity')?.value || 'City';
    const price = document.getElementById('propertyPrice')?.value;
    const period = document.getElementById('propertyPeriod')?.value || '';
    const desc = document.getElementById('propertyDescription')?.value || 'Description preview…';
    const t = document.getElementById('livePrevTitle');
    const m = document.getElementById('livePrevMeta');
    const p = document.getElementById('livePrevPrice');
    const d = document.getElementById('livePrevDesc');
    if (t) t.textContent = title;
    if (m) m.textContent = `${type} · ${city}`;
    if (p) p.textContent = price ? `₦${Number(price).toLocaleString()} ${period}` : '₦0';
    if (d) d.textContent = desc.slice(0, 140) + (desc.length > 140 ? '…' : '');
  }

  document.getElementById('wizardBack').onclick = () => {
    if (current > 0) {
      current--;
      render();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  document.getElementById('wizardNext').onclick = () => {
    if (current < sections.length - 1) {
      if (!validCurrent()) return;
      current++;
      render();
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      if (validCurrent()) form.requestSubmit();
    }
  };
  bar.querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      const target = Number(b.dataset.step);
      if (target <= current || validCurrent()) {
        current = target;
        render();
      }
    })
  );

  ['propertyTitle', 'propertyType', 'propertyCity', 'propertyPrice', 'propertyPeriod', 'propertyDescription'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updatePreview);
    document.getElementById(id)?.addEventListener('change', updatePreview);
  });

  render();
});
