"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
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
import type { MemberSchemaMode, MemberSchemaStatus } from "@prisma/client";
import type { EditorDay, EditorItem, AvailableExercise } from "@/components/schema-editor";
import {
  saveMemberDraft,
  submitMemberSchema,
  setFavoriteExercises,
  type MemberSchemaSaveState,
} from "@/app/member/schema/builder/actions";
import { getExerciseType, exerciseTypeLabel, type ParamField } from "@/lib/exercise-types";
import {
  defaultInputValues,
  summaryFromInputValues,
  type InputValues,
} from "@/lib/exercise-params";
import {
  isExerciseAllowed,
  describeLimits,
  type FrameworkLimits,
} from "@/lib/member-schema-constraints";
import { Info, Star, Copy, Plus } from "@/components/ui/icons";

let dayCounter = 0;
let itemCounter = 0;

/** Effectieve grens voor een kolom-veld: veld-eigen grens vernauwd door het kader. */
function boundsFor(field: ParamField, limits: FrameworkLimits | null): { min?: number; max?: number } {
  let min = field.min;
  let max = field.max;
  if (limits) {
    const apply = (lo: number | null, hi: number | null) => {
      if (lo != null) min = min == null ? lo : Math.max(min, lo);
      if (hi != null) max = max == null ? hi : Math.min(max, hi);
    };
    if (field.column === "sets") apply(limits.setsMin, limits.setsMax);
    else if (field.column === "reps") apply(limits.repsMin, limits.repsMax);
    else if (field.column === "restSeconds") apply(limits.restMin, limits.restMax);
  }
  return { min, max };
}

function fieldLabel(field: ParamField): string {
  const unit =
    field.kind === "duration" || field.kind === "distance" ? ` (${field.unit})` : "";
  return `${field.label.toLowerCase()}${unit}`;
}

