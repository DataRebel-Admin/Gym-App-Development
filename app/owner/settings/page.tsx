import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/owner";
import { setAiEnabled } from "./actions";

function startOfMonth(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

export const metadata = { title: "Instellingen" };

export default async function SettingsPage() {
  const owner = await requireOwner();

  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: owner.tenantId },
    select: { name: true, aiEnabled: true },
  });

  const questionsThisMonth = await prisma.aiUsage.count({
    where: { tenantId: owner.tenantId, createdAt: { gte: startOfMonth() } },
  });

  return (
    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Instellingen
      </h1>

      <section className="flex max-w-2xl flex-col gap-4 rounded-xl border border-neutral-200 p-5">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">
            AI-trainingsassistent
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Een chat-assistent voor leden, beperkt tot jouw apparatuur en met een
            verplichte veiligheidsmelding. Status:{" "}
            <span className="font-medium text-neutral-900">
              {tenant.aiEnabled ? "aan" : "uit"}
            </span>
            .
          </p>
        </div>

        <form action={setAiEnabled}>
          <input
            type="hidden"
            name="enabled"
            value={tenant.aiEnabled ? "false" : "true"}
          />
          <button
            type="submit"
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tenant.aiEnabled
                ? "border border-neutral-300 text-neutral-900 hover:bg-neutral-50"
                : "bg-accent text-accent-foreground hover:opacity-90"
            }`}
          >
            {tenant.aiEnabled ? "Zet uit" : "Zet aan"}
          </button>
        </form>

        <div className="rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          Vragen deze maand:{" "}
          <span className="font-semibold text-neutral-900">
            {questionsThisMonth}
          </span>{" "}
          <span className="text-neutral-500">(voor kostenmonitoring)</span>
        </div>
      </section>
    </div>
  );
}
