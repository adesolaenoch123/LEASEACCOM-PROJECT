# LeaseAccom PWA — Install on your phone today

## Files in this package
- `manifest.json` — app name, colours, icons
- `sw.js` — service worker (network-first for pages so updates appear)
- `index.html` — already wired with the manifest link + service worker registration

## How to install on your phone

### Android (Chrome)
1. Deploy these files to your live site (GitHub Pages or your domain).
2. Open the site in Chrome on your phone.
3. Tap the menu (⋮) → **Add to Home screen** or **Install app**.
4. Confirm. The LeaseAccom icon will appear on your home screen.

### iPhone (Safari)
1. Open the site in Safari.
2. Tap the Share button → **Add to Home Screen**.
3. Name it LeaseAccom and add.

## Will updates show in the installed app?
**Yes.**  
The service worker is set to **network-first for HTML pages**.  
When you change and deploy your website:
- Open the installed app
- Pull to refresh or just navigate
- The new version loads from the server

Static files (CSS/JS) are cached but will update when the browser detects a change or you clear the app cache once.

## Tips
- Make sure `manifest.json` and `sw.js` are in the **root** of your live site (same folder as `index.html`).
- Icons currently point to your existing SVG logos. For a sharper home-screen icon later you can add a 192×192 and 512×512 PNG.
- After deploying, visit the site once in the browser so the service worker installs, then add to home screen.

That’s it — you can install it today and future website updates will appear in the app.
