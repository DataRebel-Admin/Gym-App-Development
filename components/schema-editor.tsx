"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { saveSchema, type SchemaSaveState } from "@/app/owner/schemas/actions";
import Link from "next/link";
import { Info } from "@/components/ui/icons";
import {
  EXERCISE_TYPES,
  getExerciseType,
  exerciseTypeLabel,
  type ParamField,
} from "@/lib/exercise-types";
import {
  defaultInputValues,
  summaryFromInputValues,
  type InputValues,
} from "@/lib/exercise-params";
import { trainingGoalOptions } from "@/lib/training-goals";
import { schemaBadgeOptions, parseBadges } from "@/lib/schema-badges";

export type EditorItem = {
  key: string;
  exerciseId: string;
  exerciseName: string;
  /** Oefeningstype (bepaalt de dynamische velden). */
  exerciseType: string;
  /** Invoerwaarden per veld-id (input-eenheid: min/km/…); leeg = niet ingevuld. */
  values: InputValues;
  notes: string;
};

export type EditorDay = {
  key: string;
  name: string;
  notes: string;
  items: EditorItem[];
};

export type AvailableExercise = {
  id: string;
  name: string;
  targetMuscle: string | null;
  exerciseType: string;
  /** Herkomst: "standaard" (catalogus) of "eigen" (tenant-oefening). */
  source: "standaard" | "eigen";
  /** Thumbnail (catalogus of eigen media) — voor een preview die het lid nabootst. */
  thumbUrl: string | null;
  /** Machine-naam (indien gekoppeld) — het lid ziet die ook. */
  machineName: string | null;
};

/** Herbruikbare dag (kind=DAY) om als blok in te voegen. */
export type DayTemplateOption = {
  id: string;
  name: string;
  notes: string;
  items: Omit<EditorItem, "key">[];
};

const numClass =
  "w-16 rounded-md border border-border px-2 py-1 text-sm outline-none focus:border-accent";

/** Label voor een veld inclusief invoer-eenheid (bv. "tijd (min)"). */
function fieldLabel(field: ParamField): string {
  const unit =
    field.kind === "duration" || field.kind === "distance"
      ? ` (${field.unit})`
      : "";
  return `${field.label.toLowerCase()}${unit}`;
}

