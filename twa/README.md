# GymRebel op de Play Store (Android via TWA)

Een **Trusted Web Activity (TWA)** is Google's officieel ondersteunde manier om een
PWA als native Android-app in de Play Store te zetten — een dunne, vrijwel
onzichtbare wrapper rond de gehoste web-app.

## Wat al klaar is in de repo (web-kant)

- PWA-manifest (`/manifest.webmanifest`) + iconen (192 / 512 / maskable-512, apple-180).
- Offline-shell service worker.
- **`/.well-known/assetlinks.json`** — env-gedreven Digital Asset Links (`app/.well-known/assetlinks.json/route.ts`).
- **`twa/twa-manifest.json`** — Bubblewrap-config (pas `host` en `packageId` aan naar je echte waarden).

De rest (AAB bouwen + Play Console) gebeurt buiten de repo — hieronder stap voor stap.

## Vereisten

- **Node.js** + **JDK 17** + **Android SDK** (of Android Studio).
- **Bubblewrap CLI**: `npm i -g @bubblewrap/cli`
- **Google Play Console**-account (€25 eenmalig).
- Productie live op **HTTPS** met de PWA-audit ("Installable") groen (Chrome DevTools → Lighthouse).

## 1. Config afstemmen

Pas in `twa/twa-manifest.json` aan:

- `host` → je productiedomein (bv. `app.gymrebel.app`).
- `packageId` → je gekozen package-id (bv. `app.gymrebel.twa`). **Onveranderlijk na publicatie** — kies bewust.
- `webManifestUrl` / `iconUrl` / `maskableIconUrl` / `fullScopeUrl` → zelfde domein.

## 2. TWA genereren & bouwen

```bash
# In een aparte map (niet nodig in deze repo):
bubblewrap init --manifest https://<jouw-domein>/manifest.webmanifest
# ...of hergebruik twa/twa-manifest.json en draai:
bubblewrap build
```

- Bij de eerste build maakt Bubblewrap een **keystore** (`android.keystore`). **Bewaar die + het wachtwoord veilig** — zonder die kun je geen updates meer publiceren.
- Output: `app-release-signed.aab` (upload naar Play) + een test-APK.

## 3. Digital Asset Links koppelen (cruciaal — anders blijft de URL-balk zichtbaar)

1. Haal de **SHA-256 fingerprint(s)** op:
   - Upload-key: `keytool -list -v -keystore android.keystore -alias android` (Bubblewrap toont 'm ook na de build).
   - **Play App Signing**-key: Play Console → je app → *Test and release → App integrity → App signing → SHA-256*. (Aanbevolen; Google hertekent je app, dus déze key telt óók.)
2. Zet in de **productie-env** (Vercel):
   ```
   ANDROID_PACKAGE_NAME=app.gymrebel.twa
   ANDROID_CERT_FINGERPRINTS=AA:BB:CC:...,DD:EE:FF:...
   ```
   (Beide fingerprints, komma-gescheiden — upload-key én Play App Signing-key.)
3. Deploy en controleer: `https://<domein>/.well-known/assetlinks.json` toont nu de statements met beide fingerprints.
4. Verifieer met de [Digital Asset Links API](https://developers.google.com/digital-asset-links/tools/generator) of `bubblewrap validate`.

## 4. Play Console

- Nieuwe app aanmaken; package name = `ANDROID_PACKAGE_NAME`.
- Zet **Play App Signing** aan (aanbevolen).
- Upload de **AAB** naar de **interne test**-track.
- Store-listing: korte + volledige omschrijving, **telefoon-screenshots** (min. 2), optioneel tablet, **feature graphic** (1024×500), app-icoon, categorie (Gezondheid & fitness), contactgegevens, **privacybeleid-URL**.
- **Data safety**-formulier: EU-data, geen tracking, geen verkoop → eerlijk en kort.
- **Content rating**-vragenlijst + doelgroep.

## 5. Uitrol

Interne test → gesloten test → **productie**. Na goedkeuring: installeer op een toestel en controleer dat:

- de **URL-balk weg is** (= assetlinks klopt),
- **web-push** binnenkomt als Android-notificatie (`enableNotifications: true`),
- **passkeys** werken — hiervoor moet `WEBAUTHN_RP_ID` een domein zijn dat matcht (zie hoofd-`.env.example`); native passkey-ondersteuning in de TWA vergt dezelfde domein-koppeling.

## Onderhoud

- **Nieuwe versie**: verhoog `appVersionCode` (+1) en `appVersionName` in `twa/twa-manifest.json`, dan `bubblewrap update && bubblewrap build`, en upload de nieuwe AAB.
- **Target API level**: Google verhoogt de minimum jaarlijks; `bubblewrap update` trekt dit mee.
- Wijzig **nooit** de `packageId` of raak de keystore kwijt.
