# Store-metadata (concept)

Conceptteksten voor App Store Connect en Google Play Console. **Nog niet
definitief:** lees ze door op toon en inhoud, en laat de claims kloppen met wat
er op het moment van inzenden echt in de app zit.

Uitgangspunt: dit is een **app voor sporters**. De eigenaars- en coachschermen
zijn desktop-first en komen niet voor in de teksten of de screenshots.

---

## Naam en ondertitel

| Veld | Voorstel | Limiet |
|---|---|---|
| App-naam (icoon) | `GymRebel` | iOS kapt af rond 12 tekens |
| App Store naam | `GymRebel Training` | 30 |
| App Store ondertitel | `Jouw schema, jouw voortgang` | 30 |
| Play titel | `GymRebel Training` | 30 |
| Play korte omschrijving | `Je trainingsschema, je voortgang en alle uitleg bij de apparaten in je sportschool.` | 80 |

> De naam in de store mag langer zijn dan het label onder het icoon. "Training"
> erbij maakt 'm vindbaar en sluit aan op het domein en het Brand Book.

---

## Korte omschrijving (Play, max 80 tekens)

```
Je trainingsschema, je voortgang en uitleg bij elk apparaat in je sportschool.
```

---

## Lange omschrijving

Werkt voor beide stores (App Store max 4000 tekens, Play max 4000).

```
GymRebel is de app van jouw sportschool. Je trainingsschema staat erin, je
voortgang wordt bijgehouden en bij elk apparaat vind je meteen de juiste uitleg.

JOUW SCHEMA, ALTIJD BIJ DE HAND
Je coach stelt een schema samen dat past bij jouw doel. Je opent het op je
telefoon, ziet per oefening wat je moet doen en logt je sets terwijl je traint.
Rusttijden lopen automatisch mee, met trilfeedback zodat je niet op je scherm
hoeft te kijken.

SCAN HET APPARAAT
Weet je niet hoe een apparaat werkt? Scan de QR-code die erop zit en je ziet
direct de oefening, de uitvoering en waar je op moet letten. Is het apparaat
bezet, dan stelt de app een alternatief voor dat dezelfde spieren traint.

ZIE WAT JE OPBOUWT
Je gewichten, herhalingen en persoonlijke records worden automatisch bijgehouden.
Op de spierkaart zie je in één oogopslag welke spiergroepen je traint en welke
achterblijven. Verdien trofeeën terwijl je consistent doortraint.

BOUW ZELF MEE
Staat je sportschool het toe, dan stel je zelf een schema samen binnen de kaders
die je coach heeft ingesteld. Of vraag je huidige schema aan te passen, zonder
dat je iemand hoeft op te zoeken in de zaal.

MELD WAT KAPOT IS
Rammelt er iets aan een apparaat? Meld het in een paar tikken, met foto. Je
sportschool ziet het direct en anderen zien dat het al gemeld is.

VOOR SPORTSCHOLEN
GymRebel wordt aangeboden via je sportschool. Je hebt dus een account van je eigen
gym nodig om in te loggen. Je gegevens staan op Europese servers, we tonen geen
advertenties en verkopen niets door.
```

**Nog te controleren vóór publicatie:**

- "Trofeeën" en "spierkaart" zijn per sportschool in- of uitschakelbaar. Beschrijf
  je functies die niet iedereen ziet, dan is een zin als "als je sportschool dit
  aanzet" eerlijker.
- Zelf schema's bouwen staat standaard **uit** per tenant. De formulering
  hierboven ondervangt dat al ("Staat je sportschool het toe").

---

## Categorie en trefwoorden

| | App Store | Play |
|---|---|---|
| Categorie | Gezondheid en fitness | Gezondheid en fitness |
| Tweede categorie | Sport | n.v.t. |
| Leeftijd | 4+ | Iedereen |

**App Store trefwoorden** (max 100 tekens, komma's zonder spaties, geen woorden
uit de naam herhalen):

```
sportschool,fitness,krachttraining,workout,schema,trainingslog,gym,coach,voortgang,oefeningen
```

> Play kent geen trefwoordenveld: daar bepaalt de tekst zelf de vindbaarheid.
> Zorg dus dat "sportschool", "trainingsschema" en "krachttraining" natuurlijk in
> de lange omschrijving voorkomen. Dat is nu het geval.

---

## Screenshotplan

Nog te maken. Volgorde is bewust: de eerste twee bepalen of iemand doorscrolt.

