# GymRebel — Project Context

GymRebel is een multitenant SaaS-app voor sportscholen. Elke sportschool is een aparte tenant met eigen leden, apparatuur, schema's en huisstijl. Onder de motorkap één codebase.

## Stack

- **Framework**: Next.js 16 (App Router, React Server Components) — `create-next-app@latest` leverde 16; functioneel gelijk aan de gids (App Router/RSC)
- **Taal**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: NextAuth.js v5 (Auth.js) — email magic link + OAuth
- **Hosting**: Vercel (EU regio verplicht)
- **Storage**: Vercel Blob voor media
- **Package manager**: npm

## Architectuur-principes

1. **Multitenant via row-level security** — élke tabel (behalve `Tenant` zelf) heeft `tenantId`. PostgreSQL RLS-policies zorgen dat queries automatisch gefilterd zijn.
2. **Tenant-resolutie via subdomein** — `fitpower.gymrebel.app` → tenant `fitpower`. In development gebruik `?tenant=fitpower` als query.
3. **Twee rollen**: `MEMBER` (sporter) en `OWNER` (sportschooleigenaar). Strikt gescheiden routes: `/app/(member)` en `/app/(owner)`.
4. **Whitelabel** — elke tenant heeft een eigen `theme`-blob met logo URL, accent-kleur, naam. UI leest deze runtime.
5. **Mobile-first** — alle member-routes ontwerpen voor 5-inch touch. Desktop is voor owner-routes.
6. **EU data** — geen externe diensten buiten EU. Geen tracking pixels.

## Niet-doelen (uitdrukkelijk)

We bouwen GEEN: ledenadministratie/CRM, betalingen, social feed, voedingsadvies, leaderboards, personal-training booking, toegangscontrole, native apps, wearable-integratie, video-on-demand, marketplace.

## Ontwerpprincipes

1. Sporters zien alleen oefeningen op apparatuur die in hún sportschool staat.
2. Bij medische twijfel: AI/uitleg toont altijd "raadpleeg professional".
3. Eigenaar past basis aan, hoeft niet te bouwen.
4. Mobile-first. Grote knoppen. Zweethanden-proof.
5. Geen feature meer dan strikt nodig.

## Code-conventies

- **Server Components by default**, Client Components alleen waar nodig (`"use client"`).
- **Data fetching in Server Components**, geen client-side fetch tenzij echt interactief.
- **Zod-schemas** voor alle externe input (API routes, form actions).
- **Server Actions** voor mutaties (geen aparte API routes voor CRUD).
- **Prisma** voor alle DB-toegang. Geen ruwe SQL behalve voor RLS-policies.
- **Strict TypeScript**: geen `any`, geen `as` tenzij echt nodig.
- **Bestandstructuur**: `app/`, `lib/` (shared logic), `components/ui/` (shared UI), `prisma/`, `types/`.

## Werkwijze richting Claude

- Werk in kleine commits, één logisch ding per keer.
- Maak eerst een plan voordat je grote stukken code schrijft — laat het me zien.
- Vraag bij ambiguïteit, ga niet gokken.
- Test wat je bouwt: `npm run build` moet succesvol zijn vóór je klaar zegt.
- Update deze CLAUDE.md als je belangrijke architectuur-beslissingen neemt.

## Open beslissingen (kunnen veranderen)

- AI provider: nog te kiezen tussen OpenAI en Anthropic (beide via EU endpoint)
- QR formaat: eigen of standaard (GS1)
- Video hosting: eigen Blob of Mux/Vimeo

## Commerciële kant

Loopt parallel onder leiding van Keimpe (huisstijl, marktstrategie, pricing). Deze codebase moet whitelabel-flexibel blijven — geen GymRebel-branding hardcoded.

## Implementatie-notities (afwijkingen t.o.v. de gids)

- **Next.js 16** i.p.v. 15 — `create-next-app@latest` leverde 16. App Router/RSC identiek.
- **Prisma vastgepind op v6** (`prisma` + `@prisma/client` = 6.19.3, exact). Prisma 7
  verwijdert `url`/`directUrl` uit het schema en vereist driver-adapters; dat botst met
  de gids (klassieke `@prisma/client`, RLS via query-context). Niet upgraden zonder reden.
- **Env voor Prisma CLI**: geladen via `import "dotenv/config"` in `prisma.config.ts`.
  `DATABASE_URL` + `DIRECT_URL` staan in `.env`.
- **Seed-config**: staat in `prisma.config.ts` onder `migrations.seed` (niet in
  `package.json#prisma`). Draaien met `npm run db:seed`.
