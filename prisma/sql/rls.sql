-- GymRebel — Row-Level Security policies (handmatige migratie).
--
-- Toepassen:
--   Development : npm run db:rls   (of: npx prisma db execute --file prisma/sql/rls.sql --schema prisma/schema.prisma)
--   Productie/CI: als aparte stap ná `prisma migrate deploy`.
--
-- Werking: elke tenant-scoped tabel krijgt een policy `tenant_isolation` die
-- rijen filtert op de transaction-local GUC `app.current_tenant`. Die GUC wordt
-- per query gezet door de tenant-scoped Prisma client (zie lib/tenant-db.ts).
-- Is de GUC niet gezet, dan is current_setting(..., true) = NULL en matcht geen
-- enkele rij (default-deny).
--
-- LET OP — enforcement tegen de DB-eigenaar:
-- De tabel-OWNER (bv. Neon's `neondb_owner`) omzeilt RLS standaard. Voor échte
-- enforcement in productie draai je de applicatie met een aparte, niet-owner
-- rol (zie het commentaar onderaan over FORCE ROW LEVEL SECURITY + app-rol).
-- Tot die tijd is de tenant-isolatie primair applicatie-side (expliciete
-- tenantId-filters + tenant-scoped client) met deze policies als backstop.

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'User',
    'Machine',
    'Exercise',
    'WorkoutTemplate',
    'WorkoutExerciseItem',
    'AssignedWorkout',
    'WorkoutSession',
    'PerformanceEntry'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      'USING ("tenantId" = current_setting(''app.current_tenant'', true)) '
      'WITH CHECK ("tenantId" = current_setting(''app.current_tenant'', true))',
      t
    );
  END LOOP;
END $$;

-- Volledige enforcement (productie) — pas toe met een dedicated app-rol:
--   ALTER ROLE gymrebel_app NOSUPERUSER;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gymrebel_app;
--   FOREACH t: ALTER TABLE %I FORCE ROW LEVEL SECURITY;  -- ook de owner valt dan onder RLS
-- en verbind de app via die rol (aparte DATABASE_URL), terwijl migraties met de
-- owner-rol draaien.
