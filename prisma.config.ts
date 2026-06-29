// Prisma config — laadt .env zodat DATABASE_URL en DIRECT_URL beschikbaar zijn.
// De daadwerkelijke datasource-urls staan in prisma/schema.prisma via env().
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
