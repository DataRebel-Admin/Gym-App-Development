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

- AI provider: **gekozen — Anthropic Claude** (`@anthropic-ai/sdk`), EU data-residency
  via `inference_geo: "eu"`. Model default `claude-opus-4-8`, overschrijfbaar met `AI_MODEL`.
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
  - **Wachtwoord-login is tweestaps.** Stap 1 (`loginWithPassword`) verifieert e-mail+
    wachtwoord server-side en logt direct in als er géén 2FA is. Heeft de gebruiker 2FA
    aanstaan, dan vraagt stap 1 de code NIET maar mint een **ondertekende, kortlevende
    challenge** (`lib/login-challenge.ts`, HMAC met `AUTH_SECRET`, 5 min, gebonden aan
    e-mail+tenant) in een httpOnly-cookie en redirect naar de aparte pagina `/login/2fa`.
    Stap 2 (`verifyTwoFactor`) verzamelt alleen de TOTP-code. De credentials-`authorize`
    accepteert óf een geldige challenge (bewijs dat het wachtwoord al geverifieerd is, +
    de 2FA-code) óf het klassieke wachtwoord-pad (defense-in-depth). De challenge maakt het
    onmogelijk het credentials-endpoint direct te misbruiken om 2FA te omzeilen. Tenant-
    scoped user-lookup is gedeeld in `lib/login-user.ts` (`resolveLoginUser`).
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
  De seed genereert ook **trainingsactiviteit** (sessies + prestaties, laatste ~12 weken)
  zodat het owner-dashboard cijfers heeft.

### Fase 2 (owner-functionaliteit, prompts 05–07)

- **`requireOwner()`** (lib/owner.ts) = guard voor alle owner-pagina's/actions; queries en
  mutaties zijn gescoped op `owner.tenantId` (app-side isolatie; RLS is de backstop).
- **Lid-schema-model**: een toegewezen schema is een eigen **niet-library `WorkoutTemplate`**
  (met eigen items) waarnaar `AssignedWorkout` verwijst. "Kopieer & wijs toe" kloont een
  library-template; verwijderen ruimt de kloon op. Zie de schema-levenscyclus hieronder —
  een lid kan **meerdere** toewijzingen hebben (concept/gepland/actief) maar ziet er telkens één.
- **Foto-upload** via Vercel Blob werkt alleen met `BLOB_READ_WRITE_TOKEN`; zonder token
  degradeert create/update netjes (geen foto). QR-download is client-side (`qrcode`).
- **Insights** (lib/insights.ts): server-side aggregaties met `unstable_cache` (revalidate
  300s), gekeyed op `tenantId`. Charts via **recharts** in client-componenten; de
  staaf-/lijnkleur gebruikt `var(--tenant-accent)`.

### Fase 4 (optionele uitbreidingen, prompts 11–13)

- **AI-assistent (prompt 11)**: `lib/ai.ts` = Anthropic Claude (`@anthropic-ai/sdk`),
  EU-data via `inference_geo: "eu"`, model via `AI_MODEL` (default `claude-opus-4-8`).
  Verplichte safety-fallback in `lib/ai-guardrail.ts`. Per tenant aan/uit (`Tenant.aiEnabled`,
  owner `/settings`). Rate-limit 20/dag/lid via `AiUsage`-model. Widget alleen op `/member`
  bij aiEnabled. Zonder API-key degradeert het netjes.
- **Rooster (prompt 12)**: `GroupClass`/`ClassSession`/`ClassEnrollment`. Aanmelden is
  atomair (transactie respecteert `maxParticipants`); `@@unique([sessionId, userId])`.
- **PDF (prompt 13)**: `/member/schema/pdf` route-handler rendert met **pdf-lib**
  (geen native deps, betrouwbaarder in Next dan @react-pdf/renderer) en streamt als download.
- **Niet gebouwd (bewust)**: prompt 14 (i18n) — op verzoek overgeslagen.

### Schema-toewijzing: levenscyclus, planning & meldingen

Een Tenant Owner stelt schema's samen (bestaande `SchemaEditor`, drag-and-drop,
multi-dag, eigen + standaardoefeningen) en wijst ze toe met een volledige
**levenscyclus** en automatische, voorkeur-gerespecteerde meldingen.

