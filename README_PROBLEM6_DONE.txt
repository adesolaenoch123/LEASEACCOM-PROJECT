Problem 6 finish pack
=====================
API verified live:
  https://leaseaccom-api.onrender.com/health
  → {"status":"ok","service":"leaseaccom-backend","environment":"production"}

1. Copy JS/config.js and JS/api-client.js into your repo JS/ folder
2. Copy any updated HTML files (they load config.js before api-client)
3. git add + commit + push to main
4. Wait for GitHub Pages (~1-2 min)
5. On the live site, open browser console and run:
   fetch(window.LEASEACCOM_API_URL + '/health').then(r=>r.json()).then(console.log)

CORS: ensure Render env CORS_ORIGINS includes:
  https://adesolaenoch123.github.io,https://adesolaenoch123.github.io/LEASE-HUB-PROJECT
