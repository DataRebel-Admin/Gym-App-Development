"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
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

/** Pure presentatie van één widget — gedeeld door de sorteerbare kaart en de sleep-overlay. */
function WidgetShell({
  id,
  body,
  editing,
  visible,
  onToggle,
  className,
  style,
  dragHandle,
}: {
  id: WidgetId;
  body: ReactNode;
  editing: boolean;
  visible: boolean;
  onToggle?: () => void;
  className?: string;
  style?: React.CSSProperties;
  dragHandle?: ReactNode;
}) {
  const meta = WIDGET_META[id];
  return (
    <div
      style={style}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-surface-1 p-5 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {editing ? dragHandle : null}
          <h2 className="text-sm font-semibold text-neutral-900">{meta.title}</h2>
        </div>
        {editing && onToggle ? (
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
    </div>
  );
}

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

  // Volle-breedte-widgets vullen de hele rij; een zijwaartse reorder-transform
  // laat ze lelijk opzij schuiven. Nul de x-component zodat ze alléén
  // omhoog/omlaag bewegen. Halve-breedte houden hun normale gedrag.
  const resolvedTransform =
    meta.span === 2 && transform ? { ...transform, x: 0 } : transform;

  return (
    <m.section
      ref={setNodeRef}
      // `layout` uit tijdens het slepen: motion zou de layout van de gesleepte kaart
      // opnieuw projecteren en zo een halve kaart naar volle breedte rekken.
      layout={!isDragging}
      style={{
        transform: CSS.Transform.toString(resolvedTransform),
        transition,
      }}
      className={cn(meta.span === 2 ? "lg:col-span-2" : "")}
    >
      <WidgetShell
        id={id}
        body={body}
        editing={editing}
        visible={visible}
        onToggle={onToggle}
        className={cn(
          // Terwijl de kaart zweeft in de overlay laten we hier alleen een lege plek staan.
          isDragging ? "opacity-40" : "border-border",
          editing && !visible ? "opacity-50" : ""
        )}
        dragHandle={
          <button
            type="button"
            className="cursor-grab text-neutral-400 hover:text-neutral-700"
            aria-label="Versleep widget"
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
        }
      />
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
  const [activeId, setActiveId] = useState<WidgetId | null>(null);
  const [activeSize, setActiveSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function onDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as WidgetId);
    // Meet de bronkaart zodat de sleep-preview exact dezelfde afmeting houdt
    // (voorkomt dat recharts hermeet en de kaart groter/breder lijkt).
    const rect = e.active.rect.current.initial;
    if (rect) setActiveSize({ width: rect.width, height: rect.height });
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    setActiveSize(null);
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
  const activeWidget = activeId
    ? shown.find((w) => w.id === activeId)
    : undefined;

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
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setActiveId(null);
          setActiveSize(null);
        }}
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

        <DragOverlay>
          {activeWidget ? (
            <WidgetShell
              id={activeWidget.id}
              body={nodes[activeWidget.id]}
              editing={editing}
              visible={activeWidget.visible}
              className="overflow-hidden border-accent shadow-lg"
              style={
                activeSize
                  ? { width: activeSize.width, height: activeSize.height }
                  : undefined
              }
              dragHandle={
                <span className="cursor-grabbing text-neutral-400">⠿</span>
              }
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
