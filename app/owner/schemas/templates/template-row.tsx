"use client";

import { useRouter } from "next/navigation";
import type { WorkoutTemplate } from "@prisma/client";
import { duplicateTemplate } from "../actions";
import { GoalBadge } from "@/components/schema/goal-badge";
import { SchemaBadges } from "@/components/schema/schema-badges";
import { SchemaCover } from "@/components/schema/schema-cover";
import type { SchemaImage } from "@/lib/schema-image";

type TemplateRow = WorkoutTemplate & { _count: { items: number } };

export function TemplateRow({
  template,
  image,
}: {
  template: TemplateRow;
  image: SchemaImage | null;
}) {
  const router = useRouter();
  const href = `/owner/schemas/templates/${template.id}`;

  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          router.push(href);
        }
      }}
      className="cursor-pointer border-t border-neutral-100 hover:bg-neutral-50 focus:bg-neutral-50 focus:outline-none"
    >
      <td className="px-4 py-2 font-medium text-neutral-900">
        <div className="flex items-center gap-3">
          <SchemaCover
            image={image}
            alt={template.name}
            aspect={false}
            className="h-10 w-15 shrink-0 rounded-lg"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span>{template.name}</span>
            <GoalBadge goal={template.goal} size="xs" />
            <SchemaBadges badges={template.badges} size="xs" max={3} />
          </div>
        </div>
      </td>
      <td className="px-4 py-2 text-neutral-700">{template._count.items}</td>
      <td className="px-4 py-2">
        <div className="flex items-center justify-end gap-3">
          <form action={duplicateTemplate} onClick={(e) => e.stopPropagation()}>
            <input type="hidden" name="id" value={template.id} />
            <button type="submit" className="text-neutral-500 hover:text-neutral-900">
              Dupliceren
            </button>
          </form>
          <span className="text-accent hover:underline">Bewerken</span>
        </div>
      </td>
    </tr>
  );
}
