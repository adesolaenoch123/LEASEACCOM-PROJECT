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
- Logos: `IMAGES/leaseaccom-logo.svg` (stacked), `IMAGES/leaseaccom-logo-horizontal.svg` (navbar)

## Mobile

- Bottom nav on tenant/public pages (Home · Properties · Messages · Profile)
- Touch-friendly controls and safe-area padding

## Local storage keys

Session keys remain `leaseaccomCurrentUser` (and legacy mirrors) so existing browser data still works. UI copy shows LeaseAccom.

## Do not commit

`.env`, service role keys, or private documents.
