# GymRebel

Multitenant SaaS-app voor sportscholen. Elke sportschool is een eigen tenant met
eigen leden, apparatuur, schema's en huisstijl — onder de motorkap één codebase.

De volledige projectcontext, stack en conventies staan in **[CLAUDE.md](./CLAUDE.md)**.
De stap-voor-stap bouwgids staat in **[GymRebel-Bouwgids.md](./GymRebel-Bouwgids.md)**.

## Stack

- Next.js 16 (App Router, React Server Components)
- TypeScript (strict)
- Tailwind CSS v4
- PostgreSQL via Prisma ORM
- NextAuth.js v5 (Auth.js)
- Hosting: Vercel (EU regio)

## Lokaal starten

1. Installeer dependencies:

   ```bash
   npm install
   ```

2. Maak een `.env` op basis van `.env.example` en vul de waarden in
   (PostgreSQL connection string, NextAuth secret, etc.):

   ```bash
   cp .env.example .env
   ```

3. Genereer de Prisma client en draai de migraties (zodra een database is
   geconfigureerd — zie prompt 02 van de bouwgids):

   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

4. Start de dev-server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Mappenstructuur

```
app/            Next.js App Router routes (member/owner)
lib/            Gedeelde logica (db, auth, tenant)
components/ui/  Gedeelde UI-componenten
prisma/         Prisma schema, migraties, seed
types/          Gedeelde TypeScript types
```
