// Product-changelog (release notes) voor sportschooleigenaren. Code-gedreven,
// puur (geen `server-only`) zodat het ook client-bruikbaar is — idiomatisch zoals
// `lib/exercise-types.ts`, `lib/audit-actions.ts` en `lib/achievements/definitions.ts`:
// de registry is de bron van waarheid. **Nieuwe release = één record bovenaan
// `CHANGELOG` toevoegen.** Alleen zichtbaar voor de tenant-admin (zie
// `app/owner/changelog`).
import type { BadgeTone } from "@/components/ui/badge";

/** Aard van een wijziging — bepaalt label + kleur in de UI. */
export type ChangeType = "new" | "improved" | "fixed";

export const CHANGE_TYPE_META: Record<
  ChangeType,
  { label: string; tone: BadgeTone }
> = {
  new: { label: "Nieuw", tone: "accent" },
  improved: { label: "Verbeterd", tone: "success" },
  fixed: { label: "Opgelost", tone: "neutral" },
};

export type ChangelogChange = {
  type: ChangeType;
  text: string;
};

export type ChangelogEntry = {
  /** Weergegeven versielabel, bv. "2026.7". */
  version: string;
  /** Releasedatum in ISO-formaat (YYYY-MM-DD). */
  date: string;
  /** Korte, wervende titel van de release. */
  title: string;
  /** Optionele intro-zin. */
  summary?: string;
  changes: ChangelogChange[];
};

