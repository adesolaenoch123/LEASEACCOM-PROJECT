/** Owner payments page. Displays cloud-backed payout details and real transactions only. */
(function () {
  let bank = {};

  function formatNaira(value) {
    const n = Number(value) || 0;
    return (n < 0 ? "-" : "") + "₦" + Math.abs(n).toLocaleString("en-NG");
  }

  async function renderBank() {
    const response = await window.LeaseAccomCloud?.getPayoutAccount?.();
    bank = response?.ok && response.data ? {
      bank: response.data.bank_name,
      name: response.data.account_name,
      number: response.data.account_number
    } : {};
    const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    setText("payBankName", bank.bank || "Not set");
    setText("payAccountName", bank.name || "—");
    setText("payAccountNumber", bank.number ? String(bank.number).replace(/.(?=.{4})/g, "•") : "••••");
    const values = [["payBankNameInput", bank.bank], ["payAccountNameInput", bank.name], ["payAccountNumberInput", bank.number]];
    values.forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.value = value || ""; });
  }

  function renderEmptyTable() {
    const body = document.getElementById("payTableBody");
    if (!body) return;
    body.innerHTML = `<tr class="pay-empty-row"><td colspan="6"><div class="dashboard-empty small-empty" style="border:0;padding:28px 10px"><div><i class="bx bx-receipt"></i></div><h3>No transactions yet</h3><p>Completed payments will appear here.</p></div></td></tr>`;
    ["payBalance", "payPending", "payMonth", "payLifetime"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = formatNaira(0);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderBank();
    renderEmptyTable();
    const toggle = document.getElementById("paySampleToggle");
    if (toggle) { toggle.checked = false; toggle.hidden = true; }
    document.getElementById("payEditBankBtn")?.addEventListener("click", () => {
      document.getElementById("payBankCard").hidden = true;
      document.getElementById("payBankForm").hidden = false;
    });
    document.getElementById("payBankCancel")?.addEventListener("click", () => {
      document.getElementById("payBankForm").hidden = true;
      document.getElementById("payBankCard").hidden = false;
    });
    document.getElementById("payBankForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const result = await window.LeaseAccomCloud?.savePayoutAccount?.({
        bank: document.getElementById("payBankNameInput").value.trim(),
        name: document.getElementById("payAccountNameInput").value.trim(),
        number: document.getElementById("payAccountNumberInput").value.trim()
      });
      if (!result?.ok) { alert(result?.error || "Could not save payout details to your account."); return; }
      await renderBank();
      document.getElementById("payBankForm").hidden = true;
      document.getElementById("payBankCard").hidden = false;
      alert("Payout details saved to your account.");
    });
    document.querySelectorAll("[data-pay-filter]").forEach((button) => button.addEventListener("click", () => {
      document.querySelectorAll("[data-pay-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
      renderEmptyTable();
    }));
    document.getElementById("payWithdrawBtn")?.addEventListener("click", () => alert("Withdrawals are not live yet."));
  });
})();
