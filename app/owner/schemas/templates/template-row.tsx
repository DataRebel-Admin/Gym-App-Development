"use client";

import { useRouter } from "next/navigation";
import type { WorkoutTemplate } from "@prisma/client";
import { duplicateTemplate } from "../actions";

type TemplateRow = WorkoutTemplate & { _count: { items: number } };

export function TemplateRow({ template }: { template: TemplateRow }) {
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
      <td className="px-4 py-2 font-medium text-neutral-900">{template.name}</td>
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
