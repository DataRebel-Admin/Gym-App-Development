# Roadmap: van persoonlijk account naar publicatie

De weg van waar we nu staan (interne test, persoonlijk Play-account) naar een
gepubliceerde app onder het bedrijf. De leesvolgorde is de uitvoervolgorde, maar
de drie zaken bovenaan en fase 2 lopen bewust naast elkaar.

**Waar we nu staan:** de Android-app draait, is via Play geïnstalleerd op een
echt toestel, push werkt in alle categorieën, App Links zijn geverifieerd en de
release is ondertekend. Wat ontbreekt is bedrijfsmatig, niet technisch.

---

## De drie dingen die alles ophouden

Zet deze eerst in gang. Ze hebben doorlooptijd waar je zelf niets aan kunt doen,
en zolang ze open staan kun je niet inzenden.

| | Wat | Waarom het alles blokkeert | Wie |
|---|---|---|---|
| ☐ | `LEGAL_ENTITY` invullen in `lib/legal.ts` | `/privacy` toont nu "TODO: KvK-nummer". Die URL geef je op bij Play en bij Apple, en hij staat in beide privacyvragenlijsten | jij levert adres en KvK, ik zet het erin |
| ☐ | Organisatie-account bij Google, met het bestaande D-U-N-S-nummer | Zonder verificatie geen productietoegang. Kost enkele dagen | jij |
| ☐ | Zakelijke Apple Developer-inschrijving, zelfde D-U-N-S | Langste doorlooptijd van alles. Start hem nu, ook al doe je iOS later | jij |

> Bedrijfsnaam, adres en telefoonnummer moeten **exact** overeenkomen met het
> D-U-N-S-record. Een afwijkende schrijfwijze is de meest voorkomende reden dat
> verificatie blijft hangen.

---

## Fase 1: overzetten naar het bedrijf

Twee routes. Kijk eerst of de eerste kan, want die is verreweg de simpelste.

**Route A, accounttype wisselen.** In de Play Console onder Instellingen,
Accountgegevens. Blijft hetzelfde account, dus er verhuist niets. Of dit voor
jouw account beschikbaar is moet je daar zelf zien; Google verandert dit
regelmatig.

**Route B, nieuw organisatie-account plus app-overdracht.** Nodig:

- het organisatie-account aangemaakt en geverifieerd (25 dollar);
- het **ontwikkelaars-ID** van dat account;
- een **transactie-ID** van een betaling op het huidige account als
  eigendomsbewijs. In de praktijk het ordernummer van je 25 dollar
  registratiekosten, dus zoek die mail alvast op.

> **Verwijder de app niet om hem opnieuw aan te maken.** Pakketnamen zijn in
> Play permanent gereserveerd zodra een app bestaat, ook als die nooit
> gepubliceerd is. Weg is dan waarschijnlijk voorgoed weg, en
> `nl.gymrebeltraining.app` staat op de fysieke QR-stickers bij de apparaten.

**Wat er niet verandert bij A of B:** de pakketnaam, de
Play-ondertekeningssleutel en dus de vier fingerprints in
`ANDROID_CERT_FINGERPRINTS`. De sleutel hoort bij de app, niet bij het account,
en verhuist dus mee. `assetlinks.json` blijft kloppen, App Links blijven werken
en je hebt geen nieuwe AAB nodig. Je uploadsleutel in `Documents/GymRebel-keys/`
blijft van jou.

**Wat wel aandacht vraagt na een overdracht:** gebruikersrechten in de console
opnieuw inrichten, en gekoppelde diensten nalopen. Firebase staat los (dat is
een Google Cloud-project), dus push blijft ongemoeid.

**Wat je hiermee wint:** organisatie-accounts zijn vrijgesteld van de eis van
12 testers gedurende 14 aaneengesloten dagen. Dat scheelt twee weken
kalenderwachten voordat je productie mag aanvragen.

---

## Fase 2: store-inzending klaarmaken

Kan volledig parallel aan fase 1. Alles hieronder staat uitgeschreven in
`docs/METADATA.md` en `docs/GESLOTEN-TEST.md` paragraaf 2.

