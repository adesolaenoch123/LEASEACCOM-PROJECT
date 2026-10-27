/* LeaseAccom rental application data helper — frontend only */
window.LeaseAccomApplications = {
    key: "rentalApplications",
    all() {
        try { const v=JSON.parse(localStorage.getItem(this.key)||"[]"); return Array.isArray(v)?v:[]; }
        catch { return []; }
    },
    findById(id) { return this.all().find(a=>String(a.id)===String(id))||null; },
    statusLabel(status) {
        const s=String(status||"pending").toLowerCase();
        return s==="accepted"?"Accepted":s==="rejected"?"Rejected":s==="under review"?"Under Review":"Submitted";
    }
};
