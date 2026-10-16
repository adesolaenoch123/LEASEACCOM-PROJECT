# LeaseAccom Backend Setup

## Supabase

1. Use the same Supabase project configured in `JS/supabase-client.js` for the frontend and backend.
2. For the current unified schema, review and apply the root `migrations/001_leaseaccom_core.sql` in the Supabase SQL Editor. It creates the tables used by the current API and frontend and keeps property IDs as text to match the existing schema.
3. Do not apply `ai-backend/migrations/001_applications.sql`, `002_properties.sql`, or `003_property_images.sql` on top of that schema. They are an older split schema with overlapping tables and an incompatible `images` column type. If any of them have already been applied, inspect and reconcile the existing schema before proceeding; do not blindly run the root migration.
	 If the root migration was already applied to pre-existing tables, run this additive update for columns the original table definitions may have skipped:

	 ```sql
	 alter table public.profiles
		 add column if not exists verification_status text not null default 'unverified'
			 check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
		 add column if not exists avatar_url text,
		 add column if not exists updated_at timestamptz not null default now();

	 alter table public.applications
		 add column if not exists occupants integer not null default 1 check (occupants > 0),
		 add column if not exists stay_length text,
		 add column if not exists income_range text;

	 alter table public.agreements
		 add column if not exists application_id uuid references public.applications(id) on delete cascade,
		 add column if not exists property_period text not null default 'year',
		 add column if not exists owner_agreed boolean not null default false,
		 add column if not exists tenant_agreed boolean not null default false,
		 add column if not exists owner_agreed_at timestamptz,
		 add column if not exists tenant_agreed_at timestamptz;

	 create unique index if not exists agreements_application_id_idx
		 on public.agreements(application_id)
		 where application_id is not null;

	 do $$
	 begin
		 if not exists (
			 select 1 from pg_constraint
			 where conname = 'profiles_verification_status_check'
				 and conrelid = 'public.profiles'::regclass
		 ) then
			 alter table public.profiles
				 add constraint profiles_verification_status_check
				 check (verification_status in ('unverified', 'pending', 'verified', 'rejected'));
		 end if;
	 end;
	 $$;
	 ```

4. Approved listings must exist in `public.properties`; listing IDs submitted by the frontend must match these rows, and owner IDs must be Supabase Auth user IDs. Public listings require at least four images and a description of at least 40 characters.
5. Create `ai-backend/.env` from `.env.example`. Set the project URL, anon key, and service-role key. Keep the service-role key only on the server; never put the service-role key in frontend JavaScript or a tracked file.
6. Keep `ALLOW_DEMO_AUTH=false` except for isolated local tests. Admin authorization comes only from trusted Supabase `app_metadata.role`; never set it from a user-editable profile field.

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
<script>window.LEASEACCOM_API_URL = "https://your-api.example.com";</script>
<script src="JS/api-client.js"></script>
```

Do not deploy until the Supabase schema and approved property rows have been migrated. Applications require an approved property in `public.properties`; the backend derives the owner from that record rather than trusting a browser-supplied owner ID.
