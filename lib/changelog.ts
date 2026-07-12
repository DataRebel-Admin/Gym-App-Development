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
        text: "Eén inlogscherm voor iedereen: de app herkent je sportschool aan je e-mailadres. Train je bij meerdere sportscholen, dan kies je na het inloggen bij welke — ook de e-mail-loginlink werkt per sportschool.",
      },
      {
        type: "improved",
        text: "Accountinstellingen zijn opnieuw ingedeeld als overzichtelijke hub, zodat je alles sneller vindt — juist op mobiel.",
      },
      {
        type: "improved",
        text: "Merkbaar sneller: afbeeldingen in moderne compacte formaten, grafieken laden pas wanneer je ze ziet en drukbevraagde overzichten zijn onder de motorkap versneld.",
      },
      {
        type: "improved",
        text: "Je account verwijderen regel je nu volledig zelf: na een bedenktijd van 30 dagen wordt alles automatisch en definitief verwijderd — tot die tijd kun je annuleren.",
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
        text: "Engels en Frysk zijn nu volledig doorgevoerd in de trofeeën- en onderhoudsschermen, de menu-onderdelen en de meldingen bij formulieren — een Engels- of Friestalige sportschool ziet daar geen Nederlands meer.",
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
        text: "E-mailmeldingen staan voortaan standaard uit — behalve voor een nieuw schema. Elke categorie zet je zelf aan onder Meldingen, zodat je inbox rustig blijft.",
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
      "De app spreekt nu drie talen en krijgt er een slimme assistent bij — plus meer grip op je training en apparatuur.",
    changes: [
      {
        type: "new",
        text: "Volledig meertalig: leden en medewerkers kiezen zelf Nederlands, Engels of Frysk. De taalkeuze onthoudt zich per gebruiker.",
      },
      {
        type: "new",
        text: "AI Coach & Assistent: uitleg bij oefeningen, alternatieven en een samenvatting van de voortgang van een lid. De AI stelt alleen voor — jij bevestigt met één klik voordat er iets wijzigt.",
      },
      {
        type: "new",
        text: "Meer grip tijdens de training: sla een oefening over, kies een alternatief als een apparaat bezet is, zet de rusttimers aan of uit en rond af of annuleer wanneer je wilt.",
      },
      {
        type: "new",
        text: "QR-codes van al je apparaten in één keer downloaden als printklare A4-pagina of los bestand — in je eigen huisstijl. En je ziet nu hoe vaak elke apparaat-QR gescand wordt.",
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
    date: "2026-06-28",
    title: "Trofeeën, mijlpalen & Gym Passport",
    summary:
      "Een motivatielaag die je leden beloont voor hun inzet — optioneel, per sportschool aan te zetten.",
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
        text: "Medewerkers (coaches) toevoegen met een rechtenmatrix — bepaal per persoon wat hij of zij mag zien en beheren.",
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
        text: "Volledige levenscyclus voor toegewezen schema's: opslaan als concept, inplannen voor later of direct publiceren — met een persoonlijke boodschap aan het lid.",
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
        text: "Oefeningstypes met slimme velden: hardlopen vraagt om afstand en tijd, planken om duur — nooit meer irrelevante invoer.",
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