/**
 * De releasehistorie — **nieuwste bovenaan**. Geschreven voor de eigenaar (geen
 * technisch jargon). Houd het eerlijk t.o.v. wat er daadwerkelijk is gebouwd.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "2026.17",
    date: "2026-09-09",
    title: "Een agenda voor je leden",
    summary:
      "Leden plannen hun trainingsdagen, koppelen die aan hun eigen agenda-app en kiezen zelf een kant-en-klaar schema. De app houdt tijdens het trainen zichtbaar dat er een training loopt.",
    changes: [
      {
        type: "new",
        text: "Ledenagenda: een maandkalender met geplande trainingsdagen, afgeronde trainingen en groepslessen bij elkaar. Leden plannen per trainingsdag op welke weekdagen die valt, en zien in een oogopslag wat ze gemist hebben.",
      },
      {
        type: "new",
        text: "Agendakoppeling: leden zetten hun trainingen en lessen met een tik in Google Agenda, Apple Agenda of Outlook. De koppeling ververst zichzelf, dus een verplaatste les schuift vanzelf mee.",
      },
      {
        type: "new",
        text: "Kant-en-klare schema's voor leden: een bladerbare catalogus met complete week- en dagschema's, te filteren op doel, niveau en aantal dagen. Een lid neemt er een over als eigen schema en past het aan. Jij bepaalt welke van jouw eigen schema's en losse trainingsdagen daarin meedoen.",
      },
      {
        type: "new",
        text: "Meldingen tijdens het trainen in de app: een seintje zodra de rusttijd voorbij is, ook als het scherm uit staat, en een blijvende melding met meelopende tijd zolang de training loopt.",
      },
      {
        type: "new",
        text: "Op elk scherm zichtbaar dat er een training loopt, met de tijd erbij en een knop om verder te gaan. Ook op de instellingen en na het scannen van een apparaat.",
      },
      {
        type: "new",
        text: "Leden klikken door op de cijfers van hun dashboard en zien waar een reeks, een record of een aantal trainingen vandaan komt.",
      },
      {
        type: "improved",
        text: "Elke sportschool krijgt de volledige oefeningenbibliotheek van ruim 600 oefeningen meteen bij de hand. Wat er bij jou niet staat, haal je weg; je hoeft niets meer stuk voor stuk toe te voegen.",
      },
      {
        type: "improved",
        text: "Na het toevoegen van een oefening aan een schema stelt de app direct alternatieven voor die dezelfde spieren trainen. Zowel in jouw schema-editor als bij een lid dat zelf bouwt.",
      },
      {
        type: "improved",
        text: "De doelen die een lid kiest sturen nu de suggesties: passende startsjablonen komen bovenaan en een schema-aanvraag staat al op het juiste doel.",
      },
      {
        type: "improved",
        text: "Jouw huisstijlkleur werkt overal door, ook in de achtergronden en accenten. Een kleur die te licht of te donker uitvalt wordt automatisch leesbaar gehouden, in zowel de lichte als de donkere weergave.",
      },
      {
        type: "fixed",
        text: "Een geüpload logo verscheen niet in e-mails aan je leden. Dat is opgelost, in de app en in de mailberichten.",
      },
      {
        type: "fixed",
        text: "Leden kunnen altijd een trainingsdag toevoegen aan een zelfgebouwd schema; de bovengrens op het aantal dagen is vervallen.",
      },
    ],
  },
  {
    version: "2026.16",
    date: "2026-09-07",
    title: "Spieren in beeld & zoeken dat meedenkt",
    summary:
      "Leden zien op een anatomisch lichaamsmodel wat hun schema traint, en de oefeningenbibliotheek groeit door naar ruim 600 oefeningen.",
    changes: [
      {
        type: "new",
        text: "Anatomische spier-heatmap: leden zien op een realistisch lichaamsmodel welke spieren hun schema traint, in de kleur van jouw sportschool. Filter per trainingsdag, wissel tussen voor- en achterkant en tik op een spier voor de oefeningen die eraan bijdragen.",
      },
      {
        type: "improved",
        text: "De oefeningenbibliotheek is uitgebreid naar ruim 600 oefeningen, waaronder een flinke set yoga- en pilatesoefeningen.",
      },
      {
        type: "improved",
        text: "Live zoeken in de oefeningenbibliotheek: resultaten verschijnen terwijl je typt. Ook Nederlandse zoektermen zoals 'bankdrukken' vinden direct de juiste oefening.",
      },
      {
        type: "improved",
        text: "Inloggen kan alleen nog met een persoonlijk account: de demo-inlog is definitief verwijderd, een stap richting een veilige livegang.",
      },
    ],
  },
  {
    version: "2026.15",
    date: "2026-09-04",
    title: "Klaar voor de app-stores",
    summary:
      "De Android-app is door de eerste echte test heen: betrouwbare pushmeldingen, een vingerafdrukslot en een lesrooster dat tegen een stootje kan.",
    changes: [
      {
        type: "new",
        text: "Vingerafdrukslot in de app: de app vergrendelt bij een koude start en ontgrendelt met vingerafdruk, gezichtsherkenning of pincode. Zelf aan te zetten onder Account, Beveiliging.",
      },
      {
        type: "improved",
        text: "Pushmeldingen op Android werken nu volledig: per categorie een eigen meldingskanaal, meldingen komen ook binnen terwijl je de app gebruikt en aantikken opent direct de juiste pagina. Push staat voortaan standaard aan.",
      },
      {
        type: "improved",
        text: "Inloggen met vingerafdruk of gezicht (passkeys) werkt nu op elk sportschool-subdomein en in de Android-app, met duidelijke meldingen als er iets misgaat.",
      },
      {
        type: "new",
        text: "Lessen annuleren zonder ze te verwijderen: de aanmeldlijst blijft bewaard en de annulering is terug te draaien. Aangemelde leden krijgen automatisch bericht; e-mail staat voor lesmeldingen nu standaard aan.",
      },
      {
        type: "improved",
        text: "Rooster verfijnd: leden krijgen een waarschuwing bij overlappende aanmeldingen, aanwezigheid is achteraf te corrigeren en bij een verplaatste les gaat de herinnering opnieuw uit met de nieuwe tijd.",
      },
      {
        type: "improved",
        text: "Vertrekt een lid, dan komen de lesplekken automatisch vrij en schuift de wachtlijst door.",
      },
    ],
  },
  {
    version: "2026.14",
    date: "2026-08-26",
    title: "Groepslessen: wachtlijst, herhalen en bewerken",
    summary:
      "De roostermodule is volwassen geworden: vol is niet meer definitief vol, en een lesreeks zet je in één keer klaar.",
    changes: [
      {
        type: "new",
        text: "Wachtlijst bij volle lessen: meldt iemand zich af of verhoog je de capaciteit, dan schuift de eerste wachtende automatisch door en krijgt die direct bericht. Leden zien hun positie op de wachtlijst.",
      },
      {
        type: "new",
        text: "Lessen bewerken en wekelijks herhalen: zet in één keer een reeks tot 26 weken klaar en pas ook alle volgende sessies in een reeks tegelijk aan of verwijder ze.",
      },
      {
        type: "new",
        text: "Automatische les-herinneringen: leden krijgen daags voor de les een herinnering via hun eigen voorkeurskanalen.",
      },
      {
        type: "new",
        text: "Capaciteit per losse sessie instelbaar, naast de standaard van de les.",
      },
      {
        type: "fixed",
        text: "Lestijden volgen nu altijd de tijdzone van de vestiging: ook rond de zomer- en wintertijdwissel blijft een les van 18:00 gewoon om 18:00.",
      },
      {
        type: "improved",
        text: "Aanmelden is waterdicht bij drukte: twee leden kunnen nooit meer tegelijk de laatste plek krijgen.",
      },
    ],
  },
  {
    version: "2026.13",
    date: "2026-07-31",
    title: "Een professionele oefeningenbibliotheek",
    summary:
      "Een volledig nieuwe, professioneel samengestelde oefeningenbibliotheek in het Nederlands, omslagfoto's voor schema's en het technische fundament voor de eigen app in de stores.",
    changes: [
      {
        type: "new",
        text: "Nieuwe standaard-oefeningenbibliotheek met bijna 500 professioneel samengestelde oefeningen: animaties, spierdiagrammen, coach-tips en stapsgewijze uitvoering, volledig in het Nederlands. Oefeningnamen houden bewust de in de sportschool gangbare termen zoals bench press en squat.",
      },
      {
        type: "new",
        text: "Vijftien kant-en-klare voorbeeldschema's die je met één klik overneemt als eigen template. Elk schema heeft nu bovendien een omslagfoto: je eigen upload, een gecureerde foto of je logo.",
      },
      {
        type: "new",
        text: "Leden vragen naast een nieuw schema nu ook gericht een aanpassing van hun huidige schema aan. En met een nieuwe instelling mag een lid zijn toegewezen schema zelf bijwerken; jij ziet automatisch dat het is gepersonaliseerd.",
      },
      {
        type: "improved",
        text: "Tijdens de training: sets toevoegen of verwijderen, een gekozen alternatief terugdraaien zonder gelogd werk te verliezen, en een 'training bezig'-balk op elke pagina zodat je altijd terug kunt naar je actieve workout.",
      },
      {
        type: "improved",
        text: "De schema-PDF toont nu een afbeelding bij elke oefening met beeld.",
      },
      {
        type: "improved",
        text: "Ledenlijst en team zijn gescheiden: de ledenlijst bevat alleen nog sporters, je beheerders en medewerkers beheer je apart onder Medewerkers.",
      },
      {
        type: "improved",
        text: "Onder de motorkap: eigen merkassets, publieke privacy- en supportpagina's, goed leesbare e-mails in donkere modus en het fundament voor de apps in de App Store en Play Store.",
      },
    ],
  },
  {
    version: "2026.12",
    date: "2026-07-29",
    title: "Vestigingen, meldpunten & vernieuwde inzichten",
    summary:
      "Meerdere vestigingen onder één dak, twee nieuwe meldpunten en een inzichten-pagina die echt inzicht geeft.",
    changes: [
      {
        type: "new",
        text: "Vestigingen: beheer meerdere locaties binnen één sportschool. Leden trainen bij elke vestiging, medewerkers zien alleen hun eigen vestiging(en) en de inzichten vergelijken vestigingen onderling.",
      },
      {
        type: "new",
        text: "Leden melden een defect apparaat rechtstreeks in de app, met foto en ernst. Een als onveilig gemeld apparaat gaat direct buiten gebruik en je behandelaars krijgen meteen bericht.",
      },
      {
        type: "new",
        text: "Problemen met de app zelf meld je (net als je leden) met één knop aan het ontwikkelteam, inclusief de technische gegevens die nodig zijn om het op te lossen.",
      },
      {
        type: "new",
        text: "Aanwezigheid bij groepslessen: vink na afloop af wie er was; wie zonder afmelding wegblijft, wordt automatisch als no-show geregistreerd.",
      },
      {
        type: "new",
        text: "Geleide superset-flow tijdens de training: de app leidt leden ronde voor ronde door een superset of circuit, met rust op precies het juiste moment.",
      },
      {
        type: "improved",
        text: "De inzichten-pagina is vernieuwd: duidelijke kerncijfers, trends over de tijd, een bezettings-heatmap met piekmarkering en ranglijsten per vestiging.",
      },
      {
        type: "fixed",
        text: "Formulieren met automatisch opslaan verliezen je invoer niet meer tijdens het typen.",
      },
    ],
  },
  {
    version: "2026.11",
    date: "2026-07-17",
    title: "Supersets, circuits & wachtwoordherstel",
    summary:
      "Schema's met supersets, dropsets en persoonlijke notities per oefening, en leden die hun wachtwoord zelf herstellen.",
    changes: [
      {
        type: "new",
        text: "Groepeer oefeningen in de schema-editor tot supersets, giant sets, circuits of AMRAP, met rondes en rust na de groep. Leden zien de groepen duidelijk terug tijdens hun training.",
      },
      {
        type: "new",
        text: "Markeer dropsets en stel rusttijden met één tik in via presets, in één keer voor een hele trainingsdag als je wilt.",
      },
      {
        type: "new",
        text: "Schrijf per oefening een persoonlijke notitie aan een lid, naast de algemene schema-notitie die voor iedereen geldt.",
      },
      {
        type: "new",
        text: "Wachtwoord vergeten? Leden en medewerkers herstellen het nu zelf via een veilige, eenmalige e-maillink.",
      },
      {
        type: "new",
        text: "Trainers wijzen een workout toe aan een lid en kunnen die ook namens het lid draaien, handig bij begeleiding op de vloer.",
      },
      {
        type: "improved",
        text: "Het opslaan van sets is robuuster: een korte hapering in de verbinding leidt niet meer tot een foutmelding en afwijkende invoer wordt netjes afgerond in plaats van geweigerd.",
      },
    ],
  },
  {
    version: "2026.10",
    date: "2026-07-12",
    title: "Installeer als app & inloggen zonder gedoe",
    summary:
      "GymRebel werkt nu als echte app op je telefoon, inloggen kan met je vingerafdruk en alles voelt merkbaar sneller.",
    changes: [
      {
        type: "new",
        text: "Installeer GymRebel als app op je telefoon: eigen app-icoon, volledig scherm en een nette offline-weergave zonder verbinding. Achter de schermen is ook het fundament gelegd voor de Play Store en App Store, inclusief pushmeldingen op iPhone.",
      },
      {
        type: "new",
        text: "Inloggen met je vingerafdruk of gezicht (passkeys): sneller en veiliger dan een wachtwoord. Je beheert je toegangssleutels zelf onder Account → Beveiliging.",
      },
      {
        type: "improved",
        text: "Eén inlogscherm voor iedereen: de app herkent je sportschool aan je e-mailadres. Train je bij meerdere sportscholen, dan kies je na het inloggen bij welke. Ook de e-mail-loginlink werkt per sportschool.",
      },
      {
        type: "improved",
        text: "Accountinstellingen zijn opnieuw ingedeeld als overzichtelijke hub, zodat je alles sneller vindt, juist op mobiel.",
      },
      {
        type: "improved",
        text: "Merkbaar sneller: afbeeldingen in moderne compacte formaten, grafieken laden pas wanneer je ze ziet en drukbevraagde overzichten zijn onder de motorkap versneld.",
      },
      {
        type: "improved",
        text: "Je account verwijderen regel je nu volledig zelf: na een bedenktijd van 30 dagen wordt alles automatisch en definitief verwijderd. Tot die tijd kun je annuleren.",
      },
    ],
  },
  {
    version: "2026.9",
    date: "2026-07-07",
    title: "Overal in jouw taal",
    summary:
      "Engels en Frysk zijn verder doorgevoerd, en meldingen worden betrouwbaarder geregistreerd.",
    changes: [
      {
        type: "improved",
        text: "Engels en Frysk zijn nu volledig doorgevoerd in de trofeeën- en onderhoudsschermen, de menu-onderdelen en de meldingen bij formulieren. Een Engels- of Friestalige sportschool ziet daar geen Nederlands meer.",
      },
      {
        type: "improved",
        text: "Een melding wordt voortaan alleen als 'verzonden' vastgelegd wanneer er daadwerkelijk een e-mail is afgeleverd, zodat het logboek klopt.",
      },
    ],
  },
  {
    version: "2026.8",
    date: "2026-07-07",
    title: "Focus op je trainingsdag",
    summary:
      "Train gerichter per dag, met een rustiger inbox en nog nettere details.",
    changes: [
      {
        type: "new",
        text: "Kies je trainingsdag bij de start: heeft een schema meerdere dagen, dan pak je er één per keer en zie je meteen precies de oefeningen van die dag.",
      },
      {
        type: "improved",
        text: "E-mailmeldingen staan voortaan standaard uit, behalve voor een nieuw schema. Elke categorie zet je zelf aan onder Meldingen, zodat je inbox rustig blijft.",
      },
      {
        type: "improved",
        text: "Oefeningen uit de catalogus krijgen een verzorgde, correct geschreven naam.",
      },
      {
        type: "improved",
        text: "Diverse verfijningen in weergave en navigatie, waaronder een nettere presentatie van je metingen.",
      },
    ],
  },
  {
    version: "2026.7",
    date: "2026-07-04",
    title: "Meertalig & je persoonlijke AI-coach",
    summary:
      "De app spreekt nu drie talen en krijgt er een slimme assistent bij, plus meer grip op je training en apparatuur.",
    changes: [
      {
        type: "new",
        text: "Volledig meertalig: leden en medewerkers kiezen zelf Nederlands, Engels of Frysk. De taalkeuze onthoudt zich per gebruiker.",
      },
      {
        type: "new",
        text: "AI Coach & Assistent: uitleg bij oefeningen, alternatieven en een samenvatting van de voortgang van een lid. De AI stelt alleen voor, jij bevestigt met één klik voordat er iets wijzigt.",
      },
      {
        type: "new",
        text: "Meer grip tijdens de training: sla een oefening over, kies een alternatief als een apparaat bezet is, zet de rusttimers aan of uit en rond af of annuleer wanneer je wilt.",
      },
      {
        type: "new",
        text: "QR-codes van al je apparaten in één keer downloaden als printklare A4-pagina of los bestand, in je eigen huisstijl. En je ziet nu hoe vaak elke apparaat-QR gescand wordt.",
      },
      {
        type: "improved",
        text: "Spiergroep-vergelijking voor leden: zie in één oogopslag of je traint zoals je schema bedoeld is, en welke spiergroepen achterblijven.",
      },
      {
        type: "improved",
        text: "Snellere laadtijden en soepelere overgangen door een optimalisatieslag onder de motorkap.",
      },
    ],
  },
  {
    version: "2026.6",
    date: "2026-07-01",
    title: "Slim onderhoud voor je apparatuur",
    summary:
      "Nooit meer een gemiste servicebeurt: de app seint zelf wanneer een machine aandacht nodig heeft.",
    changes: [
      {
        type: "new",
        text: "Onderhoudsbeheer: stel per machine een interval in op gebruik of tijd. Het onderhoudsdashboard toont in één oogopslag wat 'binnenkort' of 'nu' aan de beurt is, met historie per machine.",
      },
      {
        type: "new",
        text: "Automatische meldingen (in-app, e-mail en push) zodra een machine de onderhoudsdrempel raakt.",
      },
      {
        type: "improved",
        text: "Machinebeheer uitgebreid met locatie, serienummer en aankoopdatum.",
      },
    ],
  },
  {
    version: "2026.5",
    date: "2026-07-01",
    title: "Trofeeën, mijlpalen & Gym Passport",
    summary:
      "Een motivatielaag die je leden beloont voor hun inzet, optioneel per sportschool aan te zetten.",
    changes: [
      {
        type: "new",
        text: "Trofeeën en automatisch gevierde mijlpalen op basis van trainingen, consistentie en behaalde doelen, inclusief een feestelijke melding na een workout.",
      },
      {
        type: "new",
        text: "Digitaal Gym Passport per lid met stempels en persoonlijke records.",
      },
      {
        type: "new",
        text: "Betrokkenheidsoverzicht voor coaches: recente mijlpalen, langste streaks en de meest actieve leden.",
      },
    ],
  },
  {
    version: "2026.4",
    date: "2026-06-30",
    title: "Coaches, rechten en persoonlijke begeleiding",
    summary:
      "Werk samen met je team en houd de regie: medewerkers krijgen precies de rechten die jij toekent.",
    changes: [
      {
        type: "new",
        text: "Medewerkers (coaches) toevoegen met een rechtenmatrix: bepaal per persoon wat hij of zij mag zien en beheren.",
      },
      {
        type: "new",
        text: "Koppel coaches aan leden met een 'Mijn leden'-weergave voor gerichte begeleiding.",
      },
      {
        type: "new",
        text: "Coachnotities op het ledenprofiel om afspraken en aandachtspunten vast te leggen.",
      },
    ],
  },
  {
    version: "2026.3",
    date: "2026-06-24",
    title: "Schema's slimmer toewijzen",
    summary:
      "Van concept tot geplande publicatie, met meldingen die de voorkeuren van je leden respecteren.",
    changes: [
      {
        type: "new",
        text: "Volledige levenscyclus voor toegewezen schema's: opslaan als concept, inplannen voor later of direct publiceren, met een persoonlijke boodschap aan het lid.",
      },
      {
        type: "new",
        text: "Leden kunnen binnen jouw kaders zélf een schema samenstellen; jij keurt goed of laat het direct los.",
      },
      {
        type: "new",
        text: "Web-push-meldingen zodat leden meteen weten dat er een nieuw schema klaarstaat.",
      },
      {
        type: "improved",
        text: "Geef schema's een geldigheidsduur; leden en coaches zien vanzelf wanneer een nieuw schema nodig is.",
      },
    ],
  },
  {
    version: "2026.2",
    date: "2026-06-16",
    title: "Slimmere oefeningen & rijke catalogus",
    summary:
      "Meer dan 1.300 oefeningen met beeld en uitleg, plus velden die zich aanpassen aan het type oefening.",
    changes: [
      {
        type: "new",
        text: "Oefeningencatalogus met animaties, spiergroepen en stapsgewijze instructies om oefeningen aan je sportschool toe te voegen.",
      },
      {
        type: "new",
        text: "Oefeningstypes met slimme velden: hardlopen vraagt om afstand en tijd, planken om duur. Nooit meer irrelevante invoer.",
      },
      {
        type: "new",
        text: "Spier-heatmap voor leden die laat zien welke spiergroepen hun schema traint.",
      },
    ],
  },
  {
    version: "2026.1",
    date: "2026-06-09",
    title: "Vertrouwen, merk en betrouwbaarheid",
    summary:
      "De basis op orde: inzicht in wat er gebeurt, e-mails in jouw huisstijl en verzorgde foutpagina's.",
    changes: [
      {
        type: "new",
        text: "Audit trail: een leesbaar logboek van belangrijke gebeurtenissen binnen je sportschool.",
      },
      {
        type: "new",
        text: "Transactionele e-mails (uitnodiging, welkom, schema toegewezen) volledig in je eigen huisstijl.",
      },
      {
        type: "improved",
        text: "Verzorgde foutpagina's die meedenken en de weg terug wijzen in plaats van een kale melding.",
      },
    ],
  },
];

/** De meest recente release (voor een "wat is nieuw"-badge in de navigatie). */
export function getLatestRelease(): ChangelogEntry | null {
  return CHANGELOG[0] ?? null;
}

/**
 * Is de nieuwste release recent (binnen `days` dagen)? Handig om een subtiele
 * "nieuw"-indicator te tonen. Puur op datum — geen persistente per-gebruiker-staat.
 */
export function hasRecentRelease(days = 30, now: Date = new Date()): boolean {
  const latest = getLatestRelease();
  if (!latest) return false;
  const released = new Date(latest.date);
  if (Number.isNaN(released.getTime())) return false;
  const diffDays = (now.getTime() - released.getTime()) / 86_400_000;
  return diffDays >= 0 && diffDays <= days;
}
