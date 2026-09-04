# Releases: versies, namen en opmerkingen

Hoe we releases benoemen in App Store Connect en de Play Console, en hoe de
release-opmerkingen eruitzien. Vastgelegd bij de eerste release, zodat alle
volgende dezelfde vorm hebben.

---

## 1. Versienummers

`app-version.json` is de enige bron. `npm run version:sync` schrijft het naar
Gradle en Info.plist, `npm run version:bump` hoogt het buildnummer op.

| | Wat het is | Wanneer omhoog |
|---|---|---|
| `version` | Marketingversie, `x.y.z` | Zie hieronder |
| `build` | Buildnummer, geheel getal | **Bij élke upload**, ook als de versie gelijk blijft |

**Wanneer welk cijfer:**

- **Patch** (1.0.**1**) — opgeloste fouten, geen nieuwe functionaliteit. Verreweg
  het vaakst.
- **Minor** (1.**1**.0) — nieuwe functionaliteit die een gebruiker merkt. Een
  nieuw scherm, een nieuwe mogelijkheid in de app.
- **Major** (**2**.0.0) — een wezenlijk andere app. Spaarzaam gebruiken; dit is
  een marketingsignaal, geen technisch signaal.

Alleen native wijzigingen (plugins, permissies, iconen, splash) vergen een nieuwe
store-build. Web-wijzigingen zijn direct live en verhogen dus **niets**.

> Niet verwarren met `lib/changelog.ts`. Dat is de product-changelog voor
> sportschooleigenaren, met een eigen label (`2026.10`). Andere doelgroep, ander
> ritme, mag los lopen.

---

## 2. Releasenaam

Alleen zichtbaar voor jou in de console, niet voor gebruikers. Play vult
standaard `1.0.0 (1)` in; wij zetten er een korte aanduiding achter zodat je een
release later terugvindt zonder de bundel te openen.

```
<version> (<build>) – <korte aanduiding>
```

| Voorbeeld | Wanneer |
|---|---|
| `1.0.0 (1) – eerste interne test` | Deze release |
| `1.0.0 (3) – interne test, na QR-fix` | Nieuwe build in dezelfde test |
| `1.0.1 (7) – productie` | Eerste publieke uitrol |
| `1.1.0 (12) – productie, groepslessen` | Uitrol met nieuwe functionaliteit |

Regels: Nederlands, kleine letters na het streepje, maximaal ongeveer 50 tekens,
en benoem de **aanleiding** en niet de inhoud. De inhoud staat in de
release-opmerkingen.

App Store Connect kent geen vrij naamveld; daar zijn versie en build leidend.
Houd die identiek aan Play, dan blijven de twee stores vergelijkbaar.

---

## 3. Release-opmerkingen

Zichtbaar voor gebruikers, per taal. Play staat 500 tekens toe, de App Store
4000. Houd je aan de 500, dan werkt dezelfde tekst overal.

**Toon:** schrijf voor de sporter, niet voor de ontwikkelaar. "Je rusttimer loopt
nu door als je het scherm uitzet" is bruikbaar; "fix: timer state persisted in
localStorage" is dat niet. Geen versienummers in de tekst, die staan er al boven.

**Indeling** vanaf de tweede release, met dezelfde drie woorden als de in-app
changelog (`Nieuw` / `Verbeterd` / `Opgelost`), zodat een gebruiker die beide
ziet dezelfde taal leest:

```
Nieuw
• …

Verbeterd
• …

Opgelost
• …
```

Laat een kop weg als er niets onder staat. Is er alleen klein onderhoud, dan
volstaat één zin: *"Kleine verbeteringen en opgeloste foutjes."* Dat is eerlijker
dan drie regels bedenken bij niets.

**Bij een interne test** mag het korter en technischer, want alleen je eigen
testers lezen het. Benoem daar vooral wát er getest moet worden.

---

## 4. Eerste release

**Releasenaam:** `1.0.0 (1) – eerste interne test`

### Release-opmerkingen, Nederlands (nl-NL)

```
Eerste versie van GymRebel Training.

• Je trainingsschema van je coach, altijd bij de hand
• Sets loggen tijdens het trainen, met rusttimers en trilfeedback
• Scan de QR-code op een apparaat en zie meteen de juiste uitvoering
• Volg je voortgang, je persoonlijke records en welke spieren je traint
• Meld een defect apparaat in een paar tikken

Kom je iets tegen? Gebruik "Probleem melden" in het menu.
```

380 tekens, ruim binnen de limiet.

### Release-opmerkingen, Engels (en-US)

Alleen nodig als je Engels als extra store-taal toevoegt.

```
The first version of GymRebel Training.

• Your coach's training plan, always at hand
• Log your sets while you train, with rest timers and haptic feedback
• Scan the QR code on a machine to see exactly how to use it
• Track your progress, personal records and the muscles you train
• Report a broken machine in a few taps

Found something? Use "Report a problem" in the menu.
```

> **Waarom geen "bugfixes en verbeteringen".** Bij een eerste versie is er niets
> om te verbeteren; de opmerkingen moeten uitleggen wát de app is. Vanaf de
> tweede release verschuift dat naar wat er veranderd is.

---

## 5. Sjabloon voor de volgende release

```
Releasenaam: <version> (<build>) – <aanleiding>

Nieuw
• <wat de gebruiker nu kan wat eerst niet kon>

Verbeterd
• <wat prettiger werkt dan voorheen>

Opgelost
• <wat kapot was en nu niet meer>
```

**Vaste stappen bij elke store-upload:**

1. `npm run version:bump` (en `version` ophogen in `app-version.json` als er
   nieuwe functionaliteit in zit)
2. `CAPACITOR_SERVER_URL` controleren: moet productie zijn, geen tunnel
3. `npx cap sync android && ./gradlew bundleRelease`
4. `store/TESTPLAN.md` aflopen op een fysiek toestel
5. Uploaden, releasenaam en opmerkingen invullen volgens dit document
6. `app-version.json` committen samen met de gewijzigde native bestanden
