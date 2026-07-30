-- Mag een lid het door zijn trainer toegewezen schema zelf aanpassen? Opt-in per
-- sportschool (default uit = bestaand gedrag). Het lid bewerkt daarbij zijn eigen
-- kopie; de master-template blijft van de coach en de wijziging verschijnt als
-- "persoonlijke aanpassing" in de 3-weg-diff.
ALTER TABLE "Tenant" ADD COLUMN "memberCanEditAssigned" BOOLEAN NOT NULL DEFAULT false;
