# GymRebel als native app (App Store + Play Store)

Beide apps zijn **Capacitor-wrappers** die de gehoste web-app in een WebView
laden (`server.url` → productie). De app is server-gerenderd (RSC + Server
Actions + Prisma), dus er is géén statische bundle om in te pakken. De afweging
staat uitgeschreven in [`capacitor.config.ts`](../capacitor.config.ts).

> **Historie:** Android liep eerder via een Trusted Web Activity (Bubblewrap,
> map `twa/`). Dat is uitgefaseerd ten gunste van één wrapper-technologie voor
> beide stores: gedeelde iconen, splash, versiebeheer en plugins. De oude opzet
> staat in de git-historie.

## Identiteit (onveranderlijk na publicatie)

| | Waarde |
|---|---|
| Bundle ID / package name | `nl.gymrebeltraining.app` |
| App-naam onder het icoon | GymRebel |
| Productie-host | `app.gymrebel-training.com` |

Alle drie zijn env-overschrijfbaar (`CAPACITOR_APP_ID`, `CAPACITOR_SERVER_URL`,
`ANDROID_PACKAGE_NAME`). Het koppelteken uit het websitedomein kan niet in het
package-id: Android staat daar alleen letters, cijfers en underscores toe.

## Native meerwaarde (nodig voor Apple-richtlijn 4.2)

Een app die enkel een website toont wordt afgekeurd. Wat deze app native doet:

- **Haptics** via de Taptic Engine ([`lib/haptics.ts`](../lib/haptics.ts)),
  aangesloten op de rusttimer, het opslaan van een set en de trofee-celebration.
  iOS-WebViews kennen `navigator.vibrate` niet, dus zónder deze laag zou er op
  iOS geen trilfeedback zijn.
- **Camera-QR-scan** bij de apparaten.
- **Push** via APNs (iOS) en FCM (Android).
- **Biometrische login** via passkeys en Associated Domains.

Reken op één of twee afkeurrondes; reageer met deze lijst.

## Wat in de repo geregeld is

- `capacitor.config.ts` — appId, remote `server.url`, `errorPath`, splash- en
  toetsenbordgedrag, ATS en mixed content dicht.
- `capacitor/www/error.html` — gebrande offlinepagina, herstelt vanzelf zodra het
  toestel weer online is.
- `android/` — volledig gegenereerd en gebrand (zie hieronder).
- `npm run brand:assets` — genereert uit één vectorbron
  ([`components/brand/logo-art.ts`](../components/brand/logo-art.ts)) de
  PWA-iconen, favicon, Android-launcher/adaptive/splash **en** de
  iOS-`Assets.xcassets`. Draai dit na elke `npx cap add`.
- `npm run ios:plist` — zet de verplichte Info.plist-sleutels (idempotent).
- Web-kant van push, passkeys, AASA en assetlinks (zie `.env.example`).

## Android

```bash
npx cap sync android
npm run brand:assets      # iconen + splash branden
npx cap open android      # Android Studio
```

Permissies staan in [`AndroidManifest.xml`](../android/app/src/main/AndroidManifest.xml)
en zijn bewust minimaal: `INTERNET`, `CAMERA`, `POST_NOTIFICATIONS`. `VIBRATE`
komt via manifest-merge uit de haptics-plugin. Verder:

- `network_security_config.xml` — alleen HTTPS, alleen systeem-CA's.
- `data_extraction_rules.xml` plus `allowBackup=false` — geen sessiecookies in
  cloud-back-ups of toestel-overdracht.
- `values-v31/styles.xml` — startscherm voor Android 12+, waar het systeem de
  splash-drawable negeert.
- App Links-intent-filter op `@string/app_link_host`, geverifieerd via
  `/.well-known/assetlinks.json` (vult zich uit `ANDROID_CERT_FINGERPRINTS`).

**Nog te doen:** push werkt pas met een `google-services.json` uit Firebase in
`android/app/`, én een FCM-verzender aan de serverkant. Die ontbreekt nog:
[`lib/push.ts`](../lib/push.ts) stuurt vandaag alleen web-push en APNs.

## iOS

`ios/` staat **niet** in de repo en is niet op Windows te genereren: Xcode en
CocoaPods zijn macOS-only. Op een Mac of macOS-CI-runner:

```bash
npx cap add ios
npx cap sync ios
npm run brand:assets      # vult ios/App/App/Assets.xcassets
npm run ios:plist         # Info.plist-sleutels
npx cap open ios
```

Daarna in Xcode onder **Signing & Capabilities**. Dit zijn entitlements, geen
Info.plist-sleutels, dus niet vanuit de repo te scripten:

- **Push Notifications**
- **Associated Domains**: `webcredentials:app.gymrebel-training.com` en
  `applinks:app.gymrebel-training.com`

En in de productie-env: `APPLE_APP_ID` = `"<TeamID>.nl.gymrebeltraining.app"`,
plus de APNs-sleutels (`APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`,
`APNS_BUNDLE_ID`). Controleer daarna
`https://app.gymrebel-training.com/.well-known/apple-app-site-association`.

> Het app-icoon wordt **zonder alfakanaal** weggeschreven. App Store Connect
> weigert anders de upload met `ITMS-90717`.

## Onderhoud

Web-wijzigingen zijn direct live; de app laadt de gehoste site. Een nieuwe
store-build is alleen nodig bij native wijzigingen: plugins, permissies, iconen,
splash of het app-id.