- **`AssignedWorkout` = lifecycle-model.** Velden: `status`
  (`enum AssignmentStatus DRAFT | SCHEDULED | PUBLISHED | ARCHIVED`),
  `availableFrom` (zichtbaarheidspoort — geplande publicatie), `startDate`/`endDate`
  (trainingsperiode), `trainerMessage`, `publishedAt`, `assignedById`, `notifiedAt`
  (idempotente meldingen), `seenAt` ("Nieuw"-indicator) en `sourceTemplateId`
  (herkomst-library-template → owner-overzicht). Een lid kan **meerdere** toewijzingen
  hebben; `getAssignedSchema` (lib/member.ts) kiest de **actieve**: PUBLISHED,
  `availableFrom ≤ nu`, niet verlopen, meest recent. Concept/gepland blijven verborgen —
  zuiver read-time (geen job nodig voor zichtbaarheid).
- **Toewijs-flow** (`app/owner/schemas/actions.ts`): `assignSchemaChunk(sourceId, userIds[],
  options)` is een **getypeerde, per-chunk** server-action (client batcht per 25 →
  echte voortgangsbalk, schaalbaar voor duizenden). Modi: direct publiceren / concept /
  inplannen (+ ingangs-/einddatum + persoonlijke boodschap). Bij publiceren wordt een vorig
  actief schema **gearchiveerd** (`archivePriorActive`, behoudt historie) en gedetecteerd of
  het een **reassign** is. Per-lid-acties: `assignFromTemplate`, `startEmptySchema`,
  `publishAssignment`, `archiveAssignment`, `removeAssignment`. Kloon-helper
  `cloneToAssignment` schrijft `sourceTemplateId` mee.
- **Geplande publicatie** verloopt via **Vercel Cron** → `app/api/cron/publish-schemas`
  (`vercel.json`, elke 5 min, Bearer `CRON_SECRET`). Publiceert due `SCHEDULED`-rijen,
  archiveert vorige actieve, en stuurt de meldingen — hergebruikt bewust de volledige
  TS-architectuur i.p.v. een los `.mjs`-script.
- **Meldingen**: gedeelde **`lib/schema-notify.ts`** (`notifyAssignmentsPublished`) — in-app +
  e-mail (bestaande `schemaAssignedMessage`, branded) + **web-push**, elk gegate op
  `prefAllows(prefs, "schemas", kanaal)`. Idempotent via `notifiedAt`. Gebruikt door zowel de
  action (direct) als de cron (gepland).
- **Web-push** (nieuw): `lib/push.ts` (`sendPushToUser`, `vapidPublicKey`, `pushConfigured`;
  ruimt 404/410-endpoints op), model **`PushSubscription`** (tenant-scoped + RLS), service
  worker `public/sw.js`, subscribe-flow op `/account/meldingen` (`push-toggle.tsx` +
  `app/account/push-actions.ts`). VAPID-sleutels via env (`VAPID_PUBLIC_KEY`/`_PRIVATE_KEY`/
  `_SUBJECT`; `npx web-push generate-vapid-keys`). Zónder sleutels degradeert alles netjes.
- **"Nieuw"-indicator (lid)**: badge + trainersboodschap op `/member/schema` en een
  dashboard-alert op `/member` zolang `seenAt == null`. `markActiveSchemaSeen`
  (app/member/schema/actions.ts) wordt op openen aangeroepen (`MarkSchemaSeen`).
- **Owner-overzicht per schema**: `components/schema-assignment-overview.tsx` op de
  template-pagina toont leden, status, publicatiedatum, periode, laatst gewijzigd, gezien +
  aantal actief (`lib/schema-assignments.ts`). Statuslabels/kleuren centraal in
  **`lib/schema-status.ts`** (`ASSIGNMENT_STATUS_META`, `isActiveNow`, datumhelpers).
- **Audit** (lib/audit-actions.ts): `schema.reassign`, `schema.publish`, `schema.schedule`,
  `schema.archive`, `schema.notify.sent`, `schema.email.sent` — alle onder categorie `schemas`.
- **Bewust niet gebouwd**: lidmaatschapsgroepen (toewijs-flow is er wel op voorbereid via
  multi-select; "filter op groep" volgt zodra een MemberGroup-model bestaat).

