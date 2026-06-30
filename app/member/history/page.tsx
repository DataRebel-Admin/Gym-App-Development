import Link from "next/link";
import { requireMember, getMemberHistory } from "@/lib/member";
import { HistoryChart } from "./history-chart";

const DATE_FMT = new Intl.DateTimeFormat("nl-NL", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export const metadata = { title: "Geschiedenis" };

export default async function MemberHistoryPage() {
  const member = await requireMember();
  const { sessions, series } = await getMemberHistory(member.id, member.tenantId);

  return (
    <div className="flex flex-1 flex-col gap-6 px-5 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Historie
      </h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-neutral-900">
          Gewichtsprogressie
        </h2>
        <HistoryChart series={series} />
        {series.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {series.map((s) => (
              <Link
                key={s.exerciseId}
                href={`/member/history/exercise/${s.exerciseId}`}
                className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
              >
                {s.name} →
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-neutral-900">
          Eerdere sessies
        </h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-neutral-500">Nog geen sessies.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3"
              >
                <span className="text-sm font-medium text-neutral-900">
                  {DATE_FMT.format(s.startedAt)}
                </span>
                <span className="text-sm text-neutral-500">
                  {s.exerciseCount} oefeningen
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
