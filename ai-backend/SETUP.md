# LeaseHub Backend Setup

## Supabase

1. Use the same Supabase project configured in `JS/supabase-client.js` for the frontend and backend.
2. In the Supabase SQL Editor, run `migrations/001_applications.sql` if it has not already been run.
3. Run `migrations/002_properties.sql`. It creates `public.properties`, enables its access policies, and links applications to listings. If the project already has properties or applications, review and reconcile existing rows before validating the new foreign key.
4. Run `migrations/003_property_images.sql` to add the multiple-photo field to an existing properties table. Fresh installations already get that field from migration 002.
5. Approved listings must exist in `public.properties`; listing IDs submitted by the frontend must match these rows, and owner IDs must be Supabase Auth user IDs. Public listings require at least four images and a description of at least 40 characters.
6. Create `ai-backend/.env` from `.env.example`. Set the project URL, anon key, and service-role key. Keep the service-role key only on the server; never put it in frontend JavaScript or a tracked file.
7. Keep `ALLOW_DEMO_AUTH=false` except for isolated local tests. Admin authorization comes only from trusted Supabase `app_metadata.role`; never set it from a user-editable profile field.

## Local Development

From PowerShell in `ai-backend`:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Serve the frontend on `localhost` or `127.0.0.1` during local development. The API client uses `http://127.0.0.1:8000` on those hosts.

## Deployment

Deploy the FastAPI service at an HTTPS URL. Set `CORS_ORIGINS` to the exact frontend origins. Before loading `JS/api-client.js`, configure the production API URL:

```html
<script>window.LEASEHUB_API_URL = "https://your-api.example.com";</script>
<script src="JS/api-client.js"></script>
```

Do not deploy until the Supabase schema and approved property rows have been migrated. Applications require an approved property in `public.properties`; the backend derives the owner from that record rather than trusting a browser-supplied owner ID.