### Fase 3 (member-functionaliteit, prompts 08–10)

- **`requireMember()`** (lib/member.ts) = guard; member-area is mobile-first (`max-w-md`,
  onderbalk-nav). Een lid heeft één `AssignedWorkout` → niet-library template met items.
- **Tracking**: `PerformanceEntry` heeft `@@unique([sessionId, exerciseId, setNumber])` zodat
  per-set opslaan via **upsert** kan. `saveSet` is een server-action die optimistisch vanuit
  de client wordt aangeroepen (`useTransition`). `startSession`/`endSession` zijn form-actions.
- **`/m/[qrToken]`** is een publieke (niet-auth) maar **tenant-scoped** route; 404 als de QR
  niet bij de actieve tenant hoort. Toont altijd de veiligheidsmelding "Twijfel? Vraag een
  trainer." Ingelogde leden zien "Voeg toe aan mijn schema" (dedupliceert oefeningen).
- **QR-scanner** gebruikt `html5-qrcode` (dynamic import, camera). Progressie-grafieken &
  dashboards: `recharts`. 1RM-schatting via Epley.

### Oefeningen-catalogus (externe dataset — leidende structuur)

Een externe dataset van **1.324 oefeningen** (rijke metadata, thumbnail + animatie,
meertalige instructies) is dé bron van waarheid voor oefening-content. Media staat op
**Azure Blob** (`datarebel`/`exercise-media`, publieke blob-read); metadata in Postgres.

- **`ExerciseCatalog`** (`@@map("exercise_catalog")`) = globaal, **géén `tenantId`/RLS**
  (zoals Tenant/Auth-tabellen). Velden: category/bodyPart/equipment/target/muscleGroup/
  secondaryMuscles + `instructions`/`instructionSteps` (Json per taal) + image/gif-URL.
- **Tenant-`Exercise` cureert**: nieuw veld `catalogId String?` (nullable → eigen
  oefeningen blijven mogelijk). `name`/`description`/`targetMuscle` zijn overrides; media,
  spiergroepen en instructies komen uit de catalogus. Downstream FK's
  (`WorkoutExerciseItem`, `PerformanceEntry`) blijven naar tenant-`Exercise` wijzen.
- **Resolver `lib/exercise.ts`** (`getExerciseDetail`) merget Exercise + catalogus en kiest
  taal op `tenant.locale` met **EN-fallback** (dataset heeft en/es/it/tr + deels nl).
- **Owner**: `/owner/exercises` doorzoekt de catalogus (filters + paginering) en voegt
  items toe als tenant-`Exercise`; `suggestMachineType()` (lib/machine.ts) stelt een
  MachineType voor, owner kiest de machine. **Member**: detailpagina + machine-QR-pagina
  tonen gif/stappen/spieren (altijd met "raadpleeg een professional"-melding).
- **Scripts** (`scripts/`, idempotent): `media:upload` (Azure), `data:import`
  (catalogus + en→nl vertaling via Azure Translator), `data:link` (naam-koppeling).
  Seed koppelt demo-oefeningen via `catalogName` (exacte, lowercase catalogus-naam).
- **Vertaalstand**: nl-instructies zijn deels gevuld; Azure **F0** throttelt te hard voor
  de volledige set. Afmaken: Translator-tier **S1** + `npm run data:import` (hervat).
