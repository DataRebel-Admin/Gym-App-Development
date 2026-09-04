# Testplan native apps (iOS + Android)

Af te tekenen vóór elke store-inzending. Test op een **fysiek toestel**, niet
alleen een simulator: haptics, camera, push en biometrie werken daar niet of
anders. Minimaal één iPhone en één Android-toestel.

Vul per run de kolommen in en bewaar het resultaat bij de release.

---

## 0. Voorbereiding

| | |
|---|---|
| Build | versie \_\_\_\_ (build \_\_\_\_), uit `app-version.json` |
| Toestellen | iPhone \_\_\_\_ (iOS \_\_\_\_) · Android \_\_\_\_ (versie \_\_\_\_) |
| Omgeving | `CAPACITOR_SERVER_URL` = \_\_\_\_ |
| Testaccount | lid-account bij demo-tenant, **geen** eigenaarsaccount |

> Test met een **lid**-account. De app is ontworpen rond de sporter; de
> eigenaarschermen zijn desktop-first en horen niet in de app-beleving thuis.
> Geef Apple in de reviewnotities om dezelfde reden een lid-account.

---

## 1. Installatie en eerste start

| # | Stap | Verwacht | OK |
|---|---|---|---|
| 1.1 | App installeren | Icoon is de zwarte GR-mark op Rebel Orange, niet de Capacitor-robot | ☐ |
| 1.2 | Naam onder het icoon | "GymRebel", niet afgekapt | ☐ |
| 1.3 | App starten | Startscherm met GYMREBEL-logo op zwart, geen witte flits | ☐ |
| 1.4 | Startscherm verdwijnt | Binnen ~2 s, gaat over in de app zonder tussenliggend leeg vlak | ☐ |
| 1.5 | Android 12+ specifiek | Startscherm toont het beeldmerk op zwart (niet wit systeemvlak) | ☐ |
| 1.6 | Statusbalk en notch | Content valt niet achter de notch of de home-indicator | ☐ |

## 2. Inloggen

| # | Stap | Verwacht | OK |
|---|---|---|---|
| 2.1 | Inloggen met wachtwoord | Lukt, landt op `/member` | ☐ |
| 2.2 | Onjuist wachtwoord | Nette foutmelding, geen crash of blanco scherm | ☐ |
| 2.3 | Tweestapsverificatie | Aparte codepagina verschijnt, code werkt | ☐ |
| 2.4 | Magic link vanuit e-mail | Opent **de app**, niet de browser (App Links / Universal Links) | ☐ |
| 2.4b | Magic link, vervolg | De app landt **op de inloglink** en logt je in, niet op de startpagina | ☐ |
| 2.4c | Uitnodigingslink `/invite/<token>` | Opent de app op de accepteerpagina | ☐ |
| 2.4d | Reset-link `/login/reset/<token>` | Opent de app op het formulier voor een nieuw wachtwoord | ☐ |
| 2.5 | Passkey / biometrie | Face ID of vingerafdruk wordt gevraagd en logt in | ☐ |
| 2.6 | Wachtwoord vergeten | Reset-mail komt aan, link werkt in de app | ☐ |
| 2.7 | Uitloggen en opnieuw starten | Sessie is echt weg, geen automatische herinlog | ☐ |

> 2.4 en 2.5 falen zolang `assetlinks.json` (Android) en de AASA plus Associated
> Domains (iOS) niet kloppen. Zie `capacitor/README.md`.
>
> **Bekend: automatische App Links-verificatie is onbetrouwbaar bij zijlaadden.**
> Op een OnePlus (OxygenOS) meldde de verificatie-agent niets terug
> (`pm get-app-links` bleef op `1024`, geen enkele logregel), terwijl
> `assetlinks.json` aantoonbaar correct was: HTTP 200, `application/json`, geen
> redirects, en de fingerprint gelijk aan de handtekening van de geïnstalleerde
> APK. Zodra het domein handmatig werd aangezet opende de link wél de app, en
> ook op de juiste pagina.
>
> **Bevestigd op 4 september 2026:** installatie vanuit de interne testtrack
> lost dit op. Dezelfde telefoon die bij zijladen op `1024` bleef staan, meldde
> na installatie via Play direct `app.gymrebel-training.com: verified`, en een
> link naar het domein opende de app zonder keuzedialoog. Play stoot de
> verificatie zelf aan; de lokale agent doet dat bij zijladen niet.
>
> Zie je `1024` bij een tester, controleer dan éérst of de app uit Play komt
> (`adb shell dumpsys package <pkg> | grep installerPackageName` moet
> `com.android.vending` tonen).
>
> Werkt het bij een tester niet, dan is de handmatige route: Instellingen → Apps
> → GymRebel → *Standaard openen* → domein aanzetten. Via adb kan het ook:
> `pm set-app-links-user-selection --user 0 --package nl.gymrebeltraining.app true app.gymrebel-training.com`
>
> Let op: een **debug**-build wordt met de debug-sleutel ondertekend en matcht
> dus nooit met de release-fingerprint in `assetlinks.json`. Deep links test je
> met een release-ondertekende APK (`./gradlew assembleRelease`).

