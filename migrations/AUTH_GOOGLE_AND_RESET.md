# LeaseAccom — Google login + password recovery

## 1. Password recovery (dashboard)

Supabase → **Authentication** → **URL configuration**

Add **Redirect URLs**:
- `http://localhost:5500/reset-password.html` (or your local port)
- `https://YOUR_GITHUB_PAGES_OR_DOMAIN/reset-password.html`
- `https://YOUR_DOMAIN/auth-callback.html`

**Site URL**: your live site root.

Email templates: Authentication → Email Templates → **Reset password** (optional branding).

If you hit **email rate limit exceeded**, wait ~1 hour or set password under Authentication → Users.

## 2. Google provider

1. Supabase → **Authentication** → **Providers** → **Google** → Enable  
2. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Application type: Web  
   - Authorized redirect URI: copy from Supabase Google provider screen  
     (looks like `https://jxbraodoqfwagefsynlc.supabase.co/auth/v1/callback`)
3. Paste **Client ID** and **Client Secret** into Supabase Google settings → Save  

## 3. Pages added

| Page | Purpose |
|------|---------|
| `forgot-password.html` | Request recovery email |
| `reset-password.html` | Set new password from email link |
| `auth-callback.html` | After Google — role (tenant/owner) + optional password |

Login/register: **Forgot password?** + **Continue with Google**.

## 4. Remaining Supabase (production)

Still to finish after auth:
- Viewings + applications cloud-only
- Messages + notifications cloud
- Owner verification docs → verification-docs bucket
- Paystack webhooks → payments/subscriptions
- Admin queues reading live tables
