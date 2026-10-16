# LeaseAccom API — production deploy (problem 6)

Your FastAPI app already lives in `ai-backend/`.  
GitHub Pages cannot run Python. Host this API on **Render** (easiest free tier) or Railway.

## 1. Deploy on Render (recommended)

1. Go to https://render.com → New → Web Service  
2. Connect GitHub repo `adesolaenoch123/LEASE-HUB-PROJECT`  
3. Settings:
   - **Root Directory:** `ai-backend`
   - **Runtime:** Python  
   - **Build:** `pip install -r requirements.txt`
   - **Start:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Health check path:** `/health`
4. Environment variables (Dashboard → Environment):

```
APP_ENV=production
ALLOW_DEMO_AUTH=false
APP_NAME=LeaseAccom API
SUPABASE_URL=https://jxbraodoqfwagefsynlc.supabase.co
SUPABASE_ANON_KEY=<same publishable/anon key as frontend>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase → Settings → API → service_role — SECRET>
CORS_ORIGINS=https://adesolaenoch123.github.io,http://localhost:5500,http://127.0.0.1:5500
```

Use origins only in `CORS_ORIGINS` (scheme, host, and optional port); do not include the GitHub Pages repository path.

5. Deploy → copy URL, e.g. `https://leaseaccom-api.onrender.com`

6. Test:

```bash
curl https://YOUR-API.onrender.com/health
```

Should return JSON with status ok.

## 2. Point the frontend at the API

In the **project root** (GitHub Pages), create/update `JS/config.js`:

```js
window.LEASEACCOM_API_URL = "https://YOUR-API.onrender.com";
```

Load it **before** `api-client.js` on pages that need the API (already wired in this pack for main pages).

## 3. Local run (optional)

```bash
cd ai-backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edit .env with real keys
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

## 4. Free-tier note

Render free services **sleep** after idle time. First request after sleep can take 30–60s. That is normal.
