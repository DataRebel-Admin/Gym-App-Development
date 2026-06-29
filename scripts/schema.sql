-- Externe oefeningen-dataset (1.324 records) — staat los van het Prisma-schema.
-- Idempotent: veilig om meerdere keren te draaien.

CREATE TABLE IF NOT EXISTS exercises (
  id                 text PRIMARY KEY,
  name               text NOT NULL,
  category           text NOT NULL,
  body_part          text NOT NULL,
  equipment          text NOT NULL,
  target             text NOT NULL,
  muscle_group       text,
  secondary_muscles  text[]      NOT NULL DEFAULT '{}',
  instructions       jsonb       NOT NULL,
  instruction_steps  jsonb,
  image_url          text NOT NULL,
  gif_url            text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercises_category  ON exercises (category);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises (equipment);
CREATE INDEX IF NOT EXISTS idx_exercises_target    ON exercises (target);
