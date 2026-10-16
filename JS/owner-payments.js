/**
 * Owner Payments page — demo UI only (no real charges).
 */
(function () {
  const BANK_KEY = 'leaseaccom_owner_payout_bank_v1';
  const SAMPLE_KEY = 'leaseaccom_owner_pay_sample_v1';

  const sampleRows = [
    { date: '2026-09-28', desc: 'Rent collection', property: 'Lekki 2BED Apartment', type: 'in', status: 'Cleared', amount: 850000 },
    { date: '2026-09-22', desc: 'Security deposit', property: 'Yaba Studio', type: 'in', status: 'Pending', amount: 200000 },
    { date: '2026-09-18', desc: 'Payout to bank', property: '—', type: 'out', status: 'Paid', amount: -500000 },
    { date: '2026-09-10', desc: 'Rent collection', property: 'Ikeja Duplex', type: 'in', status: 'Cleared', amount: 1200000 },
    { date: '2026-09-02', desc: 'Platform fee', property: 'Lekki 2BED Apartment', type: 'out', status: 'Paid', amount: -25500 }
  ];

  function loadBank() {
    try { return JSON.parse(localStorage.getItem(BANK_KEY) || '{}') || {}; } catch { return {}; }
  }
  function saveBank(data) {
    localStorage.setItem(BANK_KEY, JSON.stringify(data));
  }

  function formatNaira(n) {
    const v = Number(n) || 0;
    const sign = v < 0 ? '-' : '';
    return sign + '₦' + Math.abs(v).toLocaleString();
  }

  function renderBank() {
    const b = loadBank();
    document.getElementById('payBankName').textContent = b.bank || 'Not set';
    document.getElementById('payAccountName').textContent = b.name || '—';
    document.getElementById('payAccountNumber').textContent = b.number
      ? String(b.number).replace(/.(?=.{4})/g, '•')
      : '••••';
    const bi = document.getElementById('payBankNameInput');
    const ni = document.getElementById('payAccountNameInput');
    const ai = document.getElementById('payAccountNumberInput');
    if (bi) bi.value = b.bank || '';
    if (ni) ni.value = b.name || '';
    if (ai) ai.value = b.number || '';
  }

  function renderTable(filter) {
    const body = document.getElementById('payTableBody');
    if (!body) return;
    const useSample = localStorage.getItem(SAMPLE_KEY) === '1';
    let rows = useSample ? sampleRows.slice() : [];
    if (filter === 'in') rows = rows.filter((r) => r.type === 'in');
    if (filter === 'out') rows = rows.filter((r) => r.type === 'out');

    if (!rows.length) {
      body.innerHTML = `<tr class="pay-empty-row"><td colspan="6">
        <div class="dashboard-empty small-empty" style="border:0;padding:28px 10px">
          <div><i class="bx bx-receipt"></i></div>
          <h3>No transactions yet</h3>
          <p>When payments go live, rent collections and withdrawals will appear here.</p>
        </div></td></tr>`;
      updateKpis([]);
      return;
    }

    body.innerHTML = rows.map((r) => `
      <tr data-type="${r.type}">
        <td>${r.date}</td>
        <td>${r.desc}</td>
        <td>${r.property}</td>
        <td><span class="pay-type ${r.type}">${r.type === 'in' ? 'Incoming' : 'Payout'}</span></td>
        <td><span class="pay-status ${String(r.status).toLowerCase()}">${r.status}</span></td>
        <td class="${r.amount < 0 ? 'is-out' : 'is-in'}">${formatNaira(r.amount)}</td>
      </tr>`).join('');
    updateKpis(useSample ? sampleRows : []);
  }

  function updateKpis(rows) {
    const clearedIn = rows.filter((r) => r.type === 'in' && r.status === 'Cleared').reduce((s, r) => s + r.amount, 0);
    const pendingIn = rows.filter((r) => r.type === 'in' && r.status === 'Pending').reduce((s, r) => s + r.amount, 0);
    const out = rows.filter((r) => r.type === 'out').reduce((s, r) => s + Math.abs(r.amount), 0);
    const available = Math.max(0, clearedIn - out);
    const month = rows.filter((r) => r.type === 'in').reduce((s, r) => s + r.amount, 0);
    const lifetime = clearedIn;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = formatNaira(v); };
    set('payBalance', available);
    set('payPending', pendingIn);
    set('payMonth', month);
    set('payLifetime', lifetime);
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderBank();
    const sampleOn = localStorage.getItem(SAMPLE_KEY) === '1';
    const toggle = document.getElementById('paySampleToggle');
    if (toggle) toggle.checked = sampleOn;
    renderTable('all');

    document.getElementById('payEditBankBtn')?.addEventListener('click', () => {
      document.getElementById('payBankCard').hidden = true;
      document.getElementById('payBankForm').hidden = false;
    });
    document.getElementById('payBankCancel')?.addEventListener('click', () => {
      document.getElementById('payBankForm').hidden = true;
      document.getElementById('payBankCard').hidden = false;
    });
    document.getElementById('payBankForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      saveBank({
        bank: document.getElementById('payBankNameInput').value.trim(),
        name: document.getElementById('payAccountNameInput').value.trim(),
        number: document.getElementById('payAccountNumberInput').value.trim()
      });
      renderBank();
      document.getElementById('payBankForm').hidden = true;
      document.getElementById('payBankCard').hidden = false;
      alert('Payout method saved on this device (demo only).');
    });

    document.querySelectorAll('[data-pay-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-pay-filter]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        renderTable(btn.getAttribute('data-pay-filter'));
      });
    });

    toggle?.addEventListener('change', () => {
      localStorage.setItem(SAMPLE_KEY, toggle.checked ? '1' : '0');
      const active = document.querySelector('[data-pay-filter].is-active')?.getAttribute('data-pay-filter') || 'all';
      renderTable(active);
    });

    document.getElementById('payWithdrawBtn')?.addEventListener('click', () => {
      alert('Withdrawals are not live yet. This button stays disabled until a payment provider is connected.');
    });
  });
})();
