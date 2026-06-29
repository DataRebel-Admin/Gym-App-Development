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

export type EditorItem = {
  key: string;
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: number;
  restSeconds: number;
  weightKg: number | null;
  notes: string;
};

export type EditorDay = {
  key: string;
  name: string;
  items: EditorItem[];
};

export type AvailableExercise = {
  id: string;
  name: string;
  targetMuscle: string | null;
};

const numClass =
  "w-14 rounded-md border border-border px-2 py-1 text-sm outline-none focus:border-accent";

function SortableRow({
  item,
  dayKeys,
  currentDayKey,
  onChange,
  onRemove,
  onCopyTo,
}: {
  item: EditorItem;
  dayKeys: { key: string; name: string }[];
  currentDayKey: string;
  onChange: (key: string, patch: Partial<EditorItem>) => void;
  onRemove: (key: string) => void;
  onCopyTo: (itemKey: string, toDayKey: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.key });
  const otherDays = dayKeys.filter((d) => d.key !== currentDayKey);

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
        <span className="flex-1 text-sm font-medium text-neutral-900">{item.exerciseName}</span>
        <label className="flex items-center gap-1 text-xs text-neutral-500">sets
          <input type="number" min={1} value={item.sets} onChange={(e) => onChange(item.key, { sets: Number(e.target.value) })} className={numClass} />
        </label>
        <label className="flex items-center gap-1 text-xs text-neutral-500">reps
          <input type="number" min={1} value={item.reps} onChange={(e) => onChange(item.key, { reps: Number(e.target.value) })} className={numClass} />
        </label>
        <label className="flex items-center gap-1 text-xs text-neutral-500">kg
          <input type="number" min={0} step={0.5} value={item.weightKg ?? ""} onChange={(e) => onChange(item.key, { weightKg: e.target.value === "" ? null : Number(e.target.value) })} className={numClass} />
        </label>
        <label className="flex items-center gap-1 text-xs text-neutral-500">rust
          <input type="number" min={0} value={item.restSeconds} onChange={(e) => onChange(item.key, { restSeconds: Number(e.target.value) })} className={numClass} />
        </label>
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
  onRemove: (dayKey: string) => void;
  onAdd: (dayKey: string, ex: AvailableExercise) => void;
  onReorder: (dayKey: string, e: DragEndEvent) => void;
  onItemChange: (dayKey: string, itemKey: string, patch: Partial<EditorItem>) => void;
  onItemRemove: (dayKey: string, itemKey: string) => void;
  onCopyTo: (fromDayKey: string, itemKey: string, toDayKey: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor));
  const [query, setQuery] = useState("");

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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onReorder(day.key, e)}>
        <SortableContext items={day.items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {day.items.map((it) => (
              <SortableRow
                key={it.key}
                item={it}
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
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50"
                >
                  <span className="font-medium text-neutral-900">{e.name}</span>
                  {e.targetMuscle ? <span className="text-xs text-neutral-400">{e.targetMuscle}</span> : null}
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
  initialDays,
  availableExercises,
}: {
  templateId: string;
  initialName: string;
  initialDescription: string;
  initialDays: EditorDay[];
  availableExercises: AvailableExercise[];
}) {
  const [state, formAction, pending] = useActionState<SchemaSaveState, FormData>(saveSchema, {});
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [days, setDays] = useState<EditorDay[]>(
    initialDays.length > 0 ? initialDays : [{ key: `d-${dayCounter++}`, name: "Dag 1", items: [] }]
  );
  const formRef = useRef<HTMLFormElement>(null);
  const mounted = useRef(false);

  const serialized = useMemo(
    () =>
      JSON.stringify(
        days.map((d) => ({
          name: d.name.trim() || "Dag",
          items: d.items.map((i) => ({
            exerciseId: i.exerciseId,
            sets: i.sets,
            reps: i.reps,
            restSeconds: i.restSeconds,
            weightKg: i.weightKg,
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
  }, [serialized, name, description]);

  const dayKeys = days.map((d) => ({ key: d.key, name: d.name.trim() || "Dag" }));

  function updateDay(dayKey: string, fn: (d: EditorDay) => EditorDay) {
    setDays((prev) => prev.map((d) => (d.key === dayKey ? fn(d) : d)));
  }

  function addDay() {
    setDays((prev) => [...prev, { key: `d-${dayCounter++}`, name: `Dag ${prev.length + 1}`, items: [] }]);
  }
  function removeDay(dayKey: string) {
    setDays((prev) => (prev.length <= 1 ? prev : prev.filter((d) => d.key !== dayKey)));
  }
  function renameDay(dayKey: string, name: string) {
    updateDay(dayKey, (d) => ({ ...d, name }));
  }
  function addItem(dayKey: string, ex: AvailableExercise) {
    updateDay(dayKey, (d) => ({
      ...d,
      items: [...d.items, { key: `i-${itemCounter++}`, exerciseId: ex.id, exerciseName: ex.name, sets: 3, reps: 10, restSeconds: 60, weightKg: null, notes: "" }],
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

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Naam *
          <input name="name" required value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Beschrijving
          <textarea name="description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent" />
        </label>

        <div className="flex flex-col gap-3">
          {days.map((d, i) => (
            <DayCard
              key={d.key}
              day={d}
              index={i}
              dayKeys={dayKeys}
              availableExercises={availableExercises}
              onRename={renameDay}
              onRemove={removeDay}
              onAdd={addItem}
              onReorder={reorder}
              onItemChange={patchItem}
              onItemRemove={removeItem}
              onCopyTo={copyItemToDay}
            />
          ))}
        </div>

        <button type="button" onClick={addDay} className="self-start rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50">
          + Dag toevoegen
        </button>

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
        <h3 className="mt-1 text-lg font-semibold text-neutral-900">{name || "Naamloos schema"}</h3>
        {description ? <p className="mt-1 text-sm text-neutral-500">{description}</p> : null}
        <div className="mt-4 flex flex-col gap-4">
          {days.map((d) => (
            <div key={d.key}>
              <p className="text-sm font-semibold text-neutral-900">{d.name || "Dag"}</p>
              <ol className="mt-1 flex flex-col gap-1">
                {d.items.map((it, idx) => (
                  <li key={it.key} className="flex gap-2 text-sm">
                    <span className="text-neutral-400">{idx + 1}.</span>
                    <span className="flex-1">
                      <span className="font-medium text-neutral-900">{it.exerciseName}</span>
                      <span className="block text-xs text-neutral-500">
                        {it.sets} × {it.reps}{it.weightKg ? ` @ ${it.weightKg} kg` : ""} · {it.restSeconds}s
                      </span>
                    </span>
                  </li>
                ))}
                {d.items.length === 0 ? <li className="text-xs text-neutral-400">Leeg.</li> : null}
              </ol>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
