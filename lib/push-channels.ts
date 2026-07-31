import type { NotificationCategory } from "@/lib/notifications";

/**
 * Android-meldingskanalen, één per meldingscategorie.
 *
 * Puur (géén `server-only`): de client maakt de kanalen aan bij het starten van
 * de app, de FCM-verzender kiest er server-side het juiste kanaal uit. Idioom van
 * `lib/exercise-types.ts` en `lib/achievements/definitions.ts`: **nieuw kanaal =
 * één record hieronder**.
 *
 * ## Waarom kanalen
 *
 * Vanaf Android 8 hoort élke melding bij een kanaal. Geef je er geen op, dan
 * belandt alles in één naamloze bak (in de instellingen: "Overig") en kan de
 * gebruiker alleen álle meldingen tegelijk uitzetten. Met kanalen kan hij per
 * soort kiezen, precies zoals hij dat in de app onder Account → Meldingen ook
 * kan, en dat is meteen de reden dat de indeling hier de categorieën volgt.
 *
 * ## Waarom niet elke categorie even hard binnenkomt
 *
 * `importance` bepaalt of een melding met geluid en een pop-up binnenkomt (4) of
 * stil in de balk verschijnt (2). Een onveilig apparaat mag onderbreken; een
 * behaalde trofee niet. Zonder dat onderscheid leert de gebruiker de app negeren.
 *
 * ⚠️ Een kanaal is **onveranderlijk na aanmaken**. Wijzig je naam, omschrijving
 * of importance, dan ziet een bestaande gebruiker dat pas na herinstallatie,
 * tenzij je de `id` ophoogt (`gymrebel-schemas-v2`). Android laat dit bewust niet
 * toe zodat een app de keuze van de gebruiker niet kan overrulen.
 */
export type PushChannel = {
  /** Kanaal-id. Ophogen bij een inhoudelijke wijziging (zie waarschuwing hierboven). */
  id: string;
  /** Naam zoals de gebruiker die in de systeeminstellingen ziet. */
  name: string;
  /** Uitleg eronder; helpt bij de keuze om een kanaal uit te zetten. */
  description: string;
  /** 1 = min, 2 = laag (stil), 3 = standaard, 4 = hoog (geluid + pop-up). */
  importance: 1 | 2 | 3 | 4 | 5;
};

/**
 * Alleen de categorieën die daadwerkelijk push versturen. De overige
 * categorieën (`news`, `security`, `system`, `changes`, `new_members`,
 * `invitations`) lopen vandaag alleen via in-app en e-mail; komt daar push bij,
 * voeg dan hier een record toe.
 */
export const PUSH_CHANNELS = {
  schemas: {
    id: "gymrebel-schemas",
    name: "Trainingsschema's",
    description: "Je coach heeft een schema klaargezet of aangepast.",
    // Hoog: dit is waarvoor het lid de app opent.
    importance: 4,
  },
  defects: {
    id: "gymrebel-defects",
    name: "Apparaatmeldingen",
    description: "Meldingen over defecte of onveilige apparatuur.",
    // Hoog: een onveilig apparaat moet mogen onderbreken.
    importance: 4,
  },
  maintenance: {
    id: "gymrebel-maintenance",
    name: "Onderhoud",
    description: "Apparatuur die onderhoud nodig heeft.",
    // Standaard: belangrijk voor beheer, maar niet acuut.
    importance: 3,
  },
  achievements: {
    id: "gymrebel-achievements",
    name: "Trofeeën en mijlpalen",
    description: "Je hebt een trofee of mijlpaal behaald.",
    // Laag: leuk om te zien, maar mag nooit je dag onderbreken.
    importance: 2,
  },
} as const satisfies Partial<Record<NotificationCategory, PushChannel>>;

export type PushChannelCategory = keyof typeof PUSH_CHANNELS;

/**
 * Vangnet-kanaal voor meldingen zonder categorie. De id moet gelijk zijn aan
 * `default_notification_channel_id` in `android/app/src/main/res/values/strings.xml`,
 * want Firebase leest 'm daar uit wanneer het zelf een melding opbouwt (app op de
 * achtergrond). Lopen die twee uit elkaar, dan valt zo'n melding alsnog in
 * Androids naamloze "Overig".
 */
export const DEFAULT_PUSH_CHANNEL: PushChannel = {
  id: "gymrebel-general",
  name: "Algemeen",
  description: "Overige meldingen uit GymRebel.",
  importance: 3,
};

/** Alle kanalen, voor het aanmaken bij het starten van de app. */
export const ALL_PUSH_CHANNELS: PushChannel[] = [
  DEFAULT_PUSH_CHANNEL,
  ...Object.values(PUSH_CHANNELS),
];

/**
 * Kanaal-id voor een categorie. Onbekend of geen categorie meegegeven → `null`,
 * waarna Android het standaardkanaal gebruikt (zie de `default_notification_
 * channel_id`-meta-data in AndroidManifest.xml). Nooit gokken: een verzonnen
 * kanaal-id levert een melding op die de gebruiker nergens kan terugvinden.
 */
export function channelIdFor(category: string | undefined): string | null {
  if (!category) return null;
  const channel = (PUSH_CHANNELS as Record<string, PushChannel | undefined>)[category];
  return channel?.id ?? null;
}
