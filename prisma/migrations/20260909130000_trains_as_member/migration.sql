-- Lid-modus voor teamleden: mag deze eigenaar/medewerker zelf meesporten?
-- Additief en default false → bestaand gedrag ongewijzigd. Geen RLS-wijziging:
-- kolom op een bestaand model (User), geen nieuwe tabel.
ALTER TABLE "User" ADD COLUMN "trainsAsMember" BOOLEAN NOT NULL DEFAULT false;
