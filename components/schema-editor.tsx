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

export type AvailableExercise = {
  id: string;
  name: string;
  targetMuscle: string | null;
};

const numClass =
  "w-14 rounded-md border border-border px-2 py-1 text-sm outline-none focus:border-accent";

function SortableRow({
  item,
  onChange,
  onRemove,
}: {
  item: EditorItem;
  onChange: (key: string, patch: Partial<EditorItem>) => void;
  onRemove: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.key });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2 ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="cursor-grab text-neutral-400 hover:text-neutral-700"
          aria-label="Versleep"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <span className="flex-1 text-sm font-medium text-neutral-900">
          {item.exerciseName}
        </span>
        <label className="flex items-center gap-1 text-xs text-neutral-500">
          sets
          <input type="number" min={1} value={item.sets} onChange={(e) => onChange(item.key, { sets: Number(e.target.value) })} className={numClass} />
        </label>
        <label className="flex items-center gap-1 text-xs text-neutral-500">
          reps
          <input type="number" min={1} value={item.reps} onChange={(e) => onChange(item.key, { reps: Number(e.target.value) })} className={numClass} />
        </label>
        <label className="flex items-center gap-1 text-xs text-neutral-500">
          kg
          <input
            type="number"
            min={0}
            step={0.5}
            value={item.weightKg ?? ""}
            onChange={(e) =>
              onChange(item.key, {
                weightKg: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className={numClass}
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-neutral-500">
          rust
          <input type="number" min={0} value={item.restSeconds} onChange={(e) => onChange(item.key, { restSeconds: Number(e.target.value) })} className={numClass} />
        </label>
        <button type="button" onClick={() => onRemove(item.key)} className="text-neutral-400 hover:text-red-600" aria-label="Verwijder">
          ✕
        </button>
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

export function SchemaEditor({
  templateId,
  initialName,
  initialDescription,
  initialItems,
  availableExercises,
}: {
  templateId: string;
  initialName: string;
  initialDescription: string;
  initialItems: EditorItem[];
  availableExercises: AvailableExercise[];
}) {
  const [state, formAction, pending] = useActionState<SchemaSaveState, FormData>(saveSchema, {});
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [items, setItems] = useState<EditorItem[]>(initialItems);
  const [query, setQuery] = useState("");
  const counter = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const mounted = useRef(false);

  const sensors = useSensors(useSensor(PointerSensor));

  const serialized = useMemo(
    () =>
      JSON.stringify(
        items.map((i) => ({
          exerciseId: i.exerciseId,
          sets: i.sets,
          reps: i.reps,
          restSeconds: i.restSeconds,
          weightKg: i.weightKg,
          notes: i.notes,
        }))
      ),
    [items]
  );

  // Autosave: debounce 1.2s na elke wijziging (naam/beschrijving/oefeningen).
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

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.key === active.id);
      const to = prev.findIndex((i) => i.key === over.id);
      return arrayMove(prev, from, to);
    });
  }

  function addExercise(ex: AvailableExercise) {
    setItems((prev) => [
      ...prev,
      {
        key: `new-${counter.current++}`,
        exerciseId: ex.id,
        exerciseName: ex.name,
        sets: 3,
        reps: 10,
        restSeconds: 60,
        weightKg: null,
        notes: "",
      },
    ]);
    setQuery("");
  }

  function patch(key: string, p: Partial<EditorItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)));
  }
  function remove(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return availableExercises
      .filter((e) => e.name.toLowerCase().includes(q) || (e.targetMuscle ?? "").toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, availableExercises]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <form ref={formRef} action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="templateId" value={templateId} />
        <input type="hidden" name="items" value={serialized} />

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Naam *
          <input
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-neutral-700">
          Beschrijving
          <textarea
            name="description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-neutral-700">Oefeningen</span>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {items.map((it) => (
                  <SortableRow key={it.key} item={it} onChange={patch} onRemove={remove} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {items.length === 0 ? (
            <p className="text-sm text-neutral-500">Nog geen oefeningen — zoek hieronder.</p>
          ) : null}
        </div>

        {/* Zoekfunctie: typ om te filteren, klik om toe te voegen */}
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
                    onClick={() => addExercise(e)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-50"
                  >
                    <span className="font-medium text-neutral-900">{e.name}</span>
                    {e.targetMuscle ? (
                      <span className="text-xs text-neutral-400">{e.targetMuscle}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Opslaan…" : "Nu opslaan"}
          </button>
          <span className="text-sm text-neutral-500" aria-live="polite">
            {pending ? "Bezig met opslaan…" : state.ok ? "Automatisch opgeslagen ✓" : "Wijzigingen worden automatisch opgeslagen"}
          </span>
          {state.error ? <span className="text-sm text-red-600">{state.error}</span> : null}
        </div>
      </form>

      {/* Live preview */}
      <aside className="h-fit rounded-2xl border border-border bg-surface-1 p-5 lg:sticky lg:top-6">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Live voorbeeld</p>
        <h3 className="mt-1 text-lg font-semibold text-neutral-900">{name || "Naamloos schema"}</h3>
        {description ? <p className="mt-1 text-sm text-neutral-500">{description}</p> : null}
        <ol className="mt-4 flex flex-col gap-2">
          {items.map((it, idx) => (
            <li key={it.key} className="flex gap-2 text-sm">
              <span className="text-neutral-400">{idx + 1}.</span>
              <span className="flex-1">
                <span className="font-medium text-neutral-900">{it.exerciseName}</span>
                <span className="block text-xs text-neutral-500">
                  {it.sets} × {it.reps}
                  {it.weightKg ? ` @ ${it.weightKg} kg` : ""} · {it.restSeconds}s rust
                </span>
                {it.notes ? <span className="block text-xs italic text-neutral-400">{it.notes}</span> : null}
              </span>
            </li>
          ))}
          {items.length === 0 ? <li className="text-sm text-neutral-400">Nog leeg.</li> : null}
        </ol>
      </aside>
    </div>
  );
}