/** Eén dynamisch invoerveld in de editor-rij (compact). */
function ParamInput({
  field,
  value,
  onChange,
}: {
  field: ParamField;
  value: string;
  onChange: (v: string) => void;
}) {
  if (field.kind === "enum") {
    return (
      <label className="flex items-center gap-1 text-xs text-neutral-500">
        {fieldLabel(field)}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-md border border-border px-1.5 py-1 text-sm outline-none focus:border-accent"
        >
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (field.kind === "text") {
    return (
      <label className="flex items-center gap-1 text-xs text-neutral-500">
        {fieldLabel(field)}
        <input
          type="text"
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 rounded-md border border-border px-2 py-1 text-sm outline-none focus:border-accent"
        />
      </label>
    );
  }
  return (
    <label className="flex items-center gap-1 text-xs text-neutral-500">
      {fieldLabel(field)}
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={field.step ?? (field.kind === "float" ? 0.5 : 1)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={numClass}
      />
    </label>
  );
}

/** Kleine herkomst-badge: Standaard (catalogus) of Eigen (tenant-oefening). */
function SourceBadge({ source }: { source: "standaard" | "eigen" }) {
  const eigen = source === "eigen";
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        eigen ? "bg-accent-soft text-accent" : "bg-neutral-100 text-neutral-500"
      }`}
    >
      {eigen ? "Eigen" : "Standaard"}
    </span>
  );
}

function SortableRow({
  item,
  source,
  dayKeys,
  currentDayKey,
  onChange,
  onRemove,
  onCopyTo,
}: {
  item: EditorItem;
  source?: "standaard" | "eigen";
  dayKeys: { key: string; name: string }[];
  currentDayKey: string;
  onChange: (key: string, patch: Partial<EditorItem>) => void;
  onRemove: (key: string) => void;
  onCopyTo: (itemKey: string, toDayKey: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.key });
  const otherDays = dayKeys.filter((d) => d.key !== currentDayKey);
  const type = getExerciseType(item.exerciseType);
  const TypeIcon = type.icon;

  function setValue(fieldId: string, v: string) {
    onChange(item.key, { values: { ...item.values, [fieldId]: v } });
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2 ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <button type="button" className="cursor-grab text-neutral-400 hover:text-neutral-700" aria-label="Versleep" {...attributes} {...listeners}>
          ⠿
        </button>
        <span className="flex flex-1 items-center gap-2 text-sm font-medium text-neutral-900">
          {source ? <SourceBadge source={source} /> : null}
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${type.tone}`}
            title={type.label}
          >
            <TypeIcon className="size-3" /> {type.label}
          </span>
          <span className="truncate">{item.exerciseName}</span>
        </span>
        {otherDays.length > 0 ? (
          <select
            value=""
            onChange={(e) => { if (e.target.value) onCopyTo(item.key, e.target.value); }}
            className="rounded-md border border-border px-1 py-1 text-xs text-neutral-500"
            title="Kopieer naar dag"
          >
            <option value="">⧉ dag…</option>
            {otherDays.map((d) => (
              <option key={d.key} value={d.key}>→ {d.name}</option>
            ))}
          </select>
        ) : null}
        <button type="button" onClick={() => onRemove(item.key)} className="text-neutral-400 hover:text-red-600" aria-label="Verwijder">✕</button>
      </div>

      {/* Dynamische, type-specifieke doelvelden */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-6">
        {type.targetFields.map((field) => (
          <ParamInput
            key={field.id}
            field={field}
            value={item.values[field.id] ?? ""}
            onChange={(v) => setValue(field.id, v)}
          />
        ))}
      </div>

      <input
        type="text"
        value={item.notes}
        onChange={(e) => onChange(item.key, { notes: e.target.value })}
        placeholder="Opmerking (optioneel)…"
        className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs text-neutral-700 outline-none focus:border-accent"
      />
    </div>
  );
}

function DayCard({
  day,
  index,
  dayKeys,
  availableExercises,
  onRename,
  onNotesChange,
  onRemove,
  onAdd,
  onReorder,
  onItemChange,
  onItemRemove,
  onCopyTo,
}: {
  day: EditorDay;
  index: number;
  dayKeys: { key: string; name: string }[];
  availableExercises: AvailableExercise[];
  onRename: (dayKey: string, name: string) => void;
  onNotesChange: (dayKey: string, notes: string) => void;
  onRemove: (dayKey: string) => void;
  onAdd: (dayKey: string, ex: AvailableExercise) => void;
  onReorder: (dayKey: string, e: DragEndEvent) => void;
  onItemChange: (dayKey: string, itemKey: string, patch: Partial<EditorItem>) => void;
  onItemRemove: (dayKey: string, itemKey: string) => void;
  onCopyTo: (fromDayKey: string, itemKey: string, toDayKey: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor));
  const [query, setQuery] = useState("");

  const sourceById = useMemo(
    () => new Map(availableExercises.map((e) => [e.id, e.source])),
    [availableExercises]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return availableExercises
      .filter((e) => e.name.toLowerCase().includes(q) || (e.targetMuscle ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, availableExercises]);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-neutral-400">Dag {index + 1}</span>
        <input
          value={day.name}
          onChange={(e) => onRename(day.key, e.target.value)}
          className="flex-1 rounded-md border border-transparent px-2 py-1 text-sm font-semibold text-neutral-900 hover:border-border focus:border-accent focus:outline-none"
        />
        <button type="button" onClick={() => onRemove(day.key)} className="text-xs text-neutral-400 hover:text-red-600">
          Verwijder dag
        </button>
      </div>

      <input
        type="text"
        value={day.notes}
        onChange={(e) => onNotesChange(day.key, e.target.value)}
        placeholder="Dag-notitie voor het lid (optioneel)…"
        className="w-full rounded-md border border-border bg-transparent px-2 py-1 text-xs text-neutral-700 outline-none focus:border-accent"
      />

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onReorder(day.key, e)}>
        <SortableContext items={day.items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {day.items.map((it) => (
              <SortableRow
                key={it.key}
                item={it}
                source={sourceById.get(it.exerciseId)}
                dayKeys={dayKeys}
                currentDayKey={day.key}
                onChange={(k, p) => onItemChange(day.key, k, p)}
                onRemove={(k) => onItemRemove(day.key, k)}
                onCopyTo={(k, to) => onCopyTo(day.key, k, to)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {day.items.length === 0 ? (
        <p className="text-sm text-neutral-500">Nog geen oefeningen — zoek hieronder.</p>
      ) : null}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Zoek een oefening om toe te voegen…"
          className="w-full rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {matches.length > 0 ? (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface-1 shadow-lg">
            {matches.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => { onAdd(day.key, e); setQuery(""); }}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-neutral-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <SourceBadge source={e.source} />
                    <span className="truncate font-medium text-neutral-900">{e.name}</span>
                  </span>
                  {e.targetMuscle ? <span className="shrink-0 text-xs text-neutral-400">{e.targetMuscle}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

let dayCounter = 0;
let itemCounter = 0;

export function SchemaEditor({
  templateId,
  initialName,
  initialDescription,
  initialCoachNote = "",
  initialValidityWeeks = null,
  initialGoal = null,
  initialBadges = [],
  showValidity = true,
  initialDays,
  availableExercises,
  dayTemplates = [],
}: {
  templateId: string;
  initialName: string;
  initialDescription: string;
  initialCoachNote?: string;
  /** Geldigheidsduur in weken (alleen zinvol voor volledige schema's). */
  initialValidityWeeks?: number | null;
  /** Neutraal trainingsdoel (key uit lib/training-goals.ts). */
  initialGoal?: string | null;
  /** Toegewezen badges (keys uit lib/schema-badges.ts). */
  initialBadges?: string[];
  /** Toon het geldigheid-veld (uit voor dag-templates). */
  showValidity?: boolean;
  initialDays: EditorDay[];
  availableExercises: AvailableExercise[];
  dayTemplates?: DayTemplateOption[];
}) {
  const [state, formAction, pending] = useActionState<SchemaSaveState, FormData>(saveSchema, {});
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [coachNote, setCoachNote] = useState(initialCoachNote);
  const [validityWeeks, setValidityWeeks] = useState(
    initialValidityWeeks != null ? String(initialValidityWeeks) : ""
  );
  const [goal, setGoal] = useState(initialGoal ?? "");
  const [badges, setBadges] = useState<Set<string>>(() => new Set(parseBadges(initialBadges)));
  const [days, setDays] = useState<EditorDay[]>(
    initialDays.length > 0 ? initialDays : [{ key: `d-${dayCounter++}`, name: "Dag 1", notes: "", items: [] }]
  );
  const serializedBadges = useMemo(() => JSON.stringify([...badges]), [badges]);
  function toggleBadge(key: string) {
    setBadges((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  const formRef = useRef<HTMLFormElement>(null);
  const mounted = useRef(false);

  // Opzoektabel voor de preview (thumbnail/machine) zodat die 1-op-1 toont wat het lid ziet.
  const exerciseById = useMemo(
    () => new Map(availableExercises.map((e) => [e.id, e])),
    [availableExercises]
  );

  const serialized = useMemo(
    () =>
      JSON.stringify(
        days.map((d) => ({
          name: d.name.trim() || "Dag",
          notes: d.notes,
          items: d.items.map((i) => ({
            exerciseId: i.exerciseId,
            exerciseType: i.exerciseType,
            values: i.values,
            notes: i.notes,
          })),
        }))
      ),
    [days]
  );

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const t = setTimeout(() => {
      if (name.trim()) formRef.current?.requestSubmit();
    }, 1200);
    return () => clearTimeout(t);
  }, [serialized, name, description, coachNote, validityWeeks, goal, serializedBadges]);

  const dayKeys = days.map((d) => ({ key: d.key, name: d.name.trim() || "Dag" }));

  function updateDay(dayKey: string, fn: (d: EditorDay) => EditorDay) {
    setDays((prev) => prev.map((d) => (d.key === dayKey ? fn(d) : d)));
  }

  function addDay() {
    setDays((prev) => [...prev, { key: `d-${dayCounter++}`, name: `Dag ${prev.length + 1}`, notes: "", items: [] }]);
  }
  function addDayFromTemplate(tplId: string) {
    const tpl = dayTemplates.find((t) => t.id === tplId);
    if (!tpl) return;
    setDays((prev) => [
      ...prev,
      {
        key: `d-${dayCounter++}`,
        name: tpl.name,
        notes: tpl.notes,
        items: tpl.items.map((it) => ({ ...it, key: `i-${itemCounter++}` })),
      },
    ]);
  }
  function removeDay(dayKey: string) {
    setDays((prev) => (prev.length <= 1 ? prev : prev.filter((d) => d.key !== dayKey)));
  }
  function renameDay(dayKey: string, name: string) {
    updateDay(dayKey, (d) => ({ ...d, name }));
  }
  function setDayNotes(dayKey: string, notes: string) {
    updateDay(dayKey, (d) => ({ ...d, notes }));
  }
  function addItem(dayKey: string, ex: AvailableExercise) {
    updateDay(dayKey, (d) => ({
      ...d,
      items: [
        ...d.items,
        {
          key: `i-${itemCounter++}`,
          exerciseId: ex.id,
          exerciseName: ex.name,
          exerciseType: ex.exerciseType,
          values: defaultInputValues(ex.exerciseType),
          notes: "",
        },
      ],
    }));
  }
  function reorder(dayKey: string, e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    updateDay(dayKey, (d) => {
      const from = d.items.findIndex((i) => i.key === active.id);
      const to = d.items.findIndex((i) => i.key === over.id);
      return { ...d, items: arrayMove(d.items, from, to) };
    });
  }
  function patchItem(dayKey: string, itemKey: string, p: Partial<EditorItem>) {
    updateDay(dayKey, (d) => ({ ...d, items: d.items.map((i) => (i.key === itemKey ? { ...i, ...p } : i)) }));
  }
  function removeItem(dayKey: string, itemKey: string) {
    updateDay(dayKey, (d) => ({ ...d, items: d.items.filter((i) => i.key !== itemKey) }));
  }
  function copyItemToDay(fromDayKey: string, itemKey: string, toDayKey: string) {
    setDays((prev) => {
      const item = prev.find((d) => d.key === fromDayKey)?.items.find((i) => i.key === itemKey);
      if (!item) return prev;
      const clone = { ...item, key: `i-${itemCounter++}` };
      return prev.map((d) => (d.key === toDayKey ? { ...d, items: [...d.items, clone] } : d));
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form ref={formRef} action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="templateId" value={templateId} />
        <input type="hidden" name="days" value={serialized} />
        <input type="hidden" name="badges" value={serializedBadges} />

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Naam *
          <input name="name" required value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Beschrijving
          <textarea name="description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Coach-notitie (zichtbaar voor het lid)
          <textarea name="coachNote" rows={2} value={coachNote} onChange={(e) => setCoachNote(e.target.value)} placeholder="Bijv. Concentreer je op techniek." className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Trainingsdoel
          <select name="goal" value={goal} onChange={(e) => setGoal(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent">
            <option value="">Geen doel</option>
            {trainingGoalOptions().map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="text-xs text-neutral-400">
            Helpt leden het juiste schema te vinden dat past bij hun eigen doel.
          </span>
        </label>
        <div className="flex flex-col gap-1.5 text-sm text-neutral-700">
          Badges
          <div className="flex flex-wrap gap-2">
            {schemaBadgeOptions().map((b) => {
              const Icon = b.icon;
              const active = badges.has(b.key);
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => toggleBadge(b.key)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? `border-transparent ${b.tone}`
                      : "border-border bg-surface-1 text-neutral-500 hover:bg-surface-2"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {b.label}
                </button>
              );
            })}
          </div>
          <span className="text-xs text-neutral-400">
            Visuele labels in de bibliotheek, op het dashboard en bij het kiezen van een schema.
          </span>
        </div>
        {showValidity ? (
          <label className="flex flex-col gap-1 text-sm text-neutral-700">
            Geldigheid (weken)
            <input
              name="validityWeeks"
              type="number"
              min={0}
              max={104}
              inputMode="numeric"
              value={validityWeeks}
              onChange={(e) => setValidityWeeks(e.target.value)}
              placeholder="Onbeperkt"
              className="w-32 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <span className="text-xs text-neutral-400">
              Leeg = onbeperkt. Bepaalt wanneer een lid &quot;Nieuw schema nodig&quot; / &quot;Verlopen&quot; ziet.
            </span>
          </label>
        ) : (
          <input type="hidden" name="validityWeeks" value={validityWeeks} />
        )}

        <div className="flex flex-col gap-3">
          {days.map((d, i) => (
            <DayCard
              key={d.key}
              day={d}
              index={i}
              dayKeys={dayKeys}
              availableExercises={availableExercises}
              onRename={renameDay}
              onNotesChange={setDayNotes}
              onRemove={removeDay}
              onAdd={addItem}
              onReorder={reorder}
              onItemChange={patchItem}
              onItemRemove={removeItem}
              onCopyTo={copyItemToDay}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={addDay} className="rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50">
            + Dag toevoegen
          </button>
          {dayTemplates.length > 0 ? (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) addDayFromTemplate(e.target.value);
                e.target.value = "";
              }}
              className="rounded-lg border border-border-strong px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              title="Dag toevoegen vanuit template"
            >
              <option value="">+ Dag uit template…</option>
              {dayTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.items.length} oef.)
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
            {pending ? "Opslaan…" : "Nu opslaan"}
          </button>
          <span className="text-sm text-neutral-500" aria-live="polite">
            {pending ? "Bezig met opslaan…" : state.ok ? "Automatisch opgeslagen ✓" : "Wijzigingen worden automatisch opgeslagen"}
          </span>
          {state.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
        </div>
      </form>

      <aside className="h-fit rounded-2xl border border-border bg-surface-1 p-5 lg:sticky lg:top-6">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Live voorbeeld</p>
        <p className="text-[11px] text-neutral-400">Zo ziet het lid dit schema.</p>
        <h3 className="mt-2 text-lg font-semibold text-neutral-900">{name || "Naamloos schema"}</h3>
        {description ? <p className="mt-1 text-sm text-neutral-500">{description}</p> : null}
        <div className="mt-4 flex flex-col gap-5">
          {days.map((d) => (
            <div key={d.key} className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-neutral-900">{d.name || "Dag"}</p>
              {d.notes ? (
                <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-neutral-600">
                  <span className="font-semibold text-accent">Tip: </span>
                  {d.notes}
                </p>
              ) : null}
              <ul className="flex flex-col gap-2">
                {d.items.map((it) => {
                  const meta = exerciseById.get(it.exerciseId);
                  const summary = summaryFromInputValues(it.exerciseType, it.values);
                  return (
                    <li
                      key={it.key}
                      className="flex items-center rounded-xl border border-border bg-surface-1"
                    >
                      <div className="flex flex-1 items-center gap-3 px-3 py-2.5">
                        {meta?.thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={meta.thumbUrl}
                            alt=""
                            aria-hidden
                            className="h-10 w-10 shrink-0 rounded-lg object-cover"
                          />
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-neutral-900">
                            {it.exerciseName}
                          </span>
                          <span className="block text-sm text-neutral-500">
                            <span className="font-medium text-neutral-600">
                              {exerciseTypeLabel(it.exerciseType)}
                            </span>
                            {summary && summary !== "—" ? ` · ${summary}` : ""}
                            {meta?.machineName ? ` · ${meta.machineName}` : ""}
                          </span>
                          {it.notes ? (
                            <span className="mt-0.5 block text-xs text-accent">{it.notes}</span>
                          ) : null}
                        </span>
                      </div>
                      <Link
                        href={`/owner/exercises/${it.exerciseId}`}
                        target="_blank"
                        aria-label={`Uitleg: ${it.exerciseName}`}
                        title="Uitleg"
                        className="flex shrink-0 flex-col items-center justify-center gap-0.5 self-stretch border-l border-border px-3 text-neutral-400 transition-colors hover:text-accent"
                      >
                        <Info className="size-5" />
                        <span className="text-[10px] font-medium">Uitleg</span>
                      </Link>
                    </li>
                  );
                })}
                {d.items.length === 0 ? (
                  <li className="text-xs text-neutral-400">Leeg.</li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
