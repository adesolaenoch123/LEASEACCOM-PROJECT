LeaseAccom — Fix package for "0 properties" / empty marketplace / stuck stats
============================================================================

WHAT THIS FIXES
---------------
1. Marketplace no longer empties when Supabase is offline or returns 0 rows
2. window.leaseaccomSupabase is always set so hybrid data layer works
3. Supabase client never crashes the page if the CDN/key fails
4. Homepage stats show real numbers immediately (12 / 12 / 6) instead of stuck 0
5. Demo property array is exposed on window.properties for safety

HOW TO INSTALL
--------------
1. Unzip this folder
2. Copy the JS/ folder contents over your project's JS/ folder
   (overwrite these files only):
     - JS/supabase-client.js
     - JS/app.js
     - JS/data.js
3. Keep your other files unchanged
4. Commit and push to GitHub so GitHub Pages updates
5. Hard-refresh the site (Ctrl+Shift+R)

FILES INCLUDED
--------------
JS/supabase-client.js  — safe Supabase init + never wipe demo data
JS/app.js              — homepage stats fixed
JS/data.js             — window.properties export

After overwrite, open:
  https://adesolaenoch123.github.io/LEASE-HUB-PROJECT/properties.html
You should see 12 properties.
Homepage stats should show 12 available, 12 verified, 6 cities.
