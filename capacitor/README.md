# GymRebel op de App Store (iOS via Capacitor)

De iOS-app is een **Capacitor-wrapper** die de gehoste web-app in een WKWebView
laadt (`server.url` → productie). De app is server-gerenderd (RSC), dus er is
géén statische bundle — vandaar de remote-URL-aanpak.

> ⚠️ **Apple-richtlijn 4.2 (minimale functionaliteit).** Een pure "website in een
> WebView" wordt afgekeurd. De native meerwaarde van deze app zit in: haptics
> (Taptic Engine), camera-QR-scan (via de WebView), web-push→APNs, en biometrische
> login (passkeys). Reken op 1–2 afkeurrondes; reageer met deze native-functielijst.

## Wat al klaar is in de repo (cross-platform)

- `capacitor.config.ts` — wrapper-config (appId, `server.url`, safe-area-insets), env-overschrijfbaar.
- `capacitor/www/index.html` — fallback-laadscherm (getoond tot de server laadt).
- `lib/haptics.ts` — native Taptic Engine op iOS/Android, `navigator.vibrate` als web-fallback. **Al aangesloten** op: celebration-overlay, rusttimer en set-opslaan. (Belangrijk: iOS WKWebView kent géén `navigator.vibrate`, dus zónder deze laag zou er op iOS geen trilfeedback zijn.)
- PWA-manifest + iconen + passkeys (Fase 1–3).

## Vereisten (alleen op macOS)

- **macOS + Xcode** + **CocoaPods** (`sudo gem install cocoapods`).
- **Apple Developer Program** (€99/jaar).
- Node + de Capacitor-CLI (staat als devDep: `npx cap ...`).

## 1. iOS-platform toevoegen (op een Mac)

```bash
# In de repo, op macOS:
CAPACITOR_SERVER_URL=https://<jouw-domein> CAPACITOR_APP_ID=app.gymrebel.mobile \
  npx cap add ios
npx cap sync ios
npx cap open ios   # opent Xcode
```

`cap add ios` genereert de `ios/`-map (Xcode-project). Deze is **niet** op Windows te
genereren (CocoaPods/Xcode zijn macOS-only) en staat daarom niet in de repo.

## 2. Native plugins installeren (indien nog niet)

De web-kant gebruikt al `@capacitor/haptics`, `@capacitor/app`, `@capacitor/status-bar`.
Voor push heb je extra nodig:

```bash
npm i @capacitor/push-notifications
npx cap sync ios
```

## 3. Info.plist — permissies & app-bound domains

Voeg in Xcode (of `ios/App/App/Info.plist`) toe:

- `NSCameraUsageDescription` — "GymRebel gebruikt de camera om apparaat-QR-codes te scannen." (nodig voor de QR-scanner in de WebView).
- `NSFaceIDUsageDescription` — "Log in met Face ID." (passkeys/biometrie).
- **`WKAppBoundDomains`** (array met je domein) — nodig zodat service worker, web-push en passkeys in de WKWebView werken. Zet dan ook `limitsNavigationsToAppBoundDomains: true` in `capacitor.config.ts`.

## 4. Passkeys in de app (associated domains) — ✅ web-kant klaar

De AASA-route bestaat: `app/.well-known/apple-app-site-association/route.ts` (serveert
`webcredentials` + `applinks`, env-gedreven). Te doen:

- Zet **`APPLE_APP_ID`** in de productie-env = `"<TeamID>.<bundleId>"` (bv. `ABCDE12345.app.gymrebel.mobile`). Controleer daarna `https://<domein>/.well-known/apple-app-site-association`.
- Xcode → Signing & Capabilities → **Associated Domains** → `webcredentials:<domein>` én `applinks:<domein>`.
- Zet **`WEBAUTHN_RP_ID`** (hoofd-`.env`) op een domein dat matcht.

Universal links (magic-link opent de app) werken dan automatisch via de `applinks`-sectie.

## 5. Push (native APNs) — ✅ web-kant klaar

Web-push werkt op iOS alléén in een geïnstalleerde PWA (16.4+), **niet** in de
Capacitor-WebView. De app gebruikt native **APNs**. De web-kant is gebouwd:

- `@capacitor/push-notifications` + `components/pwa/native-push-register.tsx` (in de
  member- én owner-layout) registreren het device-token na login.
- `app/account/native-push-actions.ts` slaat het op (`NativePushToken`-model).
- `lib/push-apns.ts` (apns2) verstuurt; **aangehaakt in `sendPushToUser`**, dus álle
  bestaande meldingen (schema's, onderhoud, trofeeën) bereiken automatisch ook iOS.

Te doen aan Apple-kant:

- Xcode → Signing & Capabilities → **Push Notifications** + **Background Modes → Remote notifications**.
- Apple Developer → Keys → **APNs Auth Key (.p8)** aanmaken; vul de env in:
  `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY` (.p8-inhoud), `APNS_BUNDLE_ID`, `APNS_PRODUCTION`.
- `npm i @capacitor/push-notifications` staat al; draai `npx cap sync ios`.

> ⚠️ De APNs-verzending is **niet headless te testen** (vereist Apple-credentials +
> een echt toestel). De code degradeert netjes zonder config en is best-effort.

## 6. Account verwijderen (Apple 5.1.1(v)) — ACTIE VEREIST

Apple eist **in-app account­verwijdering die de gebruiker zélf voltooit**. De
huidige flow (`/account/privacy`) is een *verzoek* dat een beheerder verwerkt —
dat wordt waarschijnlijk **afgekeurd**. Vóór iOS-inzending moet dit een echte
self-service-verwijdering worden. (Zie de losse beslissing hierover.)

## 7. Build, TestFlight & review

- Xcode → selecteer een team, verhoog build-nummer, **Archive** → upload naar **App Store Connect**.
- Distribueer via **TestFlight**, test op een echt toestel (login, QR, haptics, push).
- Vul in App Store Connect: **privacy-nutrition-labels** (EU-data, geen tracking), screenshots per device, beschrijving, leeftijdsclassificatie, support-URL, privacybeleid-URL.
- Dien in voor review.

## Onderhoud

- Web-wijzigingen zijn direct live (de app laadt de gehoste site) — geen nieuwe
  app-build nodig, behálve bij native wijzigingen (plugins/permissies/icoon).
- Nieuwe native build: verhoog het build-nummer, `npx cap sync ios`, Archive, upload.
