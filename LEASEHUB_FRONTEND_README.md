# LeaseAccom — Frontend Public Beta Polish

This build is a frontend-only enhancement of the existing LeaseAccom project.

## Main user journey
Search → Verify → Chat → View → Apply → Agree → Pay → Move in → Review

## Added / completed
- Responsive Apply to Rent modal with close, back and Escape support.
- Property gallery with thumbnails, fullscreen lightbox and mobile swipe.
- Saved properties page using the existing `savedProperties` localStorage key.
- Compare page using the existing `compareProperties` key, limited to 3.
- Recently viewed compatibility preserved through `leaseaccomRecentlyViewed`.
- Shortlets page.
- Commercial page.
- Student Housing page.
- Hotels & Lodges page.
- Student and hotel demonstration listings in `JS/data.js`.
- Add Property multi-step wizard layered on top of the existing form.
- Tenant application status tracker.
- Boxicons-based UI for the new/updated interface.
- Responsive mobile navigation improvements.
- Loading, staggered card entrance and save interactions.
- Additional city map coverage.
- SEO titles/descriptions on major pages.
- Accessible modal keyboard handling and focus outlines.

## Frontend-only limitations
The following are intentionally not represented as real backend functionality:
- Authentication/database
- Real payment escrow or settlement
- Cloudinary/image hosting
- KYC/identity verification
- Fraud detection
- AI ranking/recommendations
- Email/SMS/push notifications
- Legal enforceability of rental agreements

The current localStorage architecture remains so the frontend can be migrated later to Supabase or Firebase.

## Manual browser checks
1. Open `properties.html`.
2. Open a property.
3. Click Apply to Rent.
4. Verify the modal is centered, scrollable and has X / Back / Escape behavior.
5. Submit an application while logged in as a tenant.
6. Check `tenant-dashboard.html` for application status.
7. Log in as an owner and check owner dashboard/application flow.
8. Open `shortlets.html`, `commercial.html`, `student-housing.html`, and `hotels.html`.
9. Test Save and Compare.
10. Test mobile widths around 390px and 360px.

## Private Admin Portal
A new `admin/` folder contains the LeaseAccom staff portal. It includes dashboard, users, properties, verification, applications, viewings, payments, reports, messages, staff roles, audit log and settings views. `admin/index.html` is the entry point and links back to the public app. The included staff access list is FRONTEND DEMO ONLY: do not treat it as secure authentication. Before public deployment, move credentials and role enforcement to Supabase/Firebase/backend authentication and never ship real secrets in JavaScript.

## Latest UI Fix Pass
- Restored the original homepage hero headline markup; no per-word splitting is used.
- Consolidated mobile navigation so only one controller handles the hamburger menu.
- Added stable mobile open/close, outside-click and Escape handling.
- Reworked hero entrance animation to animate the existing badge/headline/paragraph/search/buttons without changing their layout.
- Added IntersectionObserver-based scroll reveals and short staggered card entrances.
- Kept reduced-motion support.
- Restored normal How It Works typography after an accidental tiny-text override.
