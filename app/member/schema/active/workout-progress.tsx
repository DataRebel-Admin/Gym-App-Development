"use client";

import { useEffect, useState } from "react";
import { m } from "motion/react";

function fmtClock(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Bovenaan-overzicht van de workout-voortgang: voortgangsbalk + percentage,
 * afgeronde oefeningen, resterende sets, geschatte resterende tijd en een
 * meelopende workout-klok.
 */
export function WorkoutProgress({
  completedSets,
  totalSets,
  completedExercises,
  totalExercises,
  estRemainingSec,
  startedAt,
}: {
  completedSets: number;
  totalSets: number;
  completedExercises: number;
  totalExercises: number;
  estRemainingSec: number;
  startedAt: string;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const pct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  const remainingSets = Math.max(0, totalSets - completedSets);
  const estMin = Math.max(0, Math.round(estRemainingSec / 60));

  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4 shadow-sm">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">Voortgang</p>
          <p className="font-display text-3xl font-bold leading-none text-neutral-900">
            {pct}%
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-neutral-500">Tijd</p>
          <p className="font-display text-2xl font-bold tabular-nums leading-none text-neutral-900">
            {fmtClock(elapsed)}
          </p>
        </div>
      </div>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        <m.div
          className="h-full rounded-full bg-accent-gradient"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat value={`${completedExercises}/${totalExercises}`} label="oefeningen" />
        <Stat value={String(remainingSets)} label="sets te gaan" />
        <Stat value={remainingSets === 0 ? "klaar" : `~${estMin}m`} label="resterend" />
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2">
      <p className="font-display text-lg font-bold leading-none text-neutral-900">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-neutral-500">{label}</p>
    </div>
  );
}
