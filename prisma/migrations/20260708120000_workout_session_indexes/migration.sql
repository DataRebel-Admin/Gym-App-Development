-- Prestatie-indexen op WorkoutSession (hoogste-churn tabel). Member-facing queries
-- filteren op (tenantId, userId) en sorteren op startedAt; owner/staff-dashboards
-- op (tenantId, startedAt). Met alleen losse tenantId/userId-indexen deed Postgres
-- de startedAt-sort in-memory. Deze twee composieten dekken beide patronen.
--
-- De losse "WorkoutSession_userId_idx" BLIJFT bestaan: app/account/export filtert
-- alléén op userId (GDPR-export, geen tenantId). De losse tenantId-index vervalt —
-- beide composieten leiden met tenantId en dekken elke tenantId-prefix lookup.

CREATE INDEX "WorkoutSession_tenantId_userId_startedAt_idx" ON "WorkoutSession"("tenantId", "userId", "startedAt");
CREATE INDEX "WorkoutSession_tenantId_startedAt_idx" ON "WorkoutSession"("tenantId", "startedAt");

DROP INDEX "WorkoutSession_tenantId_idx";