function ParamInput({
  field,
  value,
  limits,
  onChange,
}: {
  field: ParamField;
  value: string;
  limits: FrameworkLimits | null;
  onChange: (v: string) => void;
}) {
  if (field.kind === "enum") {
    return (
      <label className="flex items-center gap-1.5 text-xs text-neutral-500">
        {fieldLabel(field)}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg border border-border px-2 py-2 text-sm outline-none focus:border-accent"
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
      <label className="flex items-center gap-1.5 text-xs text-neutral-500">
        {fieldLabel(field)}
        <input
          type="text"
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 rounded-lg border border-border px-2 py-2 text-sm outline-none focus:border-accent"
        />
      </label>
    );
  }
  const { min, max } = boundsFor(field, limits);
  return (
    <label className="flex items-center gap-1.5 text-xs text-neutral-500">
      {fieldLabel(field)}
      <input
        type="number"
        inputMode="decimal"
        min={min ?? 0}
        max={max}
        step={field.step ?? (field.kind === "float" ? 0.5 : 1)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          // Clamp op de (kader-)grenzen zodat het lid binnen de kaders blijft.
          const raw = e.target.value.trim();
          if (raw === "") return;
          let n = Number(raw.replace(",", "."));
          if (!Number.isFinite(n)) return;
          if (min != null && n < min) n = min;
          if (max != null && n > max) n = max;
          if (String(n) !== raw) onChange(String(n));
        }}
        className="w-20 rounded-lg border border-border px-2 py-2 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

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

function ItemCard({
  item,
  source,
  limits,
  dayKeys,
  currentDayKey,
  onChange,
  onRemove,
  onDuplicate,
  onCopyTo,
}: {
  item: EditorItem;
  source?: "standaard" | "eigen";
  limits: FrameworkLimits | null;
  dayKeys: { key: string; name: string }[];
  currentDayKey: string;
  onChange: (key: string, patch: Partial<EditorItem>) => void;
  onRemove: (key: string) => void;
  onDuplicate: (key: string) => void;
  onCopyTo: (itemKey: string, toDayKey: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  });
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
      className={`flex flex-col gap-2.5 rounded-2xl border border-border bg-surface-1 p-3 ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none px-1 text-lg text-neutral-400"
          aria-label="Versleep"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold text-neutral-900">
          {source ? <SourceBadge source={source} /> : null}
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${type.tone}`}
          >
            <TypeIcon className="size-3" /> {type.label}
          </span>
          <span className="truncate">{item.exerciseName}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-6">
        {type.targetFields.map((field) => (
          <ParamInput
            key={field.id}
            field={field}
            limits={limits}
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
        className="w-full rounded-lg border border-border bg-transparent px-2.5 py-2 text-xs text-neutral-700 outline-none focus:border-accent"
      />

      <div className="flex items-center gap-3 pl-6 text-xs text-neutral-500">
        <button type="button" onClick={() => onDuplicate(item.key)} className="hover:text-accent">
          Dupliceer
        </button>
        {otherDays.length > 0 ? (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) onCopyTo(item.key, e.target.value);
            }}
            className="rounded-md border border-border px-1 py-0.5 text-xs text-neutral-500"
            title="Kopieer naar dag"
          >
            <option value="">→ dag…</option>
            {otherDays.map((d) => (
              <option key={d.key} value={d.key}>
                {d.name}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          onClick={() => onRemove(item.key)}
          className="ml-auto text-neutral-400 hover:text-red-600"
        >
          Verwijder
        </button>
      </div>
    </div>
  );
}

function DayCard({
  day,
  index,
  totalDays,
  dayKeys,
  available,
  limits,
  favorites,
  onToggleFavorite,
  onRename,
  onNotesChange,
  onRemove,
  onAdd,
  onReorder,
  onItemChange,
  onItemRemove,
  onItemDuplicate,
  onCopyTo,
  onCopyPrevious,
  maxReached,
}: {
  day: EditorDay;
  index: number;
  totalDays: number;
  dayKeys: { key: string; name: string }[];
  available: AvailableExercise[];
  limits: FrameworkLimits | null;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  onRename: (dayKey: string, name: string) => void;
  onNotesChange: (dayKey: string, notes: string) => void;
  onRemove: (dayKey: string) => void;
  onAdd: (dayKey: string, ex: AvailableExercise) => void;
  onReorder: (dayKey: string, e: DragEndEvent) => void;
  onItemChange: (dayKey: string, itemKey: string, patch: Partial<EditorItem>) => void;
  onItemRemove: (dayKey: string, itemKey: string) => void;
  onItemDuplicate: (dayKey: string, itemKey: string) => void;
  onCopyTo: (fromDayKey: string, itemKey: string, toDayKey: string) => void;
  onCopyPrevious: (dayKey: string) => void;
  maxReached: boolean;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [query, setQuery] = useState("");

  // Alleen toegestane, niet-verborgen oefeningen in de picker.
  const allowed = useMemo(
    () => available.filter((e) => isExerciseAllowed(limits, e.id, e.exerciseType)),
    [available, limits]
  );
  const sourceById = useMemo(() => new Map(allowed.map((e) => [e.id, e.source])), [allowed]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return allowed
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) || (e.targetMuscle ?? "").toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [query, allowed]);

  const favoriteExercises = useMemo(
    () => allowed.filter((e) => favorites.has(e.id)).slice(0, 8),
    [allowed, favorites]
  );

  const perDayMax = limits?.maxExercisesPerDay ?? null;
  const dayFull = perDayMax != null && day.items.length >= perDayMax;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-0 p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-neutral-500">
          Dag {index + 1}
        </span>
        <input
          value={day.name}
          onChange={(e) => onRename(day.key, e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-base font-bold text-neutral-900 hover:border-border focus:border-accent focus:outline-none"
        />
        {totalDays > 1 ? (
          <button
            type="button"
            onClick={() => onRemove(day.key)}
            className="shrink-0 text-xs text-neutral-400 hover:text-red-600"
          >
            Verwijder
          </button>
        ) : null}
      </div>

      <input
        type="text"
        value={day.notes}
        onChange={(e) => onNotesChange(day.key, e.target.value)}
        placeholder="Notitie voor deze dag (optioneel)…"
        className="w-full rounded-lg border border-border bg-transparent px-2.5 py-2 text-xs text-neutral-700 outline-none focus:border-accent"
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e) => onReorder(day.key, e)}
      >
        <SortableContext items={day.items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2.5">
            {day.items.map((it) => (
              <ItemCard
                key={it.key}
                item={it}
                source={sourceById.get(it.exerciseId)}
                limits={limits}
                dayKeys={dayKeys}
                currentDayKey={day.key}
                onChange={(k, p) => onItemChange(day.key, k, p)}
                onRemove={(k) => onItemRemove(day.key, k)}
                onDuplicate={(k) => onItemDuplicate(day.key, k)}
                onCopyTo={(k, to) => onCopyTo(day.key, k, to)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {day.items.length === 0 ? (
        <p className="text-sm text-neutral-500">Nog geen oefeningen — zoek hieronder.</p>
      ) : null}

      {index > 0 ? (
        <button
          type="button"
          onClick={() => onCopyPrevious(day.key)}
          className="flex items-center gap-1.5 self-start rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-neutral-600 active:bg-surface-2"
        >
          <Copy className="size-3.5" /> Kopieer vorige dag
        </button>
      ) : null}

      {!dayFull && favoriteExercises.length > 0 && !query ? (
        <div className="flex flex-wrap gap-1.5">
          {favoriteExercises.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onAdd(day.key, e)}
              className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent active:opacity-80"
            >
              <Star className="size-3 fill-current" /> {e.name}
            </button>
          ))}
        </div>
      ) : null}

      {dayFull ? (
        <p className="text-xs text-amber-600">Maximaal {perDayMax} oefeningen voor deze dag.</p>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek een oefening om toe te voegen…"
            className="w-full rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-accent"
          />
          {matches.length > 0 ? (
            <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-border bg-surface-1 shadow-lg">
              {matches.map((e) => (
                <li key={e.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      onAdd(day.key, e);
                      setQuery("");
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm active:bg-neutral-50"
                  >
                    <SourceBadge source={e.source} />
                    <span className="truncate font-medium text-neutral-900">{e.name}</span>
                    {e.targetMuscle ? (
                      <span className="ml-auto shrink-0 text-xs text-neutral-400">
                        {e.targetMuscle}
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(e.id)}
                    aria-label="Favoriet"
                    className={`shrink-0 px-3 py-2.5 ${
                      favorites.has(e.id) ? "text-accent" : "text-neutral-300"
                    }`}
                  >
                    <Star className={`size-4 ${favorites.has(e.id) ? "fill-current" : ""}`} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function MemberSchemaEditor({
  assignmentId,
  status,
  mode,
  initialName,
  initialDescription,
  initialDays,
  availableExercises,
  limits,
  initialFavorites,
  reviewNote,
}: {
  assignmentId: string;
  status: MemberSchemaStatus;
  mode: MemberSchemaMode;
  initialName: string;
  initialDescription: string;
  initialDays: EditorDay[];
  availableExercises: AvailableExercise[];
  limits: FrameworkLimits | null;
  initialFavorites: string[];
  reviewNote: string | null;
}) {
  const [saveState, saveAction, saving] = useActionState<MemberSchemaSaveState, FormData>(
    saveMemberDraft,
    {}
  );
  const [submitState, submitFormAction, submitting] = useActionState<
    MemberSchemaSaveState,
    FormData
  >(submitMemberSchema, {});

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [days, setDays] = useState<EditorDay[]>(
    initialDays.length > 0
      ? initialDays
      : [{ key: `d-${dayCounter++}`, name: "Dag 1", notes: "", items: [] }]
  );
  const [favorites, setFavorites] = useState<Set<string>>(new Set(initialFavorites));
  const [, startFav] = useTransition();

  const saveFormRef = useRef<HTMLFormElement>(null);
  const mounted = useRef(false);

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

  // Autosave (debounce), zoals de owner-editor.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const t = setTimeout(() => {
      if (name.trim()) saveFormRef.current?.requestSubmit();
    }, 1200);
    return () => clearTimeout(t);
  }, [serialized, name, description]);

  const maxDays = limits?.maxDays ?? null;
  const maxReached = maxDays != null && days.length >= maxDays;
  const dayKeys = days.map((d) => ({ key: d.key, name: d.name.trim() || "Dag" }));
  const totalItems = days.reduce((n, d) => n + d.items.length, 0);
  const limitChips = describeLimits(limits);

  function updateDay(dayKey: string, fn: (d: EditorDay) => EditorDay) {
    setDays((prev) => prev.map((d) => (d.key === dayKey ? fn(d) : d)));
  }
  function addDay() {
    if (maxReached) return;
    setDays((prev) => [
      ...prev,
      { key: `d-${dayCounter++}`, name: `Dag ${prev.length + 1}`, notes: "", items: [] },
    ]);
  }
  function removeDay(dayKey: string) {
    setDays((prev) => (prev.length <= 1 ? prev : prev.filter((d) => d.key !== dayKey)));
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
    updateDay(dayKey, (d) => ({
      ...d,
      items: d.items.map((i) => (i.key === itemKey ? { ...i, ...p } : i)),
    }));
  }
  function removeItem(dayKey: string, itemKey: string) {
    updateDay(dayKey, (d) => ({ ...d, items: d.items.filter((i) => i.key !== itemKey) }));
  }
  function duplicateItem(dayKey: string, itemKey: string) {
    updateDay(dayKey, (d) => {
      const src = d.items.find((i) => i.key === itemKey);
      if (!src) return d;
      const idx = d.items.findIndex((i) => i.key === itemKey);
      const clone = { ...src, key: `i-${itemCounter++}`, values: { ...src.values } };
      const next = [...d.items];
      next.splice(idx + 1, 0, clone);
      return { ...d, items: next };
    });
  }
  function copyItemToDay(fromDayKey: string, itemKey: string, toDayKey: string) {
    setDays((prev) => {
      const item = prev.find((d) => d.key === fromDayKey)?.items.find((i) => i.key === itemKey);
      if (!item) return prev;
      const clone = { ...item, key: `i-${itemCounter++}`, values: { ...item.values } };
      return prev.map((d) => (d.key === toDayKey ? { ...d, items: [...d.items, clone] } : d));
    });
  }
  function copyPreviousDay(dayKey: string) {
    setDays((prev) => {
      const idx = prev.findIndex((d) => d.key === dayKey);
      if (idx <= 0) return prev;
      const source = prev[idx - 1];
      const clonedItems = source.items.map((i) => ({
        ...i,
        key: `i-${itemCounter++}`,
        values: { ...i.values },
      }));
      return prev.map((d) => (d.key === dayKey ? { ...d, items: clonedItems } : d));
    });
  }
  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      startFav(() => {
        void setFavoriteExercises([...next]);
      });
      return next;
    });
  }

  const submitLabel =
    mode === "DIRECT" ? "Direct gebruiken" : "Indienen ter controle";
  const violations = submitState.violations ?? saveState.violations ?? [];

  return (
    <div className="flex flex-col gap-5 px-5 py-6">
      {/* Verborgen autosave-form */}
      <form ref={saveFormRef} action={saveAction} className="hidden">
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="description" value={description} />
        <input type="hidden" name="days" value={serialized} />
      </form>

      <div className="flex flex-col gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Naam van je schema"
          className="rounded-xl border border-border px-3 py-2.5 text-lg font-bold text-neutral-900 outline-none focus:border-accent"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Korte beschrijving (optioneel)…"
          className="rounded-xl border border-border px-3 py-2 text-sm text-neutral-700 outline-none focus:border-accent"
        />
      </div>

      {reviewNote && status === "REJECTED" ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
            Feedback van je coach
          </p>
          <p className="mt-1 text-sm text-neutral-700">{reviewNote}</p>
        </div>
      ) : null}

      {limitChips.length > 0 ? (
        <div className="rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Kaders van je sportschool
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {limitChips.map((c) => (
              <span
                key={c}
                className="rounded-full bg-surface-1 px-2.5 py-1 text-xs font-medium text-neutral-600"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Voortgangsindicator */}
      <div className="flex items-center gap-3 rounded-2xl bg-surface-1 px-4 py-3 text-sm text-neutral-600">
        <span className="font-semibold text-neutral-900">{days.length}</span> dagen
        <span className="text-neutral-300">·</span>
        <span className="font-semibold text-neutral-900">{totalItems}</span> oefeningen
        <span className="ml-auto text-xs" aria-live="polite">
          {saving ? "Opslaan…" : saveState.ok ? "Opgeslagen ✓" : "Wijzigingen worden opgeslagen"}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {days.map((d, i) => (
          <DayCard
            key={d.key}
            day={d}
            index={i}
            totalDays={days.length}
            dayKeys={dayKeys}
            available={availableExercises}
            limits={limits}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            onRename={(k, n) => updateDay(k, (day) => ({ ...day, name: n }))}
            onNotesChange={(k, n) => updateDay(k, (day) => ({ ...day, notes: n }))}
            onRemove={removeDay}
            onAdd={addItem}
            onReorder={reorder}
            onItemChange={patchItem}
            onItemRemove={removeItem}
            onItemDuplicate={duplicateItem}
            onCopyTo={copyItemToDay}
            onCopyPrevious={copyPreviousDay}
            maxReached={maxReached}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={addDay}
        disabled={maxReached}
        className="flex items-center justify-center gap-1.5 rounded-xl border border-border-strong px-4 py-2.5 text-sm font-semibold text-neutral-900 active:bg-surface-2 disabled:opacity-40"
      >
        <Plus className="size-4" /> Dag toevoegen
        {maxReached ? ` (max ${maxDays})` : ""}
      </button>

      {/* Live voorbeeld */}
      {totalItems > 0 ? (
        <details className="rounded-2xl border border-border bg-surface-1 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-900">
            Voorbeeld — zo ziet je schema eruit
          </summary>
          <div className="mt-3 flex flex-col gap-4">
            {days.map((d) => (
              <div key={d.key} className="flex flex-col gap-1.5">
                <p className="text-sm font-semibold text-neutral-900">{d.name || "Dag"}</p>
                <ul className="flex flex-col gap-1">
                  {d.items.map((it) => {
                    const meta = exerciseById.get(it.exerciseId);
                    const summary = summaryFromInputValues(it.exerciseType, it.values);
                    return (
                      <li
                        key={it.key}
                        className="flex items-center gap-2 rounded-lg bg-surface-0 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-neutral-900">
                            {it.exerciseName}
                          </span>
                          <span className="block text-xs text-neutral-500">
                            {exerciseTypeLabel(it.exerciseType)}
                            {summary && summary !== "—" ? ` · ${summary}` : ""}
                            {meta?.machineName ? ` · ${meta.machineName}` : ""}
                          </span>
                        </span>
                        <Link
                          href={`/member/schema`}
                          className="shrink-0 text-neutral-300"
                          aria-hidden
                        >
                          <Info className="size-4" />
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
        </details>
      ) : null}

      {violations.length > 0 ? (
        <ul className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {violations.map((v) => (
            <li key={v}>• {v}</li>
          ))}
        </ul>
      ) : submitState.error ? (
        <p className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitState.error}
        </p>
      ) : null}

      {/* Indienen / direct gebruiken */}
      <form action={submitFormAction} className="sticky bottom-20 z-10">
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="description" value={description} />
        <input type="hidden" name="days" value={serialized} />
        <button
          type="submit"
          disabled={submitting || totalItems === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-gradient px-6 py-4 text-center text-base font-bold text-accent-foreground shadow-accent transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? "Bezig…" : submitLabel}
        </button>
      </form>
      <p className="-mt-2 text-center text-xs text-neutral-400">
        {mode === "DIRECT"
          ? "Je schema wordt direct actief. Je sportschool kan meekijken."
          : "Je coach controleert je schema voordat het actief wordt."}
      </p>
    </div>
  );
}
