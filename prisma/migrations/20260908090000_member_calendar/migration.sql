-- Ledenagenda: weekdagplanning op de schematoewijzing, archiveringsmoment voor
-- de retrospectieve kalender, en een ICS-feedtoken op de gebruiker.
-- Alle kolommen zijn additief en nullable op bestaande, al tenant-scoped
-- tabellen → geen RLS-wijziging nodig.

-- Weekdagplanning van het lid: { setAt: "YYYY-MM-DD", days: Record<dayId, isoWeekday[]> }.
-- Vorm/validatie in lib/calendar-plan.ts.
ALTER TABLE "AssignedWorkout" ADD COLUMN "weekdayPlan" JSONB;

-- Moment waarop status ARCHIVED werd: begrenst het geplande raster in de
-- agenda-historie (een gearchiveerd schema zonder endDate zou anders eeuwig
-- "gemist" produceren). Bestaande gearchiveerde rijen houden NULL — die kunnen
-- nooit een weekdayPlan hebben (nieuw veld), dus dat gat is theoretisch.
ALTER TABLE "AssignedWorkout" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Onraadbare token voor de publieke ICS-feed (zelfde patroon als
-- passwordResetToken). NULL = geen feed aangemaakt.
ALTER TABLE "User" ADD COLUMN "calendarFeedToken" TEXT;
CREATE UNIQUE INDEX "User_calendarFeedToken_key" ON "User"("calendarFeedToken");
