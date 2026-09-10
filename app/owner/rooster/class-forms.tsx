"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { MAX_REPEAT_WEEKS } from "@/lib/class-attendance";
import {
  createClass,
  updateClass,
  addSession,
  updateSession,
  setClassImage,
  type ClassFormState,
  type SessionFormState,
} from "./actions";

const inputClass =
  "rounded-lg border border-neutral-200 bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent";

export type ClassFormValues = {
  id: string;
  name: string;
  description: string | null;
  instructorName: string | null;
  maxParticipants: number;
  defaultInstructorId: string | null;
  cancelDeadlineMinutes: number | null;
  bookingOpensDays: number | null;
  maxBookingsPerWeek: number | null;
  remindHoursBefore: number | null;
};

/** Teamleden die als instructeur gekozen kunnen worden. */
export type InstructorOption = { id: string; name: string };

/**
 * De sportschool-standaard, als placeholder in de override-velden: leeg laten
 * betekent "volg de sportschool", en dan wil je zien wat dat is.
 */
export type BookingDefaultsView = {
  cancelDeadlineMinutes: number;
  bookingOpensDays: number;
  maxBookingsPerWeek: number | null;
  remindHoursBefore: number;
};

function FormMessage({ state }: { state: { error?: string; success?: string } }) {
  if (state.error) return <span className="w-full text-sm text-red-600">{state.error}</span>;
  if (state.success) return <span className="w-full text-sm text-green-700">{state.success}</span>;
  return null;
}

