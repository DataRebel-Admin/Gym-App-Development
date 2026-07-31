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
| ✅ | Testplan en store-metadata | `store/TESTPLAN.md`, `store/METADATA.md` |

**Geverifieerd:** `tsc --noEmit` schoon, 195 tests groen, `npm run build` slaagt,
`npx cap sync android` vindt alle zes plugins, en `/privacy`, `/cookies` en
`/support` geven 200 zonder login.

**Niet geverifieerd** (geen JDK, Android SDK of macOS op deze machine): de
Gradle-wijzigingen zijn niet gecompileerd, en het hele iOS-project bestaat nog
niet. De eerste `bundleRelease` en de eerste `cap add ios` zijn de echte test.

---

## B. Nog te doen in code, vóór inzending

| | Onderdeel | Waarom |
|---|---|---|
| ☐ | `LEGAL_ENTITY` invullen in `lib/legal.ts` | Adres en KvK-nummer staan nu op `TODO`; zonder die gegevens voldoet de verklaring niet aan artikel 13 AVG |
| ☐ | Privacyteksten juridisch laten controleren | Het zijn conceptteksten, geschreven op basis van wat de code doet |
| ☐ | Overige `gymrebel.app`-verwijzingen omzetten | Cron-fallbacks en e-mailvoorbeelden wijzen nog naar het oude domein |
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
| ☐ | App-record aanmaken, metadata en screenshots invullen | Zie `store/METADATA.md` |
| ☐ | Privacyvragenlijst invullen | Antwoorden staan in METADATA.md |
| ☐ | Reviewnotities met **lid**-testaccount plus QR-afbeelding | Zonder dit is 4.2-afkeuring waarschijnlijk |
| ☐ | TestFlight-ronde op een echt toestel | Loop `store/TESTPLAN.md` af |
| ☐ | Indienen voor review | |

### Google

| | Stap | Opmerking |
|---|---|---|
| ☐ | Play Console-account, €25 eenmalig | Zakelijke accounts vereisen identiteitsverificatie |
| ☐ | Keystore aanmaken met `keytool` | Zie `android/keystore.properties.example`. **Bewaar in een kluis, met back-up** |
| ☐ | `android/keystore.properties` invullen | Staat in .gitignore |
| ☐ | Firebase-project aanmaken, Android-app met dit package toevoegen | |
| ☐ | `google-services.json` in `android/app/` plaatsen | Zonder dit registreert de app geen pushtoken |
| ☐ | Service-account-sleutel maken, `FCM_*` in productie-env zetten | Zonder dit verstuurt de server niets |
| ☐ | `./gradlew bundleRelease` en de AAB uploaden | Interne test eerst |
| ☐ | Play App Signing aanzetten | Aanbevolen: Google kan je uploadsleutel dan resetten |
| ☐ | SHA-256-fingerprints in `ANDROID_CERT_FINGERPRINTS` zetten | Zowel je uploadsleutel als de Play-signing-sleutel, komma-gescheiden |
| ☐ | Controleer `/.well-known/assetlinks.json` | Anders openen deep links in de browser |
| ☐ | Store-listing invullen, inclusief **feature graphic 1024×500** | Verplicht bij Play |
| ☐ | Data safety-formulier invullen | Antwoorden staan in METADATA.md |
| ☐ | Contentclassificatie-vragenlijst | |
| ☐ | Interne test → gesloten test → productie | |

### Beide

| | Stap |
|---|---|
| ☐ | Domein `app.gymrebel-training.nl` live met geldig certificaat |
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