## 3. Trainen (de kernflow)

| # | Stap | Verwacht | OK |
|---|---|---|---|
| 3.1 | Coach wijst schema toe (via web) | Lid ziet "Nieuw" op `/member/schema` | ☐ |
| 3.2 | Schema openen | Oefeningen met afbeeldingen, geen gebroken beeld | ☐ |
| 3.3 | Sessie starten | Actieve sessie opent, klok loopt | ☐ |
| 3.4 | Set opslaan | Waarde blijft staan, **trilfeedback** voelbaar | ☐ |
| 3.5 | Rusttimer | Start automatisch, telt af, trilt bij nul | ☐ |
| 3.6 | Timers uitzetten via header | Geen trilling meer, lopende timer stopt direct | ☐ |
| 3.7 | Toetsenbord bij invoer | Knoppenbalk blijft zichtbaar, verdwijnt niet erachter | ☐ |
| 3.8 | Oefening overslaan | Kaart klapt in, ongedaan maken werkt | ☐ |
| 3.9 | Alternatief kiezen | Lijst met passende oefeningen, vervanging werkt | ☐ |
| 3.10 | Supersetgroep | Geleide wizard loopt A1 → B1 → rust → A2 | ☐ |
| 3.11 | Sessie afronden | Samenvatting, eventuele trofee-animatie | ☐ |
| 3.12 | Sessie annuleren | Sessie verdwijnt, telt niet mee in statistieken | ☐ |
| 3.13 | Schema als PDF | Download opent in de systeem-viewer | ☐ |

## 4. QR-scan bij het apparaat

| # | Stap | Verwacht | OK |
|---|---|---|---|
| 4.1 | Scanner openen, eerste keer | Systeem vraagt cameratoestemming, met **onze** uitlegtekst | ☐ |
| 4.2 | Toestemming weigeren | Nette uitleg, geen crash | ☐ |
| 4.3 | Toestemming later alsnog geven | Scanner werkt zonder de app opnieuw te installeren | ☐ |
| 4.4 | Apparaat-QR scannen | Juiste oefening opent | ☐ |
| 4.5 | QR van andere sportschool | 404, geen gegevens uit een andere tenant | ☐ |
| 4.6 | "Voeg toe aan mijn schema" | Oefening verschijnt, dubbel scannen dupliceert niet | ☐ |
| 4.7 | Defect melden vanaf QR | Formulier voorgevuld, foto kiezen werkt | ☐ |
| 4.8 | Foto kiezen uit bibliotheek | Kiezer opent, **app crasht niet** (iOS: plist-sleutel) | ☐ |
| 4.9 | Apparaat buiten gebruik | Rode banner, schema-knop verborgen | ☐ |

## 5. Meldingen

