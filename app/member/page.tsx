import Link from "next/link";
import { requireMember, getAssignedSchema } from "@/lib/member";

export default async function MemberHome() {
  const member = await requireMember();
  const assignment = await getAssignedSchema(member.id, member.tenantId);
  const schema = assignment?.template;

  return (
    <div className="flex flex-1 flex-col gap-6 px-5 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          Hoi {member.name ?? "sporter"} 👋
        </h1>
        <p className="mt-1 text-neutral-500">Klaar voor je training?</p>
      </div>

      <div className="rounded-2xl border border-neutral-200 p-5">
        <p className="text-xs uppercase tracking-wide text-neutral-500">
          Jouw schema
        </p>
        {schema ? (
          <>
            <p className="mt-1 text-lg font-semibold text-neutral-900">
              {schema.name}
            </p>
            <p className="text-sm text-neutral-500">
              {schema.items.length} oefeningen
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-neutral-500">
            Nog geen schema toegewezen. Vraag je trainer.
          </p>
        )}
      </div>

      <Link
        href="/member/schema"
        className="rounded-2xl bg-accent px-6 py-6 text-center text-xl font-semibold text-accent-foreground shadow-sm active:opacity-90"
      >
        Start training
      </Link>

      <Link
        href="/member/scan"
        className="rounded-2xl border-2 border-neutral-900 px-6 py-5 text-center text-lg font-semibold text-neutral-900 active:bg-neutral-50"
      >
        📷 Scan machine
      </Link>
    </div>
  );
}