- **Licentie**: dataset-media is **non-commercieel** — vervangen vóór commercieel gebruik.
- **Eigen oefeningen (tenant-specifiek)**: een eigen oefening = tenant-`Exercise` met
  `catalogId == null` + ingevulde eigen-content-velden op datzelfde model (géén apart model):
  `description`/`targetMuscle` (bestonden al), `muscleGroups[]`, `category`, `difficulty`
  (enum `ExerciseDifficulty`), `equipment`, `tags[]`, `executionMd`/`coachingTipsMd`/
  `commonMistakesMd`/`notesMd` (Markdown), `imageUrls[]`, `videoUrl`, `archivedAt`. Bij
  catalogus-gekoppelde oefeningen blijven die NULL (catalogus is bron). `getExerciseDetail`
  (lib/exercise.ts) merget: bij `catalog == null` zijn de eigen velden de bron, anders de
  catalogus (+ `source: "standaard" | "eigen"`). Owner beheert ze op `/owner/exercises?tab=eigen`
  (toevoegen/bewerken/dupliceren/archiveren/verwijderen — verwijderen geblokkeerd zodra de
  oefening in een schema/historie zit → archiveren). Rich-text = gedeelde
  `components/ui/markdown-field.tsx` (textarea + live preview, ook in machine-form).
  Media-upload via `uploadExerciseImage` (lib/blob.ts), video-embed via `lib/video.ts`
  (`toEmbedUrl`, YouTube/Vimeo). Schema-editor toont een **Standaard/Eigen**-badge
  (`AvailableExercise.source`); gearchiveerde oefeningen vallen uit de pickers
  (`archivedAt: null`). Volledig tenant-geïsoleerd (bestaande `tenantId` + RLS). Alle mutaties
  geaudit (`exercise.add/update/duplicate/archive/unarchive/remove`).

### Slimme oefeningen: oefeningstypes & dynamische parameters

Elke oefening heeft een **type** dat bepaalt wélke parameters relevant zijn — een
coach/sporter ziet nooit irrelevante velden (hardlopen heeft geen gewicht, planken geen
herhalingen, fietsen wel afstand/tijd). Volledig backward-compatible: kracht blijft
ongewijzigd.

- **Code-registry `lib/exercise-types.ts`** (géén `server-only`, ook client) = bron van
  waarheid, idiomatisch zoals `audit-actions`/`rbac`/`email/template-defaults`. Per type
  (`strength, cardio, endurance, isometric, mobility, stretch, circuit, hiit, core, other`):
  `label/icon/tone`, `logModel` (`"sets"` vs `"single"`), `targetFields` (wat de coach in
  het schema invult) en `logFields` (wat de sporter logt). Elk `ParamField` heeft
  `kind` (`int/float/duration/distance/enum/text`), `unit`, optioneel `column`
  (sets/reps/weightKg/restSeconds/tempo → bestaande kolom) en validatie-grenzen.
  **Nieuw type = één record** (geen DB-migratie). `inferExerciseType(catalog)` raadt het
  type bij catalogus-import (mirror van `suggestMachineType`).
- **Opslag (hybride, geen data-migratie-risico)**: `Exercise.exerciseType String
  @default("strength")` (String, geen enum → uitbreidbaar zonder migratie).
  `WorkoutExerciseItem.params Json?` + `PerformanceEntry.params Json?` houden de
  type-specifieke waarden; velden met een `column` blijven in de bestaande kolommen
  (sets/reps/weightKg/restSeconds/tempo) → álle bestaande kracht-leessites werken
  ongewijzigd. Canoniek: durations in **seconden**, afstanden in **meters**.
- **Pure helpers `lib/exercise-params.ts`**: `validateItemParams`/`itemColumnsFromParams`
  (kolommen+JSON splitsen), `paramsFromItem`/`itemToInputValues` (reconstructie voor de
  editor), `formatItemSummary`/`targetSummaryFromItem` (centrale samenvatting "4 × 10 @ 70
  kg" of "30 min · 5 km · Zone 3" — hergebruikt door checklist, PDF, owner-overzicht én
  editor-preview), en de tracking-varianten `logParamsFromInputValues`/`logColumnsFromParams`/
  `entryToLogInputValues`.
- **Owner**: type-keuze bovenaan het eigen-oefeningformulier; catalogus-adds krijgen een
  automatisch type via `inferExerciseType`; inline `ExerciseTypeSelect` (auto-submit naar
  `setExerciseType`) op elke oefeningkaart (eigen + catalogus) om bij te sturen. Audit
  `exercise.type.change`.
- **Schema-editor** (`components/schema-editor.tsx`): `EditorItem` draagt `exerciseType` +
  `values` (input-strings per veld-id); de rij rendert de `targetFields` dynamisch met
  type-icoon/-chip. Serialisatie → `{ exerciseId, exerciseType, values, notes }`;
  `saveSchema` zet ze met de registry om naar kolommen+params (lenient/best-effort, zodat
  autosave nooit blokkeert). `cloneToAssignment`/`duplicateTemplate` nemen `params` mee.
