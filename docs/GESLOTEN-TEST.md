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
| ☐ | **`DEMO_LOGIN_TENANTS` zetten** in Vercel | Staat nu leeg, dus het paneel is leeg (fail-closed). Zie §1 |
| ☐ | **`LEGAL_ENTITY` invullen** in `lib/legal.ts` | `/privacy` toont nu letterlijk "TODO: KvK-nummer". Dat is de URL die je bij Play indient |
| ☐ | **Accounts voor je testers** | Opgelost via demo-login op de demo-gym (§1). Wil je aparte accounts per tester, dan maak je ze aan onder `/owner/members` |

### Demo-login

Op `https://app.gymrebel-training.com/login` stond een paneel waarmee je zonder
wachtwoord kon inloggen als **superadmin** — alle sportscholen, het auditlog, de
e-mailtemplates en de meldingen-inbox. De code is inmiddels aangescherpt
(`lib/demo-login-policy.ts`): in productie nooit een superadmin, en alleen
sportscholen die in `DEMO_LOGIN_TENANTS` staan. Die staat leeg, dus na de
deploy is het paneel leeg.

**Gekozen: aan, maar alleen voor de demo-sportschool.** Testers klikken zichzelf
naar binnen zonder uitnodiging. In Vercel hoeft daarvoor één variabele bij
(`DEMO_LOGIN` en `DEMO_LOGIN_ALLOW_PRODUCTION` staan al op `true`):

```
DEMO_LOGIN_TENANTS="gymrebel"
```

Drie dingen om te weten bij deze keuze:

- **Controleer eerst dat de tenant `gymrebel` alleen demo-data bevat.** Iedereen
  met de testlink kan er straks als *eigenaar* in (`keimpe@gymrebel.nl` staat in
  het paneel), en die rol ziet alle leden, kan exporteren en verwijderen. Staat
  er iets echts in, gebruik dan een aparte tenant `demo`.
- **Testers delen accounts.** Het paneel toont maximaal zes accounts per
  sportschool, dus twaalf testers loggen als dezelfde handvol leden in en zien
  elkaars sets, metingen en schema's door elkaar lopen. Wil je zinnige feedback,
  maak dan alsnog een stuk of zes extra leden aan in die tenant zodat de meesten
  hun eigen account hebben.
- **Zet dit uit vóór productie.** Voor een gesloten test is het een bewuste
  afweging; op een openbare release hoort geen wachtwoordloze ingang.

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
| ☐ | Gegevensbeveiliging (Data safety) | `docs/METADATA.md`, "Antwoorden op de privacyvragenlijsten" |
| ☐ | Overheidsapp: nee · Financiële functies: nee · Gezondheidsapp: **let op** | Zie de waarschuwing hieronder |
| ☐ | Titel, korte en lange omschrijving | `docs/METADATA.md` |
| ☐ | App-icoon 512×512 | `public/icons/icon-512.png` |
| ☐ | **Feature graphic 1024×500** | `store/assets/play-feature-graphic.png` — gegenereerd met `npm run brand:assets` |
| ☐ | Minimaal 2 telefoonscreenshots (aanbevolen 6) | Plan in `docs/METADATA.md`; met de app op je toestel te maken |
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

> **Het plan is om vóór deze test naar een organisatie-account te gaan** (het
> D-U-N-S-nummer is er al; zie `docs/ROADMAP.md` fase 1). Daarmee vervalt de
> eis van **12 testers, 14 dagen onafgebroken** die voor persoonlijke accounts
> geldt, en bepaal je de testduur zelf.
>
> Loopt het toch via het persoonlijke account, dan geldt die eis wél. Nodig er
> dan liever vijftien uit: testers die halverwege afhaken zetten de teller terug.

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

1. `DEMO_LOGIN_TENANTS="gymrebel"` in Vercel zetten en de deploy afwachten.
   Controleer daarna op `/login` dat er alléén accounts van die ene sportschool
   staan en geen superadmin.
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
