import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant";
import { requirePermission } from "@/lib/staff";
import { listCoachNotes } from "@/lib/coach-notes";
import { Card } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button-classes";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { MemberProfileTabs } from "@/components/members/profile-tabs";
import {
  addCoachNote,
  updateCoachNote,
  toggleCoachNotePin,
  deleteCoachNote,
} from "./actions";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const tenant = await getCurrentTenant();
  const member = tenant
    ? await prisma.user.findFirst({
        where: { id: userId, tenantId: tenant.id },
        select: { name: true, email: true },
      })
    : null;
  const label = member?.name ?? member?.email ?? "Lid";
  return { title: `${label} | Coachnotities` };
}

export default async function MemberNotesPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const me = await requirePermission("coachnotes:manage");
  const { userId } = await params;

  const member = await prisma.user.findFirst({
    where: { id: userId, tenantId: me.tenantId },
    select: { id: true, email: true, name: true },
  });
  if (!member) notFound();

  const notes = await listCoachNotes(me.tenantId, member.id);
  const label = member.name ?? member.email;

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <Link href="/owner/members" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Leden
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{label}</h1>
        <p className="mt-1 text-sm text-neutral-500">Coachnotities</p>
      </div>

      <MemberProfileTabs
        userId={member.id}
        active="notes"
        canMeasure={me.permissions.has("measurements:manage")}
        canNotes
      />

      {/* Nieuwe notitie */}
      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-sm font-semibold text-neutral-900">Nieuwe coachnotitie</h2>
        <form action={addCoachNote} className="flex flex-col gap-3">
          <input type="hidden" name="memberId" value={member.id} />
          <Field label="Notitie">
            <Textarea name="body" rows={3} required placeholder="Observatie, doel of aandachtspunt…" />
          </Field>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-neutral-600">
              <input type="checkbox" name="pinned" /> Vastpinnen
            </label>
            <button type="submit" className={buttonClasses({ size: "md" })}>
              Notitie opslaan
            </button>
          </div>
        </form>
      </Card>

      {/* Notities */}
      {notes.length === 0 ? (
        <Card className="p-8 text-center text-sm text-neutral-500">
          Nog geen coachnotities voor dit lid.
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map((n) => (
            <Card key={n.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  {n.pinned ? <Badge tone="accent">📌 Vastgepind</Badge> : null}
                  <span>{n.authorName ?? n.authorEmail}</span>
                  <span aria-hidden>·</span>
                  <span>{DATE_FMT.format(n.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <form action={toggleCoachNotePin}>
                    <input type="hidden" name="noteId" value={n.id} />
                    <input type="hidden" name="memberId" value={member.id} />
                    <input type="hidden" name="pinned" value={n.pinned ? "false" : "true"} />
                    <button type="submit" className="rounded-lg border border-border-strong px-2 py-1 text-xs hover:bg-neutral-50">
                      {n.pinned ? "Losmaken" : "Vastpinnen"}
                    </button>
                  </form>
                  <ConfirmButton
                    action={deleteCoachNote}
                    fields={{ noteId: n.id, memberId: member.id }}
                    label="Verwijder"
                    triggerClassName="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    title="Notitie verwijderen?"
                    message="Weet je zeker dat je deze coachnotitie wilt verwijderen?"
                  />
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm text-neutral-800">{n.body}</p>
              <details className="text-sm">
                <summary className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-900">
                  Bewerken
                </summary>
                <form action={updateCoachNote} className="mt-2 flex flex-col gap-2">
                  <input type="hidden" name="noteId" value={n.id} />
                  <input type="hidden" name="memberId" value={member.id} />
                  <Textarea name="body" rows={3} defaultValue={n.body} required />
                  <div className="flex justify-end">
                    <button type="submit" className={buttonClasses({ variant: "secondary", size: "sm" })}>
                      Opslaan
                    </button>
                  </div>
                </form>
              </details>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
