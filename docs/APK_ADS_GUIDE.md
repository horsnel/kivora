# Embedding Ads in the Kivora Android APK (Direct-Download Distribution)

This guide covers the recommended architecture for shipping Kivora as an APK
distributed by direct download (site + social media links) with ads embedded.

## Why a Capacitor wrapper (not TWA, not AdSense)

| Option | Ads support | Verdict |
|---|---|---|
| **Capacitor WebView + AdMob SDK** | Native banner / interstitial / rewarded ads | ✅ Recommended — full AdMob surface, works off-Play |
| TWA (Bubblewrap / PWABuilder) | None — full-screen Chrome tab, no native UI surface you control | ❌ Cannot host AdMob |
| AdSense inside the PWA | Web ads in a WebView | ❌ Policy-gray in WebViews, poor eCPM, risks AdSense account |

Capacitor wraps the existing site (loaded from the live URL, so web updates
ship instantly without APK updates) while the ad layer runs natively.

## One-time setup

1. **Google AdMob account** → Apps → *Add app* → platform Android →
   "app not listed on a store" (direct-download APKs are supported).
2. Create **ad units**: 1 banner, 1 interstitial, 1 rewarded.
3. Note the **App ID** (`ca-app-pub-…~…`) and **ad unit IDs**
   (`ca-app-pub-…/…`). Use Google's **test IDs** during development — live IDs
   in development get AdMob accounts flagged.

## Build the wrapper

```bash
npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/android @capacitor-community/admob
npx cap init "Kivora" "app.kivora.app" --web-dir=www
# capacitor.config.json — load the live site instead of bundling it:
#   { "server": { "url": "https://kivora.app", "cleartext": false }, "android": { "allowMixedContent": false } }
npx cap add android
```

Wire AdMob (`MainActivity` / a Capacitor plugin call from JS):

```js
import { AdMob, BannerAdPosition, BannerAdSize } from '@capacitor-community/admob'

await AdMob.initialize({ initializeForTesting: true })          // dev only
await AdMob.showBanner({ adId: BANNER_ID, adSize: BannerAdSize.ADAPTIVE_BANNER, position: BannerAdPosition.BOTTOM_CENTER })
```

Build + sign:

```bash
cd android && ./gradlew assembleRelease   # requires JDK 17 + Android SDK
# sign with your keystore (keytool -genkeypair -v -keystore kivora.keystore)
```

## Ad placement strategy (sync with the credit economy)

- **Banner**: bottom of chat / explore, never overlapping content or buttons.
- **Interstitial**: at natural pauses only — e.g. after the 2nd exploration
  result, never on error screens or during streaming.
- **Rewarded**: highest eCPM + perfect fit — "Watch an ad → +N credits"
  grants credits through the existing credit ledger (same shape the API
  already charges/refunds), keeping one economy across web and APK.

## Compliance (do not skip)

- **Minimum functionality**: a bare WebView wrapper risks AdMob policy
  action. Add native value: push notifications, offline shell/splash,
  native share sheet (`navigator.share` bridging), file downloads.
- **Consent (EU/UK)**: integrate Google's **UMP (User Messaging Platform)**
  SDK before ad calls; honor consent state for personalized ads.
- Never place ads on loading/error screens; max 1 interstitial per ~3 actions.
- Direct-distribution note: users must enable "install unknown apps" for the
  browser; include the steps on the download page.

## Distribution on the platform + social sharing

1. Host the signed APK, e.g. `public/downloads/kivora-v1.0.0.apk`.
2. Add to `public/_headers`:
   ```
   /downloads/*
     Content-Type: application/vnd.android.package-archive
     Content-Disposition: attachment; filename="kivora.apk"
   ```
3. Create an `/app` landing page: QR code, changelog, version, size,
   checksum, and install instructions.
4. Social share links (pre-filled):
   - WhatsApp: `https://wa.me/?text=…`
   - Telegram: `https://t.me/share/url?url=…&text=…`
   - X: `https://twitter.com/intent/tweet?url=…&text=…`
   - Facebook: `https://www.facebook.com/sharer/sharer.php?u=…`
   Ensure Open-Graph tags on the landing page so shared links unfurl with
   title/description/image.
5. Keep `versionName`/`versionCode` in `android/app/build.gradle` bumped per
   release; web code updates instantly through the remote URL — only native
   (ad SDK / permission) changes need a new APK.