- **Sporter**: `/member/schema` toont de type-bewuste samenvatting. Live tracking:
  **kracht volgt het ongewijzigde `ExerciseBlock`-pad** (reps×kg, PR/1RM/rusttimer);
  alle overige types gebruiken **`DynamicExerciseBlock`** (`single` = één resultaat,
  `sets` = per set), met alléén de `logFields`. Opslaan via server-action **`saveLog`**
  (reps/weightKg-kolommen voor kracht + JSON-params). 1RM/volume/PR blijven kracht-only —
  niet-kracht-entries hebben reps=0/weightKg=0 en tellen vanzelf niet mee.
- **PDF** (`lib/schema-pdf.ts`): niet-kracht-rijen tonen `summary` over de getalkolommen
  i.p.v. sets/reps/gewicht.
- **Bewust (nog) niet meegenomen**: de **3-weg-sync** (`lib/schema-diff.ts`) en de
  **bulk-edit** werken op de kracht-kolommen (sets/reps/weight/rest/tempo) en synchroniseren
  `params` nog niet — niet-kracht-oefeningen doen daar (nog) niet aan mee.

### Superadmin + RBAC (platform-laag)

Drie rollen (`enum Role`): **SUPERADMIN** (platform, `tenantId == null`), **TENANT_ADMIN**
(voorheen OWNER) en **TENANT_MEMBER** (voorheen MEMBER). De enum-waarden zijn hernoemd
met behoud van data (`ALTER TYPE RENAME VALUE`, migratie `20260630120000_superadmin_rbac`).

- **RBAC code-gedefinieerd** in `lib/rbac.ts`: `can(role, permission)` + permissiemap;
  `assertTenantAccess(user, tenantId)` (SUPERADMIN mag cross-tenant, rest alleen eigen tenant).
  Later naar een DB-backed model te tillen zonder de call-sites te wijzigen.
- **Guards**: `requireSuperadmin()` (lib/superadmin.ts) voor `/admin`; `requireOwner()`/
  `requireMember()` narrowen `tenantId` naar `string` (tenant-gebruikers hebben altijd een tenant).
- **Auth**: `User.tenantId` is nullable (NULL voor superadmin; globaal uniek e-mailadres via
  partial index). De adapter zoekt zonder tenant-cookie een SUPERADMIN; `signIn` weigert
  gedeactiveerde accounts én gebruikers van inactieve/verwijderde tenants. `proxy.ts` bewaakt
  `/admin` (alleen SUPERADMIN) en voorkomt redirect-loops.
- **Superadmin-area `/admin`**: dashboard, tenants-CRUD (`/admin/tenants`, soft-delete via
  `deletedAt`), huisstijl-editor (accent/secundair/logo/favicon/font — runtime in `app/layout.tsx`),
  ledenbeheer + uitnodigingen per tenant, globale gebruikers (`/admin/users`), audit-viewer
  (`/admin/audit`).
- **Tenant-admin** beheert eigen leden op `/owner/members` (uitnodigen, rol, (de)activeren,
  verwijderen — niet zichzelf). Server-actions zijn gescoped op `owner.tenantId`.
- **Invitations**: `Invitation`-model (token + 7d vervaldatum); mail naar server-console in dev
  (`lib/invitation.ts`, net als de magic link). Publieke accept-flow `/invite/[token]` maakt/
  heractiveert de gebruiker en stuurt door naar de tenant-login.
- **Tenant-isolatie** blijft primair via expliciete `tenantId`-filters (+ RLS-backstop);
  superadmin gebruikt bewust de base `prisma` achter `requireSuperadmin()`.

### Logging & Audit Trail

