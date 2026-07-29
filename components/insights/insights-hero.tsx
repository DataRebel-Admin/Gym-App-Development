import { useTranslations } from "next-intl";
import { StatCard } from "@/components/ui/stat-card";

/**
 * KPI-hero van /owner/insights: periode-gebonden analysecijfers — bewust géén
 * herhaling van de dashboard-KPI's (vandaag/deze week). Retentie is
 * kalendermaand-gebaseerd en wordt zo gelabeld. Sync server component;
 * StatCard is client en krijgt alleen serialiseerbare props.
 */
export function InsightsHero({
  windowDays,
  visitsTotal,
  visitsTrendPct,
  activeMembers,
  newMembersTotal,
  newMembersTrendPct,
  retentionPct,
  noShowPct,
}: {
  windowDays: number;
  visitsTotal: number;
  visitsTrendPct: number | null;
  /** null bij een gescopede multi-vestiging-manager (niet optelbaar). */
  activeMembers: number | null;
  newMembersTotal: number;
  newMembersTrendPct: number | null;
  retentionPct: number | null;
  noShowPct: number | null;
}) {
  const t = useTranslations("owner.insights");
  const hint = t("hintLastDays", { count: windowDays });

  const cards: React.ReactNode[] = [
    <StatCard
      key="visits"
      label={t("kpiVisits")}
      value={visitsTotal}
      trend={visitsTrendPct}
      hint={hint}
    />,
  ];
  if (activeMembers != null) {
    cards.push(
      <StatCard key="active" label={t("kpiActiveMembers")} value={activeMembers} hint={hint} />
    );
  }
  cards.push(
    <StatCard
      key="new"
      label={t("kpiNewMembers")}
      value={newMembersTotal}
      trend={newMembersTrendPct}
      hint={hint}
    />
  );
  if (retentionPct != null) {
    cards.push(
      <StatCard
        key="retention"
        label={t("kpiRetention")}
        value={retentionPct}
        suffix="%"
        hint={t("hintRetentionMonth")}
      />
    );
  }
  if (cards.length < 4 && noShowPct != null) {
    cards.push(
      <StatCard key="noshow" label={t("kpiNoShow")} value={noShowPct} suffix="%" hint={hint} />
    );
  }

  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.slice(0, 4)}</div>;
}
