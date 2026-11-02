# LeaseAccom

Formerly leaseaccom — refined toward the three-experience platform plan.

## Structure (shared app, three experiences)

| Experience | Entry | Purpose |
|------------|--------|---------|
| **Tenant** | `index.html`, `properties.html`, `tenant-dashboard.html` | Discover, book, rent |
| **Owner** | `owner-dashboard.html`, `add-property.html` | Listings and property business |
| **Admin** | `admin/admin.html` | Company operations (staff only) |

## Brand

- Name: **LeaseAccom**
- Colours: green `#0d7547` / `#15945c`, black `#101311`, white, soft green `#e9f7ef`
- Logos: `IMAGES/leaseaccom-logo-full.png` (desktop wordmark), `IMAGES/leaseaccom-logo-icon.png` (mobile icon)

## Mobile

- Bottom nav on tenant/public pages (Home · Properties · Messages · Profile)
- Touch-friendly controls and safe-area padding

## Install LeaseAccom on a phone

The homepage includes the PWA manifest, platform icons, service-worker registration, and an Android/Chromium install button. To publish it with GitHub Pages:

1. Push the repository to GitHub.
2. In the repository, open **Settings → Pages** and deploy from the `main` branch, repository root.
3. Open the published HTTPS site on the phone and allow a few seconds for the service worker to install.
4. On Android/Chrome, tap **Install app** when it appears, or use the browser menu. On iPhone/iPad, open the site in Safari, tap **Share → Add to Home Screen**.

The PWA uses relative URLs so it works from the GitHub project-pages path as well as a custom domain. A GitHub Pages HTTPS URL is required for installation; pushing code alone does not publish/enable Pages.

## Local storage keys

Session keys remain `leaseaccomCurrentUser` (and legacy mirrors) so existing browser data still works. UI copy shows LeaseAccom.

## Do not commit

`.env`, service role keys, or private documents.