| # | Stap | Verwacht | OK |
|---|---|---|---|
| 5.1 | Eerste start na login | Toestemming voor meldingen wordt gevraagd | ☐ |
| 5.2 | Toestemming geven | Token geregistreerd (controleer `NativePushToken` in de database) | ☐ |
| 5.3 | Coach wijst schema toe | Melding komt binnen op het toestel | ☐ |
| 5.4 | App op de achtergrond | Melding komt binnen, icoon is het GR-silhouet en niet een witte blok | ☐ |
| 5.5 | Melding aantikken | App opent **op `/member/schema`**, niet op het laatste scherm | ☐ |
| 5.6 | App volledig afgesloten | Melding komt alsnog binnen | ☐ |
| 5.7 | App **open** op het moment van binnenkomst | iOS toont een banner, Android een melding in de app zelf | ☐ |
| 5.8 | Meldingen uitzetten in `/account/meldingen` | Er komt niets meer binnen | ☐ |
| 5.9 | Android 13+ | Toestemming is expliciet gevraagd, niet stilzwijgend aangenomen | ☐ |
| 5.10 | Android: systeeminstellingen → Meldingen | Vier benoemde kanalen zichtbaar (Trainingsschema's, Apparaatmeldingen, Onderhoud, Trofeeën), geen naamloze "Overig" | ☐ |
| 5.11 | Kanaal "Trofeeën" uitzetten in het systeem | Trofee-meldingen blijven weg, schema-meldingen komen nog binnen | ☐ |
| 5.12 | Trofee versus defectmelding | Trofee komt stil binnen, apparaatmelding met geluid en pop-up | ☐ |
| 5.13 | **Uitloggen, dan een melding laten sturen** | Er komt **niets** binnen op dit toestel | ☐ |

> 5.13 is een privacytest, geen functionele. Zonder het intrekken van het token
> zou iemand die je telefoon leent op het vergrendelscherm meelezen dat jouw coach
> een schema heeft klaargezet.

> 5.3 tot en met 5.6 werken pas met `APNS_*` (iOS) respectievelijk `FCM_*` plus
> `google-services.json` (Android). Zonder die configuratie is push een no-op en
> is dat correct gedrag, geen bug.
>
> **Android afgetekend op 4 september 2026** (OnePlus 11, app uit de interne
> testtrack): token geregistreerd, alle vier de categorieën bezorgd, GR-silhouet
> in de statusbalk, en de kanaalindeling zichtbaar correct — trofee onder "Stil",
> schema/defect/onderhoud erboven. Aantikken opende `/member/schema`.
>
> **Twee valkuilen die dit boven water bracht**, allebei gerepareerd maar het
> waard om te kennen bij het testen:
>
> 1. **Push staat standaard UIT** per categorie (`NOTIFICATION_DEFAULTS.push =
>    false`). Zet 'm eerst aan onder Account → Meldingen, anders lijkt het alsof
>    de keten stuk is terwijl er simpelweg niets verstuurd wordt.
> 2. **Zet de app op de achtergrond** vóór je een melding stuurt. Staat hij op de
>    voorgrond, dan onderdrukt Android de systeemmelding en zie je alleen de
>    in-app-melding.

## 6. Netwerk en randgevallen (webview-beperkingen)

Dit is waar een WebView-app zich anders gedraagt dan een echte native app.
Loop deze punten expliciet af; het is precies waar reviewers op stuiten.

| # | Stap | Verwacht | OK |
|---|---|---|---|
| 6.1 | Vliegtuigmodus, dan app starten | Gebrande "Geen verbinding"-pagina, geen witte pagina of systeemfout | ☐ |
| 6.2 | Vliegtuigmodus uit | App gaat vanzelf verder zonder herstart | ☐ |
| 6.3 | Verbinding verliezen **tijdens** een sessie | Gelogde sets gaan niet verloren, nette foutmelding bij opslaan | ☐ |
| 6.4 | Wifi naar 4G wisselen midden in een sessie | Sessie loopt door | ☐ |
| 6.5 | App 30 minuten op de achtergrond, dan terug | Sessie nog actief, geen uitlog | ☐ |
| 6.6 | App langer dan 5 uur in een sessie | Automatisch afgesloten met melding | ☐ |
| 6.7 | Terugveerscroll aan de randen | Voelt niet als een webpagina in een doosje | ☐ |
| 6.8 | Terugknop (Android) | Navigeert terug in de app, sluit 'm niet meteen af | ☐ |
| 6.9 | Toestel draaien | Layout blijft bruikbaar | ☐ |
| 6.10 | Groot lettertype in systeeminstellingen | Tekst blijft leesbaar, knoppen blijven bereikbaar | ☐ |
| 6.11 | Donkere modus van het systeem | Geen onleesbare combinaties | ☐ |

**Bekende beperkingen, bewust geaccepteerd:**

- **Zonder netwerk werkt de app niet.** De app rendert server-side; er is geen
  offline modus. Opgevangen met de foutpagina uit 6.1, maar het blijft een
  wezenlijk verschil met een native app die lokaal data bewaart.
- **De achtergrond wordt bevroren.** Zet het systeem de WebView in de wachtstand,
  dan lopen JavaScript-timers niet door. De rusttimer wordt daarom bij terugkeer
  opnieuw uit de kloktijd afgeleid, niet uit een doorlopende teller.
- **Web-push bereikt de app niet.** Meldingen lopen via APNs en FCM, niet via de
  service worker. Dat is geen bug maar een platformbeperking.
- **Eerste start is trager dan bij een native app**, omdat de UI over het netwerk
  komt. Vandaar het startscherm en de vaste achtergrondkleur.

## 7. Privacy en accountbeheer (store-vereisten)

| # | Stap | Verwacht | OK |
|---|---|---|---|
| 7.1 | Privacyverklaring bereikbaar | `/privacy` opent, ook **zonder** in te loggen | ☐ |
| 7.2 | Cookiebeleid bereikbaar | `/cookies` opent zonder login | ☐ |
| 7.3 | Link vanuit de app | Account → Privacy toont beide links | ☐ |
| 7.4 | Gegevens exporteren | JSON-download bevat de eigen gegevens | ☐ |
| 7.5 | Account verwijderen | Kan **in de app** zonder contact met een beheerder | ☐ |
| 7.6 | Verwijdering annuleren | Werkt binnen de bedenktijd | ☐ |
| 7.7 | Probleem melden | Meldknop werkt, technische context is inzichtelijk vóór verzenden | ☐ |

## 8. Vóór inzending

| # | Controle | OK |
|---|---|---|
| 8.1 | `npm run version:check` loopt gelijk | ☐ |
| 8.2 | Buildnummer verhoogd ten opzichte van de vorige upload | ☐ |
| 8.3 | Release-build, niet debug (`webContentsDebuggingEnabled: false`) | ☐ |
| 8.4 | `CAPACITOR_SERVER_URL` wijst naar productie, niet naar staging | ☐ |
| 8.5 | Geen testaccounts of demodata zichtbaar bij een verse login | ☐ |
| 8.6 | Reviewnotities bevatten een werkend **lid**-testaccount | ☐ |
