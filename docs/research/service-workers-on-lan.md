# Service workers on a plain-HTTP LAN deployment

Researched 2026-10-06. Question: the PWA ships as one Go exe (ADR 0002) serving `http://192.168.x.x:8080`; service workers refuse to register there. What are the viable fixes?

**Facts that scope the answer**
- Stack (read from repo): Go `net/http` on `:8080` (`main.go`), Vue frontend embedded via `go:embed`, `vite-plugin-pwa` with `registerType: 'prompt'` + Workbox precache (`web/vite.config.ts`, `web/src/registerPwa.ts`), Dexie/IndexedDB outbox (ADR 0006).
- Clients reach the exe by **raw IP address**, and are **Android Chrome only** (no iOS). Exe host is an old Windows PC on a static LAN IP, not always on. Single user, no auth, "no ops appetite" (ADR 0002).
- Source confidence: claims carry an inline primary URL. Items marked **[UNVERIFIED]** could not be confirmed against a primary source in this session and need an on-device check.

---

## 1. Secure-context rules

The Secure Contexts spec defines "potentially trustworthy origin" ([W3C Secure Contexts section 3.1](https://w3c.github.io/webappsec-secure-contexts/)). In order, an origin qualifies if it is:
1. scheme `https` or `wss`;
2. host in `127.0.0.0/8` or `::1/128`;
3. `localhost`, `localhost.`, `*.localhost`, `*.localhost.` (only if the UA guarantees they resolve to loopback);
4. scheme `file`;
5. a UA-authenticated scheme (`app:`, `chrome-extension:`);
6. an origin the user/UA has **configured as trustworthy** (spec section 7.2 explicitly allows this "to support staging servers on non-loopback hosts").

Domain and port do not matter. A `192.168.x.x` address, a `.local` name or a bare LAN hostname are **not** trustworthy, so `http://192.168.x.x:8080` is not a secure context. MDN's table agrees: `http://localhost` yes, `http://example.com` no ([MDN Secure Contexts](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)).

Service workers are "always secure": only secure contexts may register them ([same MDN page](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts); `navigator.serviceWorker` is `[SecureContext]`, [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/serviceWorker)).

Per browser (Android Chrome is what matters here):
- Chrome/Chromium: implements step 6 through `--unsafely-treat-insecure-origin-as-secure` / `chrome://flags/#unsafely-treat-insecure-origin-as-secure` and an enterprise policy (section 5) ([Chromium security](https://www.chromium.org/Home/chromium-security/deprecating-powerful-features-on-insecure-origins/)).
- Firefox: only `localhost` and `*.localhost` plus configurable allowlist prefs. I found no official Mozilla doc for the allowlist pref syntax **[UNVERIFIED]**. The `dom.serviceWorkers.testing.enabled` pref exists in Gecko's [StaticPrefList.yaml](https://raw.githubusercontent.com/mozilla/gecko-dev/master/modules/libpref/init/StaticPrefList.yaml) (a testing-only pref). Not relevant to an Android-Chrome-only fleet.
- Safari/iOS: out of scope per user. No equivalent per-site override is documented in what I read.

Separately, features that also need a secure context and are lost on HTTP: `navigator.storage.persist()` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)), Background Sync ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API), also needs a service worker), Chrome install criteria "Be served over HTTPS" ([web.dev install criteria](https://web.dev/articles/install-criteria)).

---

## 2. Self-signed / private-CA HTTPS embedded in the exe

**Idea:** on first run the exe generates a private root CA + a leaf cert with `IPAddress` SAN(s) for the static LAN IP, serves `:8443` (or `:8080`) over TLS via Go `http.Server.ListenAndServeTLS`, and exposes the root for download. Each phone installs the root once.

Findings:
- A plain self-signed leaf (no CA trust) does **not** make a secure context useful: users click through a warning and Chrome still will not register a SW on an untrusted cert (SW registration fails on certificate errors; commonly documented, but I did not find a Chromium primary doc in this session **[UNVERIFIED]**). Use a private CA that the device trusts instead.
- Chrome's verifier honors locally installed trust decisions over TCP TLS ([Chrome Root Store FAQ](https://chromium.googlesource.com/chromium/src/+/main/net/data/ssl/chrome_root_store/faq.md)). The FAQ gives Windows/macOS details only; **it says nothing specific about Android's user store**, so "Android Chrome trusts a user-installed CA" is **[UNVERIFIED] against a primary source** (secondary sources say browsers, Chrome included, do, while ordinary apps targeting API 24+ do not, per [Android network security config](https://developer.android.com/privacy-and-security/security-config), which describes apps only). Must be tested on the actual phone.
- CT and max-lifetime rules apply to roots in the Chrome Root Store, not to private roots ([same FAQ](https://chromium.googlesource.com/chromium/src/+/main/net/data/ssl/chrome_root_store/faq.md)), so a long-lived private root/leaf is not blocked by public-CA policy. Android's own config docs: CT is not checked for user-store anchors ([Android docs](https://developer.android.com/privacy-and-security/security-config)).
- IP SAN: Caddy states IP addresses can get certs from its local CA ([Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https)), proving the pattern is standard. Chrome accepting `iPAddress` SAN matches is standard X.509 behavior **[UNVERIFIED in a Chromium doc]**; test it.
- Android install steps: Settings > Security & privacy > More security settings > Encryption & credentials > Install a certificate > CA certificate (menu names vary by vendor); a screen lock must be set ([Google Pixel Help](https://support.google.com/pixelphone/answer/2844832) shows the Wi-Fi variant; the CA variant is described in [Android 11 changes, HTTP Toolkit](https://httptoolkit.com/blog/android-11-trust-ca-certificates/), secondary). Since Android 11 an app cannot trigger the install; the user must pick the file in Settings. Android 15+ shows a warning notification after install (secondary, same blog/AdGuard docs).
- Per-device cost: one-time, about 2 minutes, plus a persistent "network may be monitored" notice. Leaf must be reissued if the IP changes. Static IP is already assumed in ADR 0002.
- Managed fleet alternative: push the root via MDM/Android Enterprise. Not a home-use fit.

---

## 3. Real domain -> LAN IP + Let's Encrypt DNS-01

**Idea:** own `cellar.example.com`, public A record `192.168.x.x`. Exe (or a helper) obtains a real cert via **DNS-01**, which needs no inbound reachability. Phones need no CA install and no flag; they just visit `https://cellar.example.com:8443`. This changes the URL users type, but they currently type an IP anyway.

Findings:
- DNS-01 proves control with a TXT record at `_acme-challenge.<name>` and "can validate names whose web servers aren't reachable from the public internet" ([Let's Encrypt challenge types](https://letsencrypt.org/docs/challenge-types/)). It needs a DNS provider API for automation and **cannot validate IP addresses**. Credential scope should be minimal; CNAME delegation of `_acme-challenge` to a dedicated zone (e.g. acme-dns) limits blast radius ([same page](https://letsencrypt.org/docs/challenge-types/)).
- The A record may point at an RFC 1918 address: the CA only checks the TXT record. (Let's Encrypt's docs do not discuss this explicitly; the mechanism follows from the challenge doc above.) Caveat: **DNS rebind protection** on routers can drop public answers that contain private IPs. AVM's FRITZ!Box blocks them unless the hostname is added to "Host name exceptions" ([AVM KB](https://uk.fritz.com/service/knowledge-base/dok/FRITZ-Box-6890-LTE/3565_The-FRITZ-Box-reports-Your-DNS-rebind-protection-rejected-your-query-for-reasons-of-security/)). Other routers behave similarly; check the user's router. On cellular data the name resolves normally to the unreachable private IP, which is fine (app is LAN-only anyway).
- **Raw IP certs from Let's Encrypt do not solve this.** Let's Encrypt now issues IP-address certs, but only under the 6-day "shortlived" profile (160 h) ([LE GA announcement](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability)). The announcement does not state the validation method or reserved ranges. A public CA cannot prove control of an RFC 1918 address, so this is a non-starter for `192.168.x.x` **[reserved-range rule UNVERIFIED in an LE primary doc; Caddy confirms only "some CAs" do IPs and defaults to its local CA otherwise]**.
- Validity: 90 days default, renew roughly every 60 ([LE FAQ](https://letsencrypt.org/docs/faq/)). A PC that is not always on is fine: check expiry at startup and renew if under ~30 days left.
- Rate limits are a non-issue for one host: 50 certs per registered domain per 7 days, 5 duplicates per 7 days, 5 auth failures per hour; ARI/renewals exempt from the first limits ([LE rate limits](https://letsencrypt.org/docs/rate-limits/)). Do not retry in a tight loop (Tailscale notes the same 34 h lockout, [Tailscale](https://tailscale.com/kb/1153/enabling-https)).
- Exe integration: Go's `autocert` supports only http-01 and tls-alpn-01, **not dns-01** ([pkg.go.dev autocert](https://pkg.go.dev/golang.org/x/crypto/acme/autocert)), and both of those need public inbound reach, which the LAN host lacks. Use **lego** as a library; it supports 150+ DNS providers via env-var credentials ([lego DNS docs](https://go-acme.github.io/lego/dns/)). Store cert + ACME account on disk beside `cellar.db`; add a TLS listener; keep HTTP on 8080 as redirect.
- Costs/risks: a domain (~10 EUR/year) and a DNS API token stored on the PC. The cert and hostname appear in public CT logs (the hostname is public by design). Internal IP is also revealed by public DNS.
- Stable-hostname bonus: this *is* the stable name; no mDNS or router changes required beyond a possible rebind exception.

---

## 4. Tailscale, Caddy, tunnels, other proxies

**Tailscale HTTPS.** Enable MagicDNS + HTTPS; `tailscale cert` fetches a Let's Encrypt cert for `<machine>.<tailnet>.ts.net` using DNS-01 via a Tailscale-managed TXT record, private key stays local, renewal is your job (Caddy integration or `local.Client.GetCertificate` in Go automate it) ([Tailscale HTTPS](https://tailscale.com/kb/1153/enabling-https)). Machine names go into public CT logs. Phones must run the Tailscale app and be on the tailnet (the doc does not state this outright; MagicDNS names resolve only via the tailnet, **[inference]**). Upsides: works away from home, so it would end the "sync only on home Wi-Fi" limitation in ADR 0006. Downsides: contradicts that ADR's "no VPN/relay", needs an account and an app on every phone.

**Caddy.** As reverse proxy it automates HTTPS: local CA for IPs/local names (needs root installed on clients, `caddy trust` only installs on the machine running Caddy), public ACME with DNS-challenge plugins for real names ([Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https)). Adds a second binary, which breaks the "one file" principle of ADR 0002. Everything Caddy does can be done in-process with Go (sections 2 and 3).

**Cloudflare Tunnel.** `cloudflared` opens outbound-only connections to Cloudflare and publishes a hostname with Cloudflare-managed TLS ([Cloudflare Tunnel docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)). Gives valid HTTPS and remote access with no LAN trust setup. Costs: second process, Cloudflare account + domain (the overview page does not list requirements explicitly), and the app has **no auth** (ADR 0002), so publishing it would expose personal data unless Cloudflare Access or similar is added. Poor fit.

Other tunnels/proxies (ngrok, nginx, Traefik): same shape as Caddy/Cloudflare. I did not research them separately.

---

## 5. Chrome flag and enterprise policy

**`chrome://flags/#unsafely-treat-insecure-origin-as-secure`**
- Per Chromium: makes a chosen HTTP origin count as secure; the page documents the flag and the command-line form, and notes the command-line form needs root/dev mode on Android and ChromeOS ([Chromium security](https://www.chromium.org/Home/chromium-security/deprecating-powerful-features-on-insecure-origins/)). The `chrome://flags` UI route on Android Chrome is a normal, non-rooted path (secondary reports; **[UNVERIFIED]** in a primary doc).
- Origin entries are exact strings; the enterprise policy page says patterns are only for hostnames while "URLs and origins with schemes must be exact strings" (policy summary via [Chrome Enterprise policy list](https://chromeenterprise.google/policies/override-security-restrictions-on-insecure-origin/), page body did not load; text confirmed by search snippet). So enter `http://192.168.x.x:8080` exactly. An IP origin is allowed (hostname patterns apply to hostnames; IP behavior is secondary-sourced **[UNVERIFIED]**).
- Per phone: Chrome > `chrome://flags` > search the flag > Enabled > type the origin > Relaunch. About 1 minute. Survives restarts. Breaks silently if the IP, scheme or port changes. A Chromium security-dev thread titled "Unsupported Flag unsafely-treat-insecure-origin-as-secure" exists, i.e. the flag is a developer feature and can be removed or changed without notice.
- Does it still give a WebAPK? Installability criteria require HTTPS ([web.dev](https://web.dev/articles/install-criteria)); whether the flag satisfies Chrome's installability check is **[UNVERIFIED]**. Test it. If not, Chrome for Android still lets users "install any website as an app" regardless of criteria ([MDN making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)), though the result may be a shortcut rather than a WebAPK.

**Enterprise policy `OverrideSecurityRestrictionsOnInsecureOrigin`** (replaces the deprecated `UnsafelyTreatInsecureOriginAsSecure`, M69): same effect as the flag, listed for Android, ChromeOS and desktop; Google's own security guide says admins should leave it unset in a hardened config ([policy page](https://chromeenterprise.google/policies/override-security-restrictions-on-insecure-origin/), [Chrome Enterprise Security guide](https://services.google.com/fh/files/misc/chromeenterprisesecurityconfigguidedec2024.pdf)). Delivering it on Android needs an MDM or Android Enterprise managed configuration. Overkill for a home phone.

**Firefox equivalent:** `dom.securecontext.allowlist` (hostname-only, no ports, per [Mozilla Connect request](https://connect.mozilla.org/t5/ideas/support-ports-in-dom-securecontext-allowlist/idi-p/116011); not a primary spec doc). Irrelevant for Android Chrome.

---

## 6. Non-service-worker offline fallbacks

Already in place: Dexie/IndexedDB outbox (ADR 0006). IndexedDB is not marked `[SecureContext]` in MDN's overview, but MDN's page does not state that either way **[UNVERIFIED; verify at W3C IndexedDB IDL]**; it is widely used on HTTP and the current app already depends on it.

What is lost on plain HTTP:

| Capability | HTTP | Why |
|---|---|---|
| Offline app shell (precache, load with no network) | Lost | needs SW; AppCache is the old alternative and was removed (Chromium lists AppCache among removed insecure-origin features; [Chromium security](https://www.chromium.org/Home/chromium-security/deprecating-powerful-features-on-insecure-origins/), removal itself not re-verified) |
| Background Sync | Lost | SW + secure context ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)) |
| `navigator.storage.persist()` | Lost | secure context ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)); IndexedDB data is evictable under pressure |
| Install prompt / WebAPK | Likely lost | criteria "Be served over HTTPS" ([web.dev](https://web.dev/articles/install-criteria)) |
| Workbox update gating on empty outbox (`registerPwa.ts`) | Moot | no SW, no `onNeedRefresh`; replace with version check |
| IndexedDB reads/writes for outbox | Kept | not a SW feature |

Mitigations without SW (all weaker than a SW):
- HTTP caching headers (`Cache-Control: immutable` on hashed assets, short on `index.html`) so the HTTP cache serves the shell while online-but-slow. Does not guarantee offline cold start.
- "Open once on Wi-Fi, keep the tab alive": fragile on Android (tab discard).
- Cost to the main ADR 0006 scenario: **a phone that leaves the LAN cannot cold-start the app at all**, because the shell is not cached. Outbox entries stay in IndexedDB but cannot be reached until the app loads on the LAN. This is the real loss, and the main reason to pick a fix rather than live with HTTP.

---

## 7. localhost on each device

The `localhost`/`127.0.0.1`/`*.localhost` rule makes a server on the same device a secure context ([Secure Contexts spec](https://w3c.github.io/webappsec-secure-contexts/)). For Android phones this is **not viable**: the exe is `windows/amd64` (ADR 0002) and a phone would need its own server binary + data store (breaking the single-DB model). The only phone-to-PC loopback trick found is USB port forwarding for development, mentioned by Chromium ([Chromium security](https://www.chromium.org/Home/chromium-security/deprecating-powerful-features-on-insecure-origins/)), not usable day to day. On the desktop PC itself, `http://localhost:8080` already registers SWs today.

---

## 8. Stable hostname options (clients currently use raw IP)

- Public domain A record (section 3): simplest, real name.
- `.local` via mDNS: Android resolves `.local` in Chrome only through the OS resolver, added by a Nov 2021 Mainline DNS Resolver update and likely Android 12+ ([Android Police](https://www.androidpolice.com/android-mdns-local-hostname/), secondary). Chromium's own mDNS client does not do address lookups for `.local` ([Chromium net/dns README](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/net/dns/README.md)). The exe would need an embedded mDNS responder (Windows behavior not verified **[UNVERIFIED]**). A `.local` name is still **not** a secure context on its own; it only helps with the private-CA route (use a DNS SAN rather than an IP SAN, which survives IP changes) or the Chrome flag.
- `*.localhost`: spec-secure but only resolves to loopback on that device (see section 7).
- Router-provided DNS name (DHCP reservation + local DNS entry): possible on some routers, not researched.
- The exe could offer a hostname by **embedding the lego ACME client + a configured domain** (section 3) or by an mDNS responder. It cannot create DNS records without credentials.

---

## 9. Comparison (Android Chrome, home LAN, single exe)

| Option | Effort (dev) | Per-phone setup | Cost | Maintenance | Fit with single-exe deploy | Gains |
|---|---|---|---|---|---|---|
| A. Chrome flag per phone | None | ~1 min: chrome://flags, exact origin, relaunch | Free | Breaks if IP/port changes; flag is developer-only and may be removed | Perfect (no change) | SW, offline shell; WebAPK install uncertain |
| B. Private CA + IP SAN, embedded in exe | Medium (Go `crypto/x509`, TLS listener, `/ca.crt`) | ~2 min: install CA in Android Settings, screen lock required, persistent warning | Free | Reissue leaf if IP changes; root lifetime long | Good (all in-process) | Real HTTPS, SW, likely install; works against IP |
| C. Domain + LE DNS-01 via embedded lego | Medium-high (TLS, ACME, DNS creds, renewal on startup, UI for token) | None, besides new URL; possible router rebind exception | ~10 EUR/yr domain | 90 d certs (renew at startup); DNS token rotation | Good (lego is a Go lib; adds 2 files of state) | Real HTTPS, SW, install, no trust prompts, stable name |
| D. Tailscale HTTPS | Low-medium | Install Tailscale app + login on every phone | Free tier | Tailnet cert renewal | Weak (extra daemon + account; contradicts ADR 0006 "no VPN") | Remote access, HTTPS |
| E. Caddy in front | Low | None (public CA) or CA install (local CA) | Free (+ domain) | Second binary | Poor | Same as B or C |
| F. Cloudflare Tunnel | Low | None | Free tier + domain | cloudflared service | Poor, and exposes an auth-less app | Remote access, HTTPS |
| G. Chrome enterprise policy | Low | MDM/Android Enterprise enrollment | MDM | Fleet management | N/A (unneeded for one user) | Same as A |
| H. Stay HTTP, no SW | None | None | Free | None | Perfect | Keeps Dexie outbox; loses offline shell, install, bg sync |
| I. localhost on phone | n/a | n/a | n/a | n/a | Not viable | n/a |

---

## 10. Recommendation

1. **Immediately, for the one existing user: option A.** It is free, needs no code and fits ADR 0002. Verify on the phone that `registerSW` succeeds, that the shell loads offline, and whether Chrome offers a real install. Accept that it is a developer flag.
2. **If the app should work for anyone or the flag proves flaky, or the IP may change: option C** (domain + LE DNS-01 via lego embedded in the exe). It is the only route that gives real HTTPS with **zero per-phone setup** and a stable name instead of a raw IP. Cost is a small domain and a DNS API token on the PC. Keep it opt-in (config file / flags) so the exe still runs plain-HTTP by default.
3. **If no domain/DNS-token is acceptable: option B** (private CA, IP SAN or `.local` DNS SAN). Needs a one-time Android CA install per phone.
4. Avoid D, E, F for now: each adds a component or an account, and F exposes an unauthenticated app.

Caveats
- Chrome-flag behavior on Android (exact origin with port, persistence, installability) and Android-Chrome trust of user-installed CAs with IP SANs are **not confirmed by any primary source I could reach**; run a 15-minute on-device test before choosing.
- Public DNS pointing at a private IP leaks the LAN address and may be blocked by router DNS rebind protection.
- Whatever is chosen, the SW cache and `registerType: 'prompt'` gating (`registerPwa.ts`) only start working after HTTPS or the flag is in effect; origin changes (IP -> hostname, or http -> https) create a **new origin with a fresh IndexedDB**. Existing outbox data on the old origin would be stranded; plan a drain-the-outbox-first migration (relevant to ADR 0006 and the DB-migration rule in AGENTS.md).

Open questions
- Does the user own, or will they buy, a domain? Which DNS provider (lego support, API scope)?
- Which router, and does it enforce DNS rebind protection?
- Is the phone ever used off the LAN with the shell expected to load (the real driver for a SW)?
- Is the PC IP truly static; is the TLS port acceptable (`:8443` visible in URL) or should the exe bind `:443`?
- Android version(s) on the phones (CA install flow, `.local` resolution need Android 12+)?
- Should ADR 0002/0006 be amended once a choice is made (e.g. "optional HTTPS")?
