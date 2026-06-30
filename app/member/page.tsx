import Link from "next/link";
import { requireMember, getAssignedSchema } from "@/lib/member";
import { getCurrentTenant } from "@/lib/tenant";
import { AssistantWidget } from "@/components/assistant-widget";
import { Reveal, RevealItem } from "@/components/motion/reveal";

export default async function MemberHome() {
  const member = await requireMember();
  const [assignment, tenant] = await Promise.all([
    getAssignedSchema(member.id, member.tenantId),
    getCurrentTenant(),
  ]);
  const schema = assignment?.template;

  return (
    <Reveal
      stagger
      className="flex flex-1 flex-col gap-5 px-5 py-7"
    >
      <RevealItem>
        <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900">
          Hoi {member.name?.split(" ")[0] ?? "sporter"} 👋
        </h1>
        <p className="mt-1 text-neutral-500">Klaar voor je training?</p>
      </RevealItem>

      {/* Hero-schema kaart */}
      <RevealItem className="overflow-hidden rounded-3xl bg-accent-gradient p-6 text-accent-foreground shadow-accent">
        <p className="text-xs font-medium uppercase tracking-wide opacity-80">
          Jouw schema
        </p>
        {schema ? (
          <>
            <p className="mt-1 font-display text-2xl font-bold">{schema.name}</p>
            <p className="mt-0.5 text-sm opacity-90">
              {schema.items.length} oefeningen
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm opacity-90">
            Nog geen schema toegewezen. Vraag je trainer.
          </p>
        )}
      </RevealItem>

      <RevealItem>
        <Link
          href="/member/schema"
          className="flex items-center justify-center rounded-2xl bg-foreground px-6 py-5 text-center text-xl font-bold text-background shadow-md transition-transform active:scale-[0.98]"
        >
          Start training
        </Link>
      </RevealItem>

      <RevealItem>
        <Link
          href="/member/scan"
          className="flex items-center justify-center gap-2 rounded-2xl border-2 border-neutral-200 bg-surface-1 px-6 py-4 text-center text-lg font-semibold text-neutral-900 transition-colors active:bg-neutral-50"
        >
          <span aria-hidden>📷</span> Scan machine
        </Link>
      </RevealItem>

      {tenant?.aiEnabled ? (
        <RevealItem>
          <AssistantWidget />
        </RevealItem>
      ) : null}
    </Reveal>
  );
}
