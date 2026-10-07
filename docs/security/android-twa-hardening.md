# Kivora Android (TWA) Security Hardening Checklist

The Android app is a **Trusted Web Activity** (not a WebView), which is the
most secure hybrid model: it renders real Chrome with zero JavaScript
bridges, no injected objects, and no `addJavascriptInterface` exposure.
Network security is inherited from the website itself — which now ships HSTS,
CSP, and the full header set via `public/_headers`.

## Already in place
- `public/.well-known/assetlinks.json` — single fingerprint for
  `com.kivora.app` (no wildcard apps; other apps cannot claim our domain).
- Site-side hardening (HSTS preload, CSP, frame-ancestors 'none') protects
  the TWA the same way it protects browser sessions.
- TWA uses the platform network stack: cleartext HTTP is blocked by default.

## Required on the next APK build (user-side — Play Console)
1. **Disable backup of auth material** in `AndroidManifest.xml`:
   ```xml
   android:allowBackup="false"
   ```
   (or a `backup_rules.xml` that excludes shared prefs holding Supabase
   session tokens). Cloud backups of session tokens are a real exfil path.
2. **No exported components**: every `activity`/`service`/`receiver`
   that is not the launcher/credential-handler entry must declare
   `android:exported="false"` (mandatory default on targetSdk 34+, but
   verify explicitly).
3. **Keep targetSdk current** (Play requirement anyway) — older targets
   re-enable legacy behaviors like implicit exports and optional TLS.
4. **Pin signing keys**: enroll in Play App Signing; when the upload key
   rotates, update `assetlinks.json`'s `sha256_cert_fingerprints` in the
   same release window — otherwise Custom Tabs autofill/session linking
   silently breaks (or worse, an old fingerprint keeps validating).
5. **Do not add a WebView fallback**. If native code is ever introduced:
   `javaScriptEnabled` off unless needed, never
   `setAllowFileAccessFromFileURLs`, and no `@JavascriptInterface` on
   objects that touch tokens.

## Threat model notes
- Session tokens live in browser storage inside the TWA's Chrome profile —
  protected by app sandboxing; root-of-device is out of scope.
- The `.well-known/assetlinks.json` file is served over HSTS; domain
  takeover of `kivora.pages.dev` is the only way to spoof it, and the
  Pages project should keep 2FA + restricted token scopes on the CF account.
