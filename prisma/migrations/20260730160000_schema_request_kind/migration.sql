-- Aanvraagtype: een aanpassing van het lopende schema is iets anders dan een
-- compleet nieuw schema. Bestaande rijen zijn per definitie nieuw-schema-aanvragen
-- (dat was tot nu toe het enige type), dus de default dekt de historie.
CREATE TYPE "SchemaRequestKind" AS ENUM ('NEW_SCHEMA', 'CHANGE');

ALTER TABLE "SchemaRequest"
  ADD COLUMN "kind" "SchemaRequestKind" NOT NULL DEFAULT 'NEW_SCHEMA';

-- Een aanpassingsverzoek kiest geen doel ("wat wil je anders?" i.p.v. spiermassa/
-- afvallen/…), dus goal wordt optioneel. Bestaande waarden blijven staan.
ALTER TABLE "SchemaRequest"
  ALTER COLUMN "goal" DROP NOT NULL;