| | Onderdeel | Stand |
|---|---|---|
| ☐ | App-inhoud: privacy, app-toegang, advertenties, contentclassificatie, doelgroep, gegevensbeveiliging | Antwoorden staan klaar; wacht op de privacy-URL zonder TODO |
| ☐ | Titel, korte en lange omschrijving | Teksten klaar in METADATA.md |
| ✅ | App-icoon 512x512 | `public/icons/icon-512.png` |
| ✅ | Feature graphic 1024x500 | `store/assets/play-feature-graphic.png` |
| ☐ | Zes telefoonscreenshots | Plan in METADATA.md. Maken op je toestel, met een demo-lidaccount met echte data |
| ☐ | Landen | Nederland volstaat om te beginnen |

Screenshots zijn het enige echte handwerk. Doe ze in een sessie op een toestel,
met dezelfde sportschool, zodat de accentkleur consistent is.

---

## Fase 3: gesloten test

Draaiboek: `docs/GESLOTEN-TEST.md`. In het kort:

1. `DEMO_LOGIN_TENANTS="gymrebel"` in Vercel, deploy afwachten, `/login`
   controleren op alleen die ene sportschool en geen superadmin.
2. Controleren dat de tenant `gymrebel` uitsluitend demo-data bevat; iedereen
   met de testlink kan er als eigenaar in.
3. Een stuk of zes extra demo-leden aanmaken, zodat testers niet allemaal op
   hetzelfde account zitten en elkaars sets zien.
4. Testers toevoegen in Play en de opt-in-link rondsturen.
5. `docs/TESTPLAN.md` aflopen, nu op toestellen die niet van jou zijn.
6. Bugs verzamelen en oplossen. Webfixes staan direct live, dus daar is geen
   nieuwe release voor nodig.

**Duur:** zonder de eis van 12 testers gedurende 14 dagen bepaal je die zelf.
Een tot twee weken levert bruikbare feedback op; korter en je hoort alleen de
eerste indruk.

---

## Fase 4: productie, Android

1. Productietoegang aanvragen vanuit het organisatie-account.
2. **Demo-login uit**: `DEMO_LOGIN="false"`. Op een openbare release hoort geen
   wachtwoordloze ingang.
3. `CAPACITOR_SERVER_URL` controleren op productie. Verifieer in de bundel zelf:
   `unzip -p app-release.aab base/assets/capacitor.config.json`
4. Gefaseerde uitrol (bijvoorbeeld 20 procent), zodat een probleem niet meteen
   iedereen raakt.
5. Eerste dagen meekijken: crashrapporten in Play, en de meldingen-inbox op
   `/admin/meldingen`.

---

## Fase 5: iOS

Kan pas beginnen als de Apple-inschrijving rond is **en** je een Mac hebt. Het
`ios/`-project bestaat nog niet en is niet op Windows te genereren.

1. Op een Mac: `npx cap add ios`, dan `npm run brand:assets` en
   `npm run ios:plist`.
2. In Xcode: team kiezen, Push Notifications en Associated Domains aanzetten.
   Dat zijn entitlements, die kunnen niet vanuit de repo.
3. APNs-sleutel (.p8) maken, `APNS_*` en `APPLE_APP_ID` in de
   productie-omgeving.
4. Archiveren, uploaden, TestFlight-ronde, `docs/TESTPLAN.md` aflopen.
5. Inzenden. Reken op een of twee afkeurrondes op richtlijn 4.2; geef de
   reviewer een **lid**-account, geen eigenaar.

---

## Volgorde in een oogopslag

```
nu        LEGAL_ENTITY  +  org-account Google  +  Apple-inschrijving
             |                    |                      |
             |              fase 1 overzetten            |
             |                    |                      |
             +------> fase 2 store-inzending klaar       | (loopt door)
                                  |                      |
                            fase 3 gesloten test         |
                                  |                      |
                            fase 4 productie Android     |
                                                         |
                                                   fase 5 iOS
```

De kritieke lijn is de Apple-inschrijving. De hele Android-tak kun je afronden
terwijl die loopt.
