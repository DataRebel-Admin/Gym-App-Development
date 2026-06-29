"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { m } from "motion/react";
import {
  WIDGET_META,
  type DashboardLayout,
  type WidgetId,
} from "@/lib/dashboard";
import { saveDashboardLayout } from "@/app/owner/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

type Nodes = Partial<Record<WidgetId, ReactNode>>;

function WidgetCard({
  id,
  body,
  editing,
  visible,
  onToggle,
}: {
  id: WidgetId;
  body: ReactNode;
  editing: boolean;
  visible: boolean;
  onToggle: () => void;
}) {
  const meta = WIDGET_META[id];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled: !editing });

  return (
    <m.section
      ref={setNodeRef}
      layout
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-surface-1 p-5 shadow-sm",
        meta.span === 2 ? "lg:col-span-2" : "",
        isDragging ? "z-10 border-accent shadow-lg" : "border-border",
        editing && !visible ? "opacity-50" : ""
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {editing ? (
            <button
              type="button"
              className="cursor-grab text-neutral-400 hover:text-neutral-700"
              aria-label="Versleep widget"
              {...attributes}
              {...listeners}
            >
              ⠿
            </button>
          ) : null}
          <h2 className="text-sm font-semibold text-neutral-900">{meta.title}</h2>
        </div>
        {editing ? (
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg px-2 py-1 text-xs font-medium text-neutral-500 transition-colors hover:bg-neutral-100"
          >
            {visible ? "Verbergen" : "Tonen"}
          </button>
        ) : null}
      </div>
      {visible || editing ? body : null}
    </m.section>
  );
}

export function WidgetGrid({
  nodes,
  initialLayout,
}: {
  nodes: Nodes;
  initialLayout: DashboardLayout;
}) {
  const [widgets, setWidgets] = useState(initialLayout.widgets);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setWidgets((prev) => {
      const from = prev.findIndex((w) => w.id === active.id);
      const to = prev.findIndex((w) => w.id === over.id);
      return arrayMove(prev, from, to);
    });
  }

  function toggle(id: WidgetId) {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  }

  function save() {
    startTransition(async () => {
      const res = await saveDashboardLayout({ widgets });
      if (res.ok) {
        toast.success("Dashboard-indeling opgeslagen");
        setEditing(false);
      } else {
        toast.error("Opslaan mislukt");
      }
    });
  }

  const shown = editing ? widgets : widgets.filter((w) => w.visible);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-2">
        {editing ? (
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Annuleren
            </Button>
            <Button size="sm" loading={pending} onClick={save}>
              Indeling opslaan
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Dashboard aanpassen
          </Button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={shown.map((w) => w.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {shown.map((w) => (
              <WidgetCard
                key={w.id}
                id={w.id}
                body={nodes[w.id]}
                editing={editing}
                visible={w.visible}
                onToggle={() => toggle(w.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
