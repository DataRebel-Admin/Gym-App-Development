# Publiceerchecklist

Twee lijsten: wat in de repo geregeld is, en wat alleen jij kunt doen omdat het
een account, een betaalmiddel of een Mac vereist.

---

## A. Klaar in code en configuratie

| | Onderdeel | Waar |
|---|---|---|
| ✅ | Capacitor voor iOS **en** Android, TWA uitgefaseerd | `capacitor.config.ts` |
| ✅ | Bundle ID `nl.gymrebeltraining.app`, één id voor beide stores | idem |
| ✅ | Remote `server.url` met gebrande offlinepagina | `capacitor/www/error.html` |
| ✅ | Android-project gegenereerd, `cap sync` schoon | `android/` |
| ✅ | Permissies minimaal en onderbouwd | `AndroidManifest.xml` |
| ✅ | Alleen HTTPS, geen mixed content, geen debugbare WebView | `network_security_config.xml` |
| ✅ | Geen sessiecookies in back-ups of toestel-overdracht | `data_extraction_rules.xml` |
| ✅ | App Links-intent-filter met autoVerify | `AndroidManifest.xml` |
| ✅ | Info.plist-sleutels als idempotent script | `npm run ios:plist` |
| ✅ | Iconen en splash uit één vectorbron, beide platforms | `npm run brand:assets` |
| ✅ | iOS-icoon zonder alfakanaal (`ITMS-90717`) | `scripts/generate-brand-assets.ts` |
| ✅ | Android 12+ startscherm | `res/values-v31/styles.xml` |
| ✅ | Meldingsicoon als alfa-silhouet | `res/drawable-*/ic_stat_gymrebel.png` |
| ✅ | Versiebeheer met één bron van waarheid | `app-version.json`, `npm run version:*` |
| ✅ | Release-buildconfiguratie, signing via properties of env | `android/app/build.gradle` |
| ✅ | Keystore en `google-services.json` uit git geweerd | `android/.gitignore` |
| ✅ | Native push: APNs (iOS) **en** FCM (Android) | `lib/push-apns.ts`, `lib/push-fcm.ts` |
| ✅ | Melding aantikken navigeert naar de juiste pagina | `components/pwa/native-push-register.tsx` |
| ✅ | Meldingskanalen per categorie, met eigen belangrijkheid | `lib/push-channels.ts` |
| ✅ | Melding zichtbaar terwijl de app openstaat (banner op iOS, in-app op Android) | `capacitor.config.ts`, `native-push-register.tsx` |
| ✅ | Push-token ingetrokken bij uitloggen | `components/pwa/native-push-cleanup.tsx` |
| ✅ | Deep links openen de juiste pagina in de app | `components/pwa/deep-link-handler.tsx` |
| ✅ | Publieke privacyverklaring, cookiebeleid en supportpagina | `/privacy`, `/cookies`, `/support` |
| ✅ | Account verwijderen in de app, automatisch uitgevoerd | `/account/privacy` + cron |
| ✅ | Gegevensexport in de app | `/account/export` |
| ✅ | Testplan, store-metadata en releaseconventie | `docs/TESTPLAN.md`, `docs/METADATA.md`, `docs/RELEASES.md` |

**Geverifieerd in code:** `tsc --noEmit` schoon, 212 tests groen, `npm run build`
slaagt, `npx cap sync android` vindt alle zes plugins, en `/privacy`, `/cookies`
en `/support` geven 200 zonder login.

**Geverifieerd op een echt toestel** (OnePlus 11, Android 15):
`assembleDebug` bouwt, installeert en draait; de app laadt de gehoste site; het
app-icoon en het gestapelde logo kloppen; `versionName`/`versionCode` komen exact
uit `app-version.json`; de permissies op het toestel zijn de verwachte zes (drie
eigen, drie via manifest-merge uit de plugins); het App Links-domein is
geregistreerd. `bundleRelease` bouwt en levert een **ondertekende** AAB, en zonder
keystore een ongetekende mét waarschuwing, precies zoals bedoeld.

**Niet geverifieerd:** alles rond iOS. Dat project bestaat nog niet en is niet op
Windows te genereren; de eerste `cap add ios` op een Mac is daar de echte test.
Ook deep-linkverificatie kan pas als `app.gymrebel-training.com` live staat,
want Android haalt de `assetlinks.json` bij dát domein op.

---

## B. Nog te doen in code, vóór inzending

| | Onderdeel | Waarom |
|---|---|---|
| ☐ | `LEGAL_ENTITY` invullen in `lib/legal.ts` | **Blokkeert de gesloten test.** `/privacy` toont nu letterlijk "TODO: KvK-nummer", en dat is de URL die je bij Play indient |
| ☐ | Demo-login-keuze doorvoeren in Vercel | **Blokkeert de gesloten test.** Zie `docs/GESLOTEN-TEST.md` §1 |
| ☐ | Privacyteksten juridisch laten controleren | Het zijn conceptteksten, geschreven op basis van wat de code doet |
| ✅ | Overige `gymrebel.app`-verwijzingen omzetten | Cron-fallbacks lopen nu allemaal via `appBaseUrl()` (lib/app-url.ts); e-mailvoorbeelden, VAPID-subject en afzenderadres staan op `gymrebel-training.com` |
| ☐ | Optioneel: schema-editor verbergen op kleine schermen | De owner-area is verrassend mobielvriendelijk, maar de drag-and-drop-editor over meerdere dagen werkt niet op een telefoon. Er bestaat niet voor niets een aparte mobiele lid-builder |