| # | Scherm | Boodschap in beeld |
|---|---|---|
| 1 | `/member/schema` met een actief schema | "Jouw schema, klaargezet door je coach" |
| 2 | Actieve sessie met de setinvoer en rusttimer | "Log je sets terwijl je traint" |
| 3 | QR-scan met een oefening in beeld | "Scan het apparaat, zie meteen de uitvoering" |
| 4 | `/member/muscles` spierkaart | "Zie welke spieren je traint" |
| 5 | `/member/progress` grafiek met een persoonlijk record | "Volg je vooruitgang" |
| 6 | `/member/trophies` | "Blijf gemotiveerd" |

**Benodigde formaten**

- **App Store:** 6,7 inch (1290×2796) verplicht, 6,5 inch (1242×2688) aanbevolen,
  plus 12,9 inch iPad (2048×2732) alleen als je de app als iPad-compatibel
  aanbiedt. Overweeg dat laatste uit te zetten: de member-UI is voor telefoons
  ontworpen, en een uitgerekte iPad-weergave is een bekende afkeurreden.
- **Play:** minimaal 2, aanbevolen 6 telefoonscreenshots (minimaal 1080 px op de
  korte zijde), plus een **feature graphic van 1024×500** die verplicht is.

**Aanpak:** maak de screenshots met een demo-lidaccount met realistische data,
niet met "Test Testeriaan" en lege grafieken. Gebruik dezelfde tenant voor alle
zes, zodat de accentkleur consistent is.

---

## Verplichte URL's en contactgegevens

| Veld | Waarde |
|---|---|
| Privacybeleid | `https://app.gymrebel-training.nl/privacy` |
| Cookiebeleid | `https://app.gymrebel-training.nl/cookies` |
| Support-URL | `https://app.gymrebel-training.nl/support` |
| Marketing-URL | `https://gymrebel-training.nl` |
| Contact-e-mail | `support@gymrebel-training.nl` |

> De supportpagina staat bewust in de app zelf, zodat de inzending niet hoeft te
> wachten op de marketingsite. Beide stores laten je de support-URL later
> aanpassen **zonder nieuwe app-build**, dus verhuizen naar
> `gymrebel-training.nl/support` kan op elk moment.
>
> Een `mailto:`-link accepteert Apple niet als support-URL; het moet een echte
> webpagina zijn die zonder account te openen is.

---

## Antwoorden op de privacyvragenlijsten

Beide stores stellen dezelfde vragen anders. Onderstaande antwoorden volgen uit
wat de app werkelijk doet; ze horen te matchen met `/privacy`.

**Verzamelde gegevens, gekoppeld aan de gebruiker:**

- Contactgegevens: naam, e-mailadres (voor het account)
- Gebruikersinhoud: trainingsgegevens, metingen, doelen, foto's bij meldingen
- Identificatoren: gebruikers-ID, push-token
- Diagnostiek: crash- en foutgegevens bij een probleemmelding

**Verzameld maar niet aan de gebruiker gekoppeld:** geen.

**Gebruikt voor tracking:** nee. Geen advertentienetwerken, geen datamakelaars,
geen koppeling met gegevens van derden. Bij Apple betekent dat: **geen** App
Tracking Transparency-dialoog nodig.

**Gegevensverwijdering (Play, verplicht):** ja, in de app onder Account →
Privacy, en de verwijdering wordt automatisch uitgevoerd.

**Versleuteling onderweg:** ja, alles over HTTPS.

---

## Reviewnotities voor Apple

Zonder deze uitleg is afkeuring op richtlijn 4.2 waarschijnlijk. Zet dit letterlijk
in het veld "Notes" bij de inzending:

```
GymRebel wordt aangeboden via sportscholen; een account wordt door de sportschool
aangemaakt. Hieronder een werkend testaccount.

Testaccount (lid):
  E-mail:    <invullen>
  Wachtwoord: <invullen>

De app is geen verpakte website. Deze functies zijn native en zijn de reden dat
dit een app is en geen mobiele site:

1. Taptic Engine-feedback bij het loggen van een set en bij het aflopen van de
   rusttimer, zodat de sporter niet naar het scherm hoeft te kijken tijdens een
   oefening.
2. Camerascan van de QR-code op het fitnessapparaat, waarna de bijbehorende
   oefening en uitvoering direct verschijnen.
3. Pushmeldingen via APNs wanneer de coach een nieuw trainingsschema klaarzet.
4. Inloggen met Face ID of Touch ID via passkeys.

Om functie 2 te testen: log in, ga naar Scannen en richt op de QR-code in de
bijlage bij deze inzending.
```

> Voeg een afbeelding van een geldige apparaat-QR toe als bijlage, of zet er een
> in de reviewnotities. Een reviewer heeft geen sportschool bij de hand en kan de
> belangrijkste native functie anders niet testen.