- **Centrale service** `lib/audit.ts` → `audit(action, opts)` schrijft naar het append-only
  `AuditLog`-model (géén FK's = forensisch; overleeft delete van tenant/user). Faalt **nooit**
  hard (try/catch) zodat logging een business-actie niet kan breken. Vangt automatisch een
  **geanonimiseerd IP** (laatste octet → 0, `anonymizeIp`) + user-agent uit `headers()`.
  Velden: `category`, `status` (`AuditStatus` SUCCESS/FAILED), `oldValue`/`newValue` (diff),
  `ipAddress`, `userAgent`, `metadata`.
- **Actie-registry** `lib/audit-actions.ts` = één bron van waarheid: per action-key
  `{ category, label, icon, tone, sentence() }`. Categorie wordt afgeleid uit de prefix
  (`user.`→members, `schema.`, `exercise.`, `machine.`, `tenant.`/`branding.`→tenant, `auth.`).
  **Nieuw event = één regel toevoegen** + een `audit("…")`-call in de betreffende action.
- **Hook-punten**: leden/uitnodigingen (`app/owner/members`, `app/admin`), schema's
  (`app/owner/schemas/actions.ts`), oefeningen, machines, instellingen (AI-toggle),
  schema-PDF (`app/member/schema/pdf`), en auth-events in `auth.ts` (`auth.login`/`logout`
  via `events`, `auth.login.failed` in de `signIn`-callback — **alleen voor bestaande accounts**).
- **Querylaag** `lib/audit-query.ts` (`queryAuditLogs`, `getRecentActivity`, `getAuditActors`,
  `parseAuditSearchParams`, `serializeAuditRows`). Tenant-scoping wordt door de caller afgedwongen.
- **UI**: owner ziet eigen tenant op `/owner/audit`; superadmin ziet alle tenants op
  `/admin/audit` (+ tenant-filter). Gedeelde componenten in `components/audit/` (tijdlijn,
  detail-modal met diff, filterbalk). Export via `…/audit/export?format=csv|pdf`
  (`lib/audit-export.ts`, pdf-lib). Dashboard-widget `recent-activity` toont leesbare zinnen.
- **Immutability**: er zijn bewust **geen** update/delete-actions op `AuditLog`. Niet toevoegen.
- **Retentie/archivering**: `npm run audit:prune` (`scripts/prune-audit.mjs`) archiveert logs
  ouder dan `AUDIT_RETENTION_DAYS` (default 365) naar `./audit-archive/*.csv` en verwijdert ze.
  In productie als cron-stap draaien (zoals `db:rls`).

### Paginatitels & favicon (Metadata API)

- **Centraal** via Next's Metadata API. `lib/metadata.ts` (`rootMetadata`) wordt als
  `generateMetadata` vanuit `app/layout.tsx` gebruikt en zet één `title.template`:
  `"%s | <tenant> · GymRebel"` (whitelabel — suffix volgt `tenant.name`; zonder tenant alleen
  `GymRebel`). **Nieuwe pagina = één regel**: `export const metadata = { title: "Leden" };`
  (statisch) of een `generateMetadata` die `{ title: "<naam> | <context>" }` teruggeeft
  (dynamisch, bijv. `"Jan de Vries | Lid"`). Next wikkelt dat automatisch in het sjabloon.
  Niet de suffix per pagina hardcoden.
- **Favicon** komt ook uit `rootMetadata`: `tenant.faviconUrl` → anders `tenant.logoUrl` →
  anders het bestand `app/favicon.ico`. Per request (per tenant) server-rendered, dus wisselt
  mee bij tenant-switch.

### Transactionele e-mails (branded, production-ready)

Eén centraal, herbruikbaar systeem in **`lib/email/`** — net als de
`audit-actions`-registry: nieuw e-mailtype = één composer toevoegen, layout +
huisstijl + verzending blijven gedeeld.

- **`branding.ts`** — `EmailBranding` + `resolveEmailBranding(tenant)` /
  `loadTenantBranding(tenantId)` / `loadTenantBrandingBySlug(slug)`. Vult uit de
  `Tenant`-velden (logo, accent/secundair, font, naam, contact, socials) met
  GymRebel-defaults (accent `#e84b1f`). `readableText(hex)` kiest knop-tekstkleur.
  Gebruikt bewust de base `prisma` (Tenant heeft geen RLS).
- **`layout.ts`** (`renderEmailLayout`) — de centrale HTML-shell: table-based,
  600px, inline CSS, `<style>` met responsive + `prefers-color-scheme:dark`, MSO
  conditionals, verborgen preheader, branded header (logo/wordmark) + footer
  (contact, socials, reden, auto-bericht, copyright).
- **`components.ts`** — table-safe string-bouwstenen (`emailButton` = bulletproof
  VML-knop, `emailHeading/Paragraph/Muted/Divider/LinkFallback/InfoCard`,
  `escapeHtml` voor álle gebruikers-/tenant-input).
- **`messages.ts`** — composers `{ subject, html, text }` per type (elk levert óók
  een **plain-text alternatief**): `magicLink`, `invite`, `emailChange`, `welcome`,
  `passwordChanged`, `schemaAssigned`.
- **`mime.ts`** — `buildMimeMessage` → `multipart/alternative` (base64 UTF-8,
  RFC 2047-subject) voor het meesturen van het plain-text-deel via Graph.
- **`send.ts`** (`sendEmail`) — **gecentraliseerde** verzending (vervangt de eerder
  3× gedupliceerde Graph/console-logica). Gelaagd, faalt nooit hard: Graph-MIME →
  Graph-HTML (backstop) → console-log (dev, `✉️ [GymRebel]` met subject + link).
- **Hook-punten**: magic link (`auth.ts` `sendVerificationRequest`, tenant uit de
  login-cookie), uitnodiging (`lib/invitation.ts`, `tenantId`-param), e-mail wijzigen
  (`app/account/actions.ts`), welkom (`app/invite/[token]/actions.ts`), wachtwoord
  gewijzigd (`app/account/security-actions.ts`), schema toegewezen
  (`app/owner/schemas/actions.ts` → `notifySchemaAssigned`). Nieuwe-flow-sends zijn
  best-effort (try/catch, vóór een eventuele `redirect`) — breken de actie nooit.

### E-mailtemplatebeheer (Superadmin, DB-backed, geen redeploy)

De Superadmin beheert álle systeemmails op **`/admin/email-templates`** (overzicht +
split-screen editor) — bewerken, live previewen, testen, publiceren — zónder herdeploy.
**Bewerk-scope = content + onderwerp**: alleen `bodyHtml`/`subject`/`preheader` zijn
editbaar; de gebrande shell (header/footer/kleuren/logo) blijft per tenant runtime
toegevoegd door `renderEmailLayout` — branding kan dus niet stuk en blijft whitelabel.

- **Registry** `lib/email/template-defaults.ts` (géén `server-only`; ook client-bruikbaar)
  = bron van waarheid: per `EmailTemplateKey` één record met `name`, `description`,
  `reason` (footer), `hasTrigger`, `placeholders[]` en default `subject`/`preheader`/
  `bodyHtml` (met `{{placeholders}}`). **Nieuw e-mailtype = één record hier** (+ evt. een
  call-site die `composeFromTemplate(key, …)` aanroept). 6 live types + `notification`/
  `system` (gedefinieerd, nog geen trigger). Globale placeholders (`{{gymName}}`,
  `{{currentYear}}`, `{{accentColor}}`, `{{accentText}}`, `{{logoUrl}}`, `{{supportEmail}}`)
  komen uit de tenant-branding zodat content-only templates tóch de accentkleur volgen.
- **Render/fallback** `lib/email/template-render.ts` (`composeFromTemplate`,
  `renderTemplateMessage`, `renderPlaceholders`, `buildBrandingData`): substitueert
  placeholders (HTML-context → `escapeHtml`, subject/preheader → plat) en wikkelt in de
  layout. **DB wint bij publicatie, hardgecodeerde composer is de fallback**: de 6 composers
  in `lib/email/messages.ts` zijn nu **async** en proberen eerst de gepubliceerde
  DB-template; zonder publicatie valt 'ie terug op de bestaande opbouw (niets breekt). Alle
  6 call-sites kregen `await`.
- **Opslag** `lib/email/template-store.ts`: `EmailTemplate` (`@@unique([key, locale])`,
  concept-velden + `published*`-snapshot) + `EmailTemplateVersion` (geschiedenis).
  **Globale tabel, géén tenantId/RLS** (zoals AuditLog/ExerciseCatalog). Lui geseed uit de
  registry (idempotente `upsert`). Locale-veld is voorbereid; nu alleen `NL` gevuld
  (EN/FY-fallback → NL in `composeFromTemplate`).
- **Validatie** `lib/email/template-validate.ts` (puur): onbekende placeholder/leeg
  subject-body → **error** (blokkeert publiceren), ontbrekende verplichte placeholder →
  waarschuwing. Server dwingt af in `publishTemplate`; editor toont live.
- **UI** `app/admin/email-templates/`: overzicht (`page.tsx`), editor-pagina (`[key]/page.tsx`)
  + client-editor (`[key]/editor.tsx`) met **CodeMirror 6** (`@uiw/react-codemirror` +
  `@codemirror/lang-html`, dynamic `ssr:false` in `code-editor.tsx`; zoek/vervang +
  undo/redo via `basicSetup`), placeholder-invoegchips, autosave-concept, **live preview**
  in een sandboxed `<iframe srcDoc>` (device-toggle desktop/tablet/mobiel + tenant-selector
  → echte huisstijl + testgegevens-toggle), publiceren (bevestiging + versie), testmail
  (eigen adres + tenant) en versiegeschiedenis met herstellen.
- **Server-actions** `[key]/actions.ts` (`requireSuperadmin` + Zod): `saveDraft`,
  `renderPreview`, `publishTemplate`, `restoreVersion`, `resetToDefault`, `sendTestEmail`.
- **Audit**: nieuwe categorie `email` in `lib/audit-actions.ts` + acties
  `email.template.update/publish/restore/reset` en `email.test.send` (platform-niveau).

### Foutpagina's (premium error-architectuur)

Eén config-gedreven systeem zodat een gebruiker nooit een kale framework-fout
ziet — alle foutpagina's delen dezelfde premium shell, illustratie en
tenant-branding.

- **`lib/errors.ts`** = bron van waarheid (geen `server-only`, ook client-bruikbaar):
  `ERROR_PRESETS` voor **401/403/404/500/503** (kicker/titel/uitleg/tone/acties),
  `buildErrorNav(role)` (rol → juiste dashboard + ingelogd-status), `KNOWN_ROUTES`
  (rol-gefilterde bestemmingen) en de fuzzy-helpers (`levenshtein`, `suggestRoutes`,
  `isHighConfidence`) voor typo-detectie. **Nieuwe foutcode = één preset-regel.**
- **`components/error/`**: `error-layout.tsx` (client, herbruikbare shell — leest
  `useTenant()`, behoudt `?tenant=` op alle links, fade-in via `motion`),
  `error-illustration.tsx` (zwevende lijn-SVG per code, accent = `currentColor`),
  `route-suggestions.tsx` (client; "Bedoelde je…?" + **auto-redirect met countdown
  bij hoge zekerheid** + zoek/quick-links), `error-view.tsx` (**server-entry**:
  resolved `auth()` → rendert `ErrorLayout`; gebruik `<ErrorView code={…} />` voor
  élke foutcode).
- **Next-wiring**: `app/not-found.tsx` (404, auth-bewust + suggesties),
  `app/error.tsx` (500, client, met `reset`), `app/global-error.tsx` (catastrofaal —
  standalone `<html>`/`<body>`, géén providers, pure-CSS animaties),
  `app/forbidden.tsx` (403) en `app/unauthorized.tsx` (401).
- **Guards → interrupts**: `requireOwner/requireMember/requireSuperadmin` roepen
  `unauthorized()` (niet ingelogd) resp. `forbidden()` (verkeerde rol) aan i.p.v. te
  redirecten. Vereist **`experimental.authInterrupts: true`** (next.config.ts). N.B.:
  `proxy.ts` vangt de cross-area rol-mismatch op `/owner`↔`/member`↔`/admin` al af met
  een redirect (bewust — betere UX dan een 403); de guard-`forbidden()` is daar dus
  defense-in-depth en de echte 403-UX is voor andere `forbidden()`-call-sites.

## RLS-policies toepassen (vastgelegd in prompt 04)

De row-level-security policies staan in `prisma/sql/rls.sql` (buiten `prisma/migrations/`,
anders ziet `prisma migrate` het als een migratie).
- **Development**: toepassen met `npm run db:rls` (na een schema-migratie).
- **Productie/CI**: als aparte stap in de deploy-pipeline draaien na `prisma migrate deploy`.
- Elke query zet de tenant-context via `set_config('app.current_tenant', ...)` (zie
  `lib/tenant-db.ts`).
