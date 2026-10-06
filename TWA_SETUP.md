# Kivora — Android APK via Trusted Web Activity (Bubblewrap)

The site is now a full PWA (real manifest, icons, service worker). The next
step — packaging it as a Play Store app — needs the Google Play Console
account. Everything below takes ~30–45 minutes once the account exists.

## Prerequisites (one-time)

1. **Play Console account** — https://play.google.com/console ($25 once, identity verification).
2. **JDK 17+ and Android SDK** — easiest via Android Studio, or:
   ```bash
   npm i -g @bubblewrap/cli
   bubblewrap doctor   # installs/configures JDK + SDK for you
   ```

## Build the APK / App Bundle

```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://kivora.pages.dev/manifest.webmanifest
bubblewrap build
```

- `init` generates `twa-manifest.json` + a signing key (set a keystore
  password you won't lose — Play links the app to this key forever).
- `build` produces `app-release-signed.apk` (direct distribution) and
  `app-release-bundle.aab` (Play Store upload).
- `init` prints the app's **SHA-256 fingerprint** at the end. Bubblewrap
  can also print it later:
  ```bash
  bubblewrap fingerprints
  ```

## Digit asset links (required for the TWA to run fullscreen, no browser bar)

Create `public/.well-known/assetlinks.json` (committed at deploy time, not
before the fingerprint exists):

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "<APP_ID_FROM_TWA_MANIFEST>",
    "sha256_cert_fingerprints": ["<SHA-256:FINGERPRINT:FROM:BUBBLEWRAP>"]
  }
}]
```

Deploy it, then verify:
```bash
curl -s https://kivora.pages.dev/.well-known/assetlinks.json
```

## Play Store listing checklist

- App name: Kivora (confirm availability in Play Console first)
- Short description (80 chars), full description (4000 chars)
- Feature graphic 1024×500 + phone screenshots (2–8) — can be captured
  from the installed app
- **Privacy policy URL** — required; Kivora has `/privacy` (confirm it
  covers the current data usage, or update before submitting)
- Data safety form: declare Supabase auth data, AI request content,
  and community attachment storage
- Content rating questionnaire + target audience (13+ recommended)
- Upload the `.aab`, roll out to internal testing first, then production

## Notes

- Content updates ship through the website instantly — Play review is only
  needed for store-listing changes or native-layer (bubblewrap config) bumps.
- Keep the signing key + keystore password backed up (password manager).
- If CF Pages later serves from an apex domain, update `twa-manifest.json`
  host + assetlinks + Play listing accordingly.
