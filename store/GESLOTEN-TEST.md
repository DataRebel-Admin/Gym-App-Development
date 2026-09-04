# Gesloten test in Google Play

De stap tussen de interne test (die draait) en productie. Dit document is het
draaiboek: wat er moet kloppen vóór je hem opent, en in welke volgorde.

> Interne test = jouw eigen toestellen, geen review, geen eisen aan de listing.
> **Gesloten test = echte mensen buiten je organisatie.** Play controleert de
> app dan wél op beleid, de store-listing moet compleet zijn, en de testlink is
> deelbaar. Alles wat "dat zien alleen wij" was, is dat nu niet meer.

---

## 1. Blokkades — deze eerst

| | Wat | Waarom het blokkeert |
|---|---|---|
| ☐ | **Demo-login uitzetten of inperken** in Vercel | Zie hieronder. Zolang dit aanstaat geef je iedereen met de testlink toegang tot alle sportscholen |
| ☐ | **`LEGAL_ENTITY` invullen** in `lib/legal.ts` | `/privacy` toont nu letterlijk "TODO: KvK-nummer". Dat is de URL die je bij Play indient |
| ☐ | **Accounts voor je testers** | De app is invite-only; een tester kan zich niet zelf registreren en staat anders voor een dichte deur |

### Demo-login

Op `https://app.gymrebel-training.com/login` stond een paneel waarmee je zonder
wachtwoord kon inloggen als **superadmin** — alle sportscholen, het auditlog, de
e-mailtemplates en de meldingen-inbox. De code is inmiddels aangescherpt
(`lib/demo-login-policy.ts`): in productie nooit een superadmin, en alleen
sportscholen die in `DEMO_LOGIN_TENANTS` staan. Die staat leeg, dus na de
deploy is het paneel leeg.

Kies bewust één van twee:

- **Uit** — zet `DEMO_LOGIN="false"` in Vercel. Het veiligst. Je testers krijgen
  dan een eigen uitnodiging (zie §3).
- **Aan voor de demo-gym** — laat `DEMO_LOGIN="true"` staan en zet
  `DEMO_LOGIN_TENANTS="gymrebel"`. Testers klikken zichzelf naar binnen als lid
  van de demo-sportschool. Scheelt twaalf uitnodigingen, maar iedereen met de
  link deelt dan dezelfde demo-data en kan elkaars invoer zien.

---

## 2. Wat Play verlangt voordat je een gesloten test mag starten

Alles onder **App-inhoud** moet groen zijn, en de hoofd-store-listing compleet.

| | Onderdeel | Waar het antwoord staat |
|---|---|---|
| ☐ | Privacybeleid-URL | `https://app.gymrebel-training.com/privacy` |
| ☐ | App-toegang: inloggegevens voor de reviewer | §4 hieronder |
| ☐ | Advertenties: **nee** | De app bevat er geen |
| ☐ | Contentclassificatie (vragenlijst) | Geen geweld, gokken, gebruikersinteractie-met-vreemden; komt uit op 3+/PEGI 3 |
| ☐ | Doelgroep: 18+ | Geen kinderen; dat scheelt de Families-eisen |
| ☐ | Gegevensbeveiliging (Data safety) | `store/METADATA.md`, "Antwoorden op de privacyvragenlijsten" |
| ☐ | Overheidsapp: nee · Financiële functies: nee · Gezondheidsapp: **let op** | Zie de waarschuwing hieronder |
| ☐ | Titel, korte en lange omschrijving | `store/METADATA.md` |
| ☐ | App-icoon 512×512 | `public/icons/icon-512.png` |
| ☐ | **Feature graphic 1024×500** | `store/assets/play-feature-graphic.png` — gegenereerd met `npm run brand:assets` |
| ☐ | Minimaal 2 telefoonscreenshots (aanbevolen 6) | Plan in `store/METADATA.md`; met de app op je toestel te maken |
| ☐ | Landen kiezen | Nederland volstaat om te beginnen |

> **Gezondheidsapp-vraag.** GymRebel registreert trainingen en lichaamsmetingen.
> Dat is geen medische app en geen Health Connect-koppeling, dus "nee" op de
> gezondheidsvragen is verdedigbaar. Wees wel consistent: de Data safety-opgave
> moet "Gezondheid en fitness" bevatten, want dat verzamel je wél.

---

## 3. Testers

Play wil een lijst met e-mailadressen (of een Google Groep). Twee dingen die
mensen hier vaak vergeten:

1. **Het adres in Play is hun Google-account**, waarmee ze de app downloaden.
   Het account waarmee ze in GymRebel inloggen mag een ander adres zijn.
2. **Ze moeten de opt-in-link openen** voordat de app in de Play Store voor hen
   verschijnt. Alleen op de lijst staan is niet genoeg.

Voor het inloggen in de app zelf: maak per tester een lid aan onder
`/owner/members` van een testsportschool. Ze krijgen een uitnodigingsmail en
zetten daarmee hun wachtwoord. Controleer daarna in het auditlog of die mail
echt verstuurd is: `user.invite.email` met status FAILED betekent dat er niets
wegging (zie de e-mailsectie in CLAUDE.md).

> **Heb je een persoonlijk Play-account** (geen organisatie), dan geldt de extra
> eis: minimaal **12 testers, 14 dagen onafgebroken** opgegeven, voordat je
> productietoegang mag aanvragen. Testers die halverwege afhaken zetten de teller
> terug, dus nodig er liever 15 uit. Voor een organisatie-account vervalt deze
> eis.

---

## 4. App-toegang voor de reviewer

De app zit volledig achter een login, dus dit veld is verplicht. Vul in:

```
Alle functionaliteit zit achter een account. De app is voor sportscholen en
hun leden; accounts worden door de sportschool aangemaakt, er is bewust geen
zelfregistratie.

Inloggen: open de app, vul het e-mailadres en wachtwoord hieronder in.
E-mail:    <lid-testaccount>
Wachtwoord: <wachtwoord>

Dit account is een sporter. Na inloggen: "Mijn schema" toont het
trainingsschema, "Start training" opent de sessie waarin sets gelogd worden,
en het scan-icoon opent de camera voor de QR-code op een apparaat.
```

Gebruik een **lid**-account, geen eigenaar. Een reviewer die op een telefoon een
beheerdersdashboard ziet, beoordeelt een andere app dan je inzendt.

---

## 5. Volgorde

1. Demo-login-keuze doorvoeren in Vercel en de deploy afwachten.
2. `LEGAL_ENTITY` invullen, deployen, `/privacy` controleren op "TODO".
3. Screenshots maken op je toestel (6 stuks, plan in METADATA.md).
4. In de Play Console: App-inhoud volledig invullen, daarna de store-listing.
5. Testers aanmaken in GymRebel én toevoegen in Play.
6. De bestaande release van interne test **promoveren** naar gesloten test — er
   is geen nieuwe AAB nodig zolang er niets natives wijzigde. Controleer dat wel
   met: `unzip -p app-release.aab base/assets/capacitor.config.json`
7. Opt-in-link rondsturen en zelf verifiëren dat installeren en inloggen werkt
   met een tester-account dat niet van jou is.
8. Vanaf dag 1 de teller in de gaten houden als de 12/14-eis geldt.
