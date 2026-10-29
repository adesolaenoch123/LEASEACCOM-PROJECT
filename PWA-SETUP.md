# LeaseAccom — Capacitor / PWA shell (minimal)

This is a lightweight starter so you can later turn the live site into an installable app.

## Files added
- `manifest.json` — PWA manifest (theme color green)
- `sw.js` — minimal service worker (caches a few core files)

## How to enable PWA on your live site
1. Upload `manifest.json` and `sw.js` to the root of your GitHub Pages / live site.
2. In `index.html` (inside `<head>`) add:
   ```html
   <link rel="manifest" href="manifest.json">
   <meta name="theme-color" content="#0d7547">
   ```
3. At the bottom of `index.html` (before `</body>`) add:
   ```html
   <script>
   if ("serviceWorker" in navigator) {
     navigator.serviceWorker.register("/sw.js").catch(function(){});
   }
   </script>
   ```
4. Deploy. On Android Chrome you can “Add to Home screen”. On iOS use Share → Add to Home Screen.

## Capacitor (later, for real APK)
When you are ready for a proper app store build:
1. Install Node.js
2. `npm install -g @capacitor/cli`
3. In a new folder: `npx cap init LeaseAccom com.leaseaccom.app --web-dir=www`
4. Copy your live site files into `www/` or point the webDir at a build.
5. `npx cap add android`
6. `npx cap open android` → build APK in Android Studio.

The PWA route above is enough for testing on your phone right now without a full native rebuild.