- **Trainings-sessiemodel heet `WorkoutSession`** (niet `Session`) om botsing met het
  Auth.js `Session`-model (prompt 03) te voorkomen. `PerformanceEntry.session` →
  `WorkoutSession`.
- **MachineType is een enum** (`CARDIO | KRACHT | VRIJE_GEWICHTEN | OVERIG`) i.p.v. een
  vrij tekstveld.
- **Geen route-groups voor member/owner.** Route-groups `(member)`/`(owner)` verschijnen
  niet in de URL → twee home-pagina's zouden beide op `/` botsen. We gebruiken echte
  segmenten: member-area op **`/member/*`**, owner-area op **`/owner/*`**. De gids-notatie
  `/app/(member)` lees je dus als `/member`.
- **Middleware heet `proxy.ts`** (Next 16 hernoemde `middleware.ts` → `proxy.ts`).
- **Auth = tenant-scoped magic link (Auth.js v5, JWT-sessies).**
  - `auth.config.ts` = edge-veilige gedeelde config (callbacks `authorized`/`jwt`/`session`),
    gebruikt door `proxy.ts`. `auth.ts` = volledige instantie (adapter + Nodemailer).
  - `lib/auth-adapter.ts` overschrijft `getUserByEmail` zodat lookups tenant-scoped zijn
    (tenant-slug uit cookie `gymrebel-auth-tenant`, gezet door de login-action).
  - De `signIn`-callback weigert e-mailadressen zonder `tenantId` (onbekend of verkeerde
    tenant) — draait in fase 1 (geen link verstuurd) én fase 2 (callback). Invite-only:
    leden worden door de owner aangemaakt, nooit auto-provisioned bij login.
  - **Dev**: magic link wordt naar de server-console geprint (geen echte mail). Productie:
    later een echte SMTP/Resend-transport in `sendVerificationRequest`.
  - Auth.js infra-tabellen (`Account`, `Session`, `VerificationToken`) hebben **geen**
    `tenantId`/RLS — het zijn framework-tabellen.
- **Tenant-resolutie (prompt 04).** `proxy.ts` lost de tenant op (subdomein of `?tenant`)
  via `lib/tenant-resolve.ts` en zet `x-tenant-slug` als request-header. Server Components
  lezen die via `lib/tenant.ts` (`getCurrentTenant()`, per-request `cache()`). Client
  Components via `useTenant()` (`components/tenant-provider.tsx`).
- **Whitelabel theming.** De root-layout injecteert `--tenant-accent` (uit `tenant.accentColor`)
  als inline CSS-var op `<body>`; `bg-accent`/`text-accent` kleuren daardoor per tenant.
  `<html lang>` volgt `tenant.locale`.
- **RLS-runtime.** `lib/tenant-db.ts` (`getTenantDb()` / `tenantDbFor(id)`) is een Prisma
  `$extends`-client die elke operatie in één transactie wrapt met
  `set_config('app.current_tenant', id, true)`. Gebruik deze voor tenant-business-data.
  De auth-adapter en `getCurrentTenant` gebruiken bewust de base `prisma` (Tenant/Auth-tabellen
  hebben geen RLS).
- **RLS-enforcement caveat (geverifieerd).** Neon's `neondb_owner` heeft `rolbypassrls=true`
  → omzeilt RLS altijd, ook met FORCE. De policy zelf is correct bewezen met een tijdelijke
  niet-bypass rol (fitpower=4, ironhouse=2, onbekend=0). Voor échte DB-enforcement in
  productie: aparte app-rol zonder BYPASSRLS + `FORCE ROW LEVEL SECURITY` (zie rls.sql).
  Vandaag is isolatie primair applicatie-side (expliciete `tenantId` + tenant-scoped client).
- **Seed heeft 2 tenants**: `fitpower` (oranje, NL, rijk) en `ironhouse` (blauw, EN, compact).
  `sven@fitpower.nl` bestaat in beide tenants (demonstreert e-mail uniek per tenant).

## RLS-policies toepassen (vastgelegd in prompt 04)

De row-level-security policies staan in `prisma/migrations/manual/rls.sql`.
- **Development**: handmatig toepassen na een schema-migratie met
  `psql "$DIRECT_URL" -f prisma/migrations/manual/rls.sql`.
- **Productie/CI**: als aparte stap in de deploy-pipeline draaien na `prisma migrate deploy`.
- Elke query zet de tenant-context via `SET app.current_tenant = '<slug>'` (zie `lib/db.ts`).