function ClassFields({
  t,
  values,
  instructors,
  defaults,
}: {
  t: ReturnType<typeof useTranslations>;
  values?: ClassFormValues;
  instructors: InstructorOption[];
  defaults: BookingDefaultsView;
}) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formName")}
        <input name="name" required defaultValue={values?.name} placeholder={t("namePlaceholder")} className={inputClass} />
      </label>
      {/* Vaste instructeur als teamlid: dát maakt "mijn lessen" op het
          dashboard en een vervanger-melding mogelijk. De vrije tekst blijft
          bestaan voor een externe docent die geen account heeft. */}
      {instructors.length > 0 ? (
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Vaste instructeur
          <select
            name="defaultInstructorId"
            defaultValue={values?.defaultInstructorId ?? ""}
            className={inputClass}
          >
            <option value="">Geen</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formInstructor")}
        <input name="instructorName" defaultValue={values?.instructorName ?? ""} placeholder={t("optional")} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formMaxParticipants")}
        <input
          name="maxParticipants"
          type="number"
          min={1}
          max={200}
          defaultValue={values?.maxParticipants ?? 12}
          className={`${inputClass} w-28`}
        />
      </label>
      <label className="flex w-full flex-col gap-1 text-sm text-neutral-700">
        {t("formDescription")}
        <textarea
          name="description"
          rows={2}
          maxLength={1000}
          defaultValue={values?.description ?? ""}
          placeholder={t("optional")}
          className={inputClass}
        />
        <span className="text-xs text-neutral-500">{t("descriptionHint")}</span>
      </label>

      {/* Boekingsregels: leeg = volg de sportschool-standaard. De placeholder
          toont die standaard, zodat leeglaten geen gok is. */}
      <fieldset className="flex w-full flex-wrap items-end gap-3 rounded-lg border border-border p-3">
        <legend className="px-1 text-xs font-semibold text-neutral-500">
          Boekingsregels (leeg = zoals ingesteld bij de sportschool)
        </legend>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Afmelden tot (min. vooraf)
          <input
            name="cancelDeadlineMinutes"
            type="number"
            min={0}
            max={10080}
            defaultValue={values?.cancelDeadlineMinutes ?? ""}
            placeholder={String(defaults.cancelDeadlineMinutes)}
            className={`${inputClass} w-28`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Boeken vanaf (dagen)
          <input
            name="bookingOpensDays"
            type="number"
            min={1}
            max={365}
            defaultValue={values?.bookingOpensDays ?? ""}
            placeholder={String(defaults.bookingOpensDays)}
            className={`${inputClass} w-28`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Max. per week
          <input
            name="maxBookingsPerWeek"
            type="number"
            min={0}
            max={50}
            defaultValue={values?.maxBookingsPerWeek ?? ""}
            placeholder={defaults.maxBookingsPerWeek === null ? "onbeperkt" : String(defaults.maxBookingsPerWeek)}
            className={`${inputClass} w-28`}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Herinnering (uur vooraf)
          <input
            name="remindHoursBefore"
            type="number"
            min={1}
            max={72}
            defaultValue={values?.remindHoursBefore ?? ""}
            placeholder={String(defaults.remindHoursBefore)}
            className={`${inputClass} w-28`}
          />
        </label>
      </fieldset>
    </>
  );
}

export function NewClassForm({
  instructors,
  defaults,
}: {
  instructors: InstructorOption[];
  defaults: BookingDefaultsView;
}) {
  const t = useTranslations("owner.rooster");
  const [state, formAction, pending] = useActionState<ClassFormState, FormData>(createClass, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <ClassFields t={t} instructors={instructors} defaults={defaults} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("adding") : t("newClass")}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

export function EditClassForm({
  values,
  instructors,
  defaults,
}: {
  values: ClassFormValues;
  instructors: InstructorOption[];
  defaults: BookingDefaultsView;
}) {
  const t = useTranslations("owner.rooster");
  const [state, formAction, pending] = useActionState<ClassFormState, FormData>(updateClass, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={values.id} />
      <ClassFields t={t} values={values} instructors={instructors} defaults={defaults} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("saving") : t("save")}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

export type SessionFormValues = {
  id: string;
  /** Klok van de vestiging ("YYYY-MM-DDTHH:mm"), server-side omgezet met lib/tz. */
  startsAt: string;
  endsAt: string;
  locationId: string;
  location: string | null;
  maxParticipants: number | null;
  instructorId: string | null;
};

function SessionFields({
  t,
  locations,
  defaultLocationId,
  values,
  instructors,
}: {
  t: ReturnType<typeof useTranslations>;
  locations: { id: string; name: string }[];
  defaultLocationId: string;
  values?: SessionFormValues;
  instructors: InstructorOption[];
}) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formStart")}
        <input name="startsAt" type="datetime-local" required defaultValue={values?.startsAt} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formEnd")}
        <input name="endsAt" type="datetime-local" required defaultValue={values?.endsAt} className={inputClass} />
      </label>
      {locations.length > 1 ? (
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          {t("formVenue")}
          <select name="locationId" defaultValue={values?.locationId ?? defaultLocationId} className={inputClass}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="locationId" value={values?.locationId ?? defaultLocationId} />
      )}
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formLocation")}
        <input name="location" defaultValue={values?.location ?? ""} placeholder={t("optional")} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formMaxOverride")}
        <input
          name="maxParticipants"
          type="number"
          min={1}
          max={200}
          defaultValue={values?.maxParticipants ?? ""}
          placeholder={t("optional")}
          className={`${inputClass} w-28`}
        />
      </label>
      {/* Instructeur van déze sessie: zo regel je een vervanger zonder het
          lestype aan te passen. Leeg = de vaste instructeur van het lestype. */}
      {instructors.length > 0 ? (
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Instructeur
          <select name="instructorId" defaultValue={values?.instructorId ?? ""} className={inputClass}>
            <option value="">Standaard</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </>
  );
}

/** Weekdag-keuze voor het weekpatroon (ISO 1 = maandag … 7 = zondag). */
const WEEKDAY_LABELS: [number, string][] = [
  [1, "ma"],
  [2, "di"],
  [3, "wo"],
  [4, "do"],
  [5, "vr"],
  [6, "za"],
  [7, "zo"],
];

export function AddSessionForm({
  classId,
  locations,
  defaultLocationId,
  instructors,
}: {
  classId: string;
  /** Vestigingen waar deze gebruiker mag plannen (scope-gefilterd). */
  locations: { id: string; name: string }[];
  defaultLocationId: string;
  instructors: InstructorOption[];
}) {
  const t = useTranslations("owner.rooster");
  const [state, formAction, pending] = useActionState<SessionFormState, FormData>(addSession, {});
  const [repeat, setRepeat] = useState(0);
  const [weekdays, setWeekdays] = useState<number[]>([]);

  const toggleDay = (day: number) =>
    setWeekdays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day]
    );

  // Voorvertoning: hoeveel lessen levert dit patroon op? Zonder gekozen dagen
  // is dat de oude wekelijkse reeks (de eerste + `repeat` herhalingen).
  // Bewust een schatting op basis van het aantal dagen — de exacte data komen
  // uit `expandWeeklyPlan` op de server, die ook de dagen vóór het anker in de
  // eerste week overslaat.
  const perWeek = Math.max(1, weekdays.length);
  const estimate = perWeek * (repeat + 1);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="classId" value={classId} />
      <SessionFields
        t={t}
        locations={locations}
        defaultLocationId={defaultLocationId}
        instructors={instructors}
      />
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        {t("formRepeat")}
        <select
          name="repeatWeeks"
          value={repeat}
          onChange={(e) => setRepeat(Number(e.target.value))}
          className={inputClass}
        >
          <option value={0}>{t("noRepeat")}</option>
          {Array.from({ length: MAX_REPEAT_WEEKS }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {t("repeatWeeks", { count: n })}
            </option>
          ))}
        </select>
      </label>
      {/* Een sportschool denkt in "ma+wo+vr 19:00", niet in losse sessies.
          Niets aanvinken = alleen de dag van de starttijd (oud gedrag). */}
      {repeat > 0 ? (
        <div className="flex flex-col gap-1 text-sm text-neutral-700">
          Ook op
          <div className="flex gap-1">
            {WEEKDAY_LABELS.map(([day, label]) => {
              const active = weekdays.includes(day);
              return (
                <label
                  key={day}
                  className={`cursor-pointer select-none rounded-lg border px-2.5 py-2 text-xs font-medium capitalize ${
                    active
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-surface-1 text-neutral-600 hover:bg-surface-2"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="weekdays"
                    value={day}
                    checked={active}
                    onChange={() => toggleDay(day)}
                    className="sr-only"
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("scheduling") : t("scheduleSession")}
      </button>
      {repeat > 0 ? (
        <span className="text-xs text-neutral-500">
          Ongeveer {estimate} {estimate === 1 ? "les" : "lessen"}
        </span>
      ) : null}
      <FormMessage state={state} />
    </form>
  );
}

export function EditSessionForm({
  classId,
  locations,
  values,
  inSeries = false,
  instructors,
}: {
  classId: string;
  locations: { id: string; name: string }[];
  values: SessionFormValues;
  /** Onderdeel van een herhaalreeks → optie "ook alle volgende" tonen. */
  inSeries?: boolean;
  instructors: InstructorOption[];
}) {
  const t = useTranslations("owner.rooster");
  const [state, formAction, pending] = useActionState<SessionFormState, FormData>(updateSession, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={values.id} />
      <input type="hidden" name="classId" value={classId} />
      <SessionFields
        t={t}
        locations={locations}
        defaultLocationId={values.locationId}
        values={values}
        instructors={instructors}
      />
      {inSeries ? (
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" name="following" value="1" className="size-4 accent-accent" />
          {t("editFollowing")}
        </label>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t("saving") : t("save")}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

/**
 * Omslagfoto van een lestype. Rauwe `<img>`, geen `next/image`: zonder
 * Blob-token levert de upload lokaal een data-URL op en die kan de optimizer
 * niet aan (zelfde afweging als de schema-omslagfoto).
 */
export function ClassImageForm({
  classId,
  imageUrl,
  fallbackUrl,
}: {
  classId: string;
  imageUrl: string | null;
  /** Sportschoollogo: wat het lid ziet zolang er geen eigen foto is. */
  fallbackUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState<ClassFormState, FormData>(setClassImage, {});
  const shown = imageUrl ?? fallbackUrl;
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="id" value={classId} />
      <div className="flex h-20 w-30 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt=""
            className={`h-full w-full ${imageUrl ? "object-cover" : "object-contain p-2"}`}
          />
        ) : (
          <span className="text-xs text-neutral-400">Geen beeld</span>
        )}
      </div>
      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Afbeelding (max. 5 MB)
        <input type="file" name="image" accept="image/*" className="text-sm" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Bezig…" : "Opslaan"}
      </button>
      {imageUrl ? (
        <button
          type="submit"
          name="remove"
          value="1"
          disabled={pending}
          className="rounded-lg border border-border px-4 py-2 text-sm text-neutral-600 hover:bg-surface-2 disabled:opacity-50"
        >
          Verwijderen
        </button>
      ) : null}
      <FormMessage state={state} />
      <p className="w-full text-xs text-neutral-500">
        Zonder eigen foto toont de app het sportschoollogo, dus &quot;geen afbeelding&quot; bestaat
        niet als eindtoestand.
      </p>
    </form>
  );
}
