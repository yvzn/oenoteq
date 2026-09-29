# 02: PWA installable app shell with offline static-asset caching

**What to build:** the app installs to a phone's home screen and opens in standalone mode (no browser chrome), and the static app shell (HTML/JS/CSS/icons) loads with zero network connectivity. No data-layer changes in this ticket — this covers installability and static-asset caching only.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `vite-plugin-pwa` added to the build, generating a manifest (name, icons, theme color, standalone display mode) and a service worker
- [x] App icons provided (including a maskable icon) sized appropriately for home-screen install
- [x] Service worker precaches the built static app shell only — no runtime caching of API responses
- [x] Service worker does not register in local dev (`devOptions.enabled: false` or equivalent) so local iteration isn't affected by a stuck cache
- [x] Verified manually: `vite build && vite preview`, install to a phone's home screen, open in airplane mode, app shell loads and renders (data calls are expected to fail/hang until later tickets land — that's fine for this ticket)
