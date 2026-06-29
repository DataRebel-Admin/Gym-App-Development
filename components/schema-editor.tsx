"use client";

import { useActionState, useRef, useState } from "react";
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
};

export type AvailableExercise = {
  id: string;
  name: string;
  targetMuscle: string | null;
};

const numClass =
  "w-16 rounded-md border border-neutral-200 px-2 py-1 text-sm outline-none focus:border-accent";

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
      className={`flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 ${
        isDragging ? "opacity-60" : ""
      }`}
    >
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
        <input
          type="number"
          min={1}
          value={item.sets}
          onChange={(e) => onChange(item.key, { sets: Number(e.target.value) })}
          className={numClass}
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-neutral-500">
        reps
        <input
          type="number"
          min={1}
          value={item.reps}
          onChange={(e) => onChange(item.key, { reps: Number(e.target.value) })}
          className={numClass}
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-neutral-500">
        rust(s)
        <input
          type="number"
          min={0}
          value={item.restSeconds}
          onChange={(e) =>
            onChange(item.key, { restSeconds: Number(e.target.value) })
          }
          className={numClass}
        />
      </label>
      <button
        type="button"
        onClick={() => onRemove(item.key)}
        className="text-neutral-400 hover:text-red-600"
        aria-label="Verwijder"
      >
        ✕
      </button>
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
  const [state, formAction, pending] = useActionState<SchemaSaveState, FormData>(
    saveSchema,
    {}
  );
  const [items, setItems] = useState<EditorItem[]>(initialItems);
  const [picked, setPicked] = useState("");
  const counter = useRef(0);

  const sensors = useSensors(useSensor(PointerSensor));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const from = prev.findIndex((i) => i.key === active.id);
      const to = prev.findIndex((i) => i.key === over.id);
      return arrayMove(prev, from, to);
    });
  }

  function addExercise() {
    const ex = availableExercises.find((e) => e.id === picked);
    if (!ex) return;
    setItems((prev) => [
      ...prev,
      {
        key: `new-${counter.current++}`,
        exerciseId: ex.id,
        exerciseName: ex.name,
        sets: 3,
        reps: 10,
        restSeconds: 60,
      },
    ]);
    setPicked("");
  }

  function patch(key: string, p: Partial<EditorItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...p } : i)));
  }
  function remove(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  const serialized = JSON.stringify(
    items.map((i) => ({
      exerciseId: i.exerciseId,
      sets: i.sets,
      reps: i.reps,
      restSeconds: i.restSeconds,
    }))
  );

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-5">
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="items" value={serialized} />

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Naam *
        <input
          name="name"
          required
          defaultValue={initialName}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-neutral-700">
        Beschrijving
        <textarea
          name="description"
          rows={2}
          defaultValue={initialDescription}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-neutral-700">Oefeningen</span>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.key)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2">
              {items.map((it) => (
                <SortableRow
                  key={it.key}
                  item={it}
                  onChange={patch}
                  onRemove={remove}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {items.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nog geen oefeningen — voeg er hieronder een toe.
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <select
          value={picked}
          onChange={(e) => setPicked(e.target.value)}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-accent"
        >
          <option value="">Kies oefening…</option>
          {availableExercises.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.targetMuscle ? ` — ${e.targetMuscle}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addExercise}
          disabled={!picked}
          className="rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-50"
        >
          + Toevoegen
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Opslaan…" : "Schema opslaan"}
        </button>
        {state.ok ? (
          <span className="text-sm text-green-600">Opgeslagen ✓</span>
        ) : null}
        {state.error ? (
          <span className="text-sm text-red-600">{state.error}</span>
        ) : null}
      </div>
    </form>
  );
}
