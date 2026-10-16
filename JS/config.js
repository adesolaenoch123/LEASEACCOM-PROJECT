/**
 * LeaseAccom frontend → Render API
 * https://leaseaccom-api.onrender.com
 */
const isLocalLeaseAccomHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
window.LEASEACCOM_API_URL = isLocalLeaseAccomHost
	? "http://127.0.0.1:8000"
	: "https://leaseaccom-api.onrender.com";