**Besloten en afgerond:** de app wordt gepositioneerd als sporter-app in de
store-teksten, screenshots en het reviewaccount, maar medewerkers worden
technisch **niet** geblokkeerd. Blokkeren zou mobiel zinvolle taken afpakken:
een defect afhandelen bij het apparaat, aanwezigheid afvinken bij een les, het
schema van een lid opzoeken tijdens een sessie.

---

## C. Alleen jij kunt dit doen

### Apple

| | Stap | Opmerking |
|---|---|---|
| ☐ | Apple Developer Program, €99 per jaar | Duurt soms dagen bij een zakelijke inschrijving (D-U-N-S-nummer) |
| ☐ | App-ID aanmaken met `nl.gymrebeltraining.app` | Zet Push Notifications en Associated Domains aan |
| ☐ | APNs Auth Key (.p8) aanmaken | Vul `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY` |
| ☐ | `APPLE_APP_ID` = `<TeamID>.nl.gymrebeltraining.app` in productie-env | Vult de AASA-route |
| ☐ | Op een Mac: `npx cap add ios`, `npm run brand:assets`, `npm run ios:plist` | Kan ook op een macOS-CI-runner |
| ☐ | In Xcode: team kiezen, Push Notifications en Associated Domains aanzetten | Entitlements, niet vanuit de repo te zetten |
| ☐ | Archiveren en uploaden naar App Store Connect | |
| ☐ | App-record aanmaken, metadata en screenshots invullen | Zie `docs/METADATA.md` |
| ☐ | Privacyvragenlijst invullen | Antwoorden staan in METADATA.md |
| ☐ | Reviewnotities met **lid**-testaccount plus QR-afbeelding | Zonder dit is 4.2-afkeuring waarschijnlijk |
| ☐ | TestFlight-ronde op een echt toestel | Loop `docs/TESTPLAN.md` af |
| ☐ | Indienen voor review | |

### Google

| | Stap | Opmerking |
|---|---|---|
| ☐ | Play Console-account, €25 eenmalig | Zakelijke accounts vereisen identiteitsverificatie |
| ✅ | Keystore aangemaakt met `keytool` | Ligt buiten de repo in `Documents/GymRebel-keys/`, geldig tot 2054. **Zonder deze sleutel plus wachtwoord kun je nooit meer updaten** |
| ✅ | `android/keystore.properties` ingevuld | Staat in .gitignore; `bundleRelease` levert nu een ondertekende AAB |
| ✅ | Firebase-project aangemaakt, Android-app toegevoegd | |
| ✅ | `google-services.json` in `android/app/` | Staat er; app registreert een pushtoken |
| ✅ | Service-account-sleutel, `FCM_*` in productie-env | Push geverifieerd op een toestel in alle vier de categorieën |
| ✅ | **Vóór het bouwen: `CAPACITOR_SERVER_URL` op productie zetten** | Bouw je met een tunnel- of preview-URL nog in `android/app/src/main/assets/capacitor.config.json`, dan wijst de gepubliceerde app daarheen. Controleer met: `unzip -p app-release.aab base/assets/capacitor.config.json` |
| ✅ | `./gradlew bundleRelease` en de AAB uploaden | Interne test draait; installeren via Play geverifieerd |
| ✅ | Play App Signing aan | Google kan je uploadsleutel resetten |
| ✅ | SHA-256-fingerprints in `ANDROID_CERT_FINGERPRINTS` | Alle vier live: uploadsleutel, Play-deploymentsleutel en de twee hybride certificaten |
| ✅ | `/.well-known/assetlinks.json` gecontroleerd | Live, HTTP 200, vier fingerprints; App Links `verified` op toestel |
| ◐ | Store-listing invullen | Teksten in METADATA.md; **feature graphic klaar** (`store/assets/play-feature-graphic.png`, `npm run brand:assets`). Screenshots nog maken |
| ☐ | Data safety-formulier invullen | Antwoorden staan in METADATA.md |
| ☐ | Contentclassificatie-vragenlijst | |
| ◐ | Interne test → gesloten test → productie | Interne test draait. Draaiboek: **`docs/GESLOTEN-TEST.md`** | |

### Beide

| | Stap |
|---|---|
| ☐ | Domein `app.gymrebel-training.com` live met geldig certificaat |
| ☐ | `CAPACITOR_SERVER_URL` en `NEXT_PUBLIC_APP_DOMAIN` in de productie-env |
| ☐ | Demo-lidaccount met realistische data voor screenshots en review |
| ☐ | Testplan afgetekend op een fysieke iPhone én een Android-toestel |

---

## D. Volgorde die het minste wachttijd oplevert

1. **Nu:** Apple Developer Program en Play Console aanvragen. Beide kennen
   verificatiedoorlooptijd, en zolang die loopt kun je niets inzenden.
2. **Ondertussen:** `LEGAL_ENTITY` invullen, de privacyteksten laten nakijken,
   de supportpagina bouwen en het domein live zetten.
3. **Zodra Play beschikbaar is:** keystore maken, Firebase opzetten, AAB naar de
   interne test. Android is de snelste weg naar een werkende app op een toestel.
4. **Zodra Apple beschikbaar is:** iOS-project genereren op een Mac of CI-runner,
   TestFlight-build, testplan aflopen.
5. **Als laatste:** screenshots maken met echte data, metadata invullen, inzenden.
   Reken bij Apple op één of twee afkeurrondes op richtlijn 4.2.
