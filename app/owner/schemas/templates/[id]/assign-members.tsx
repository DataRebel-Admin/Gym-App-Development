"use client";

import { useState } from "react";
import { assignTemplateToMembers } from "../../actions";
import { Button } from "@/components/ui/button";

type Member = { id: string; name: string | null; email: string };

export function AssignMembersForm({
  templateId,
  members,
}: {
  templateId: string;
  members: Member[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setDone(false);
  }

  if (members.length === 0) {
    return <p className="text-sm text-neutral-500">Nog geen leden om aan toe te wijzen.</p>;
  }

  return (
    <form
      action={async (fd) => {
        await assignTemplateToMembers(fd);
        setDone(true);
        setSelected(new Set());
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="sourceTemplateId" value={templateId} />
      <div className="max-h-56 overflow-auto rounded-lg border border-border">
        {members.map((m) => (
          <label key={m.id} className="flex cursor-pointer items-center gap-3 border-b border-neutral-100 px-3 py-2 text-sm last:border-0 hover:bg-neutral-50">
            <input
              type="checkbox"
              name="userIds"
              value={m.id}
              checked={selected.has(m.id)}
              onChange={() => toggle(m.id)}
            />
            <span className="text-neutral-900">{m.name ?? m.email}</span>
            <span className="ml-auto text-xs text-neutral-400">{m.email}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={selected.size === 0}>
          Toewijzen aan {selected.size || ""} {selected.size === 1 ? "lid" : "leden"}
        </Button>
        {done ? <span className="text-sm text-green-600">Toegewezen ✓</span> : null}
      </div>
      <p className="text-xs text-neutral-400">
        Let op: dit vervangt het huidige schema van de geselecteerde leden.
      </p>
    </form>
  );
}
