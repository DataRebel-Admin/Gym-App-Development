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
  bij aiEnabled. Zonder API-key degradeert het netjes. **Uitgebreid tot AI Coach & Assistant —
  zie hieronder.**
- **Rooster (prompt 12)**: `GroupClass`/`ClassSession`/`ClassEnrollment`. Aanmelden is
  atomair (transactie respecteert `maxParticipants`); `@@unique([sessionId, userId])`.
- **PDF (prompt 13)**: `/member/schema/pdf` route-handler rendert met **pdf-lib**
  (geen native deps, betrouwbaarder in Next dan @react-pdf/renderer) en streamt als download.
- **Niet gebouwd (bewust)**: prompt 14 (i18n) — op verzoek overgeslagen.

### AI Coach & Assistant (modulaire, contextbewuste uitbreiding)

De single-purpose member-assistent is opgetild tot een **modulair, contextbewust
AI Coach & Assistant-fundament** voor coaches én sporters. Harde eis: **de AI wijzigt
nooit zelf data** — wijzigingen komen als gestructureerd *proposal* dat de gebruiker met
"Toepassen" bevestigt (roept een bestaande, geaudite action aan). Hergebruikt bewust de
provider-laag (Claude/OpenAI-switch + EU `inference_geo`), de guardrail, `AiUsage` en
`Tenant.aiEnabled`. **Geen DB-migratie.**

- **Modulaire kern `lib/ai/`**: `provider.ts` (`callModel({system,messages})` → tekst|null
  refusal; `aiConfigured()`), `types.ts` (`AssistantProposal`/`AssistantAnswer`/
  `AssistantResult`, puur — ook client), `surfaces/*` (per oppervlak één bestand:
  `base.ts` gedeelde preamble + `outputContract`, `member-home.ts`, `exercise.ts`,
  `member-profile.ts`, `registry.ts`), en `assist.ts` (orchestrator: `runSurfaceAssistant`
  → gate `aiEnabled` → rate-limit 20/dag/gebruiker (álle oppervlakken) → `surface.build`
  (tenant-gescopede context + system-prompt) → `callModel` → **defensieve JSON-parse**
  `{answer,proposals}` → `applySafetyGuardrail` → `AiUsage`-log). Faalt nooit hard.
  **Nieuw oppervlak = één bestand in `surfaces/` + één regel in `registry.ts`** (idioom
  `exercise-types.ts`/`achievements/definitions.ts`). `lib/ai.ts` is nu een dunne barrel.
- **Structured output**: `outputContract` instrueert het model UITSLUITEND JSON
  (`{answer, proposals[]}`) terug te geven; `assist.ts` parset defensief (geen JSON → hele
  tekst als answer, 0 proposals). Proposals dragen `kind`+`payload`; de AI voert `payload`
  **nooit** uit. Guardrail slaat aan → proposals vervallen.
- **Gedeelde UI `components/ai/`**: `assistant-panel.tsx` (herbruikbare chat-UI — chips,
  proposal-kaarten met "Toepassen", geïnjecteerde `ask`/`onApply` server-actions),
  `assistant-launcher.tsx` (zwevende member-bubble), plus `exercise-assistant.tsx` +
  `member-profile-assistant.tsx` (inline owner-kaarten). `components/assistant-widget.tsx`
  is een dunne wrapper hierop (gedrag op `/member` identiek).
- **Oppervlakken (deze ronde)**: `member-home` (bestaande sporter-bubble, informatief),
  `exercise` (member+owner oefening-detail via `assistantSlot` op `ExerciseDetailView`;
  uitleg/alternatieven/techniek; acties `app/{member/history,owner}/exercises/[id]/ai-actions.ts`),
  en **vlaggenschip** `member-profile` (coach-only, `/owner/members/[userId]`): vat voortgang
  samen (`getMemberStats`/`getDeltas`/`getGoals`) + suggesties, met proposal
  `save-summary-note` → `applyMemberProfileProposal` (hergebruikt `addCoachNote`, permissie
  `coachnotes:manage`, audit `coachnote.add`). Actions in
  `app/owner/members/[userId]/ai-actions.ts`.
- **Rol**: `aiRoleFor(Role)` mapt `TENANT_MEMBER→member`, `TENANT_ADMIN|TENANT_STAFF→coach`.
  Elke server-action dwingt zélf de permissie af (`requireMember`/`requirePermission`/
  `requireTenantUser`) en geeft de gebruiker door aan de orchestrator. Alles gegate op
  `aiEnabled`; zonder API-key nette degradatie. UI hardcoded NL (precedent muscle/achievements).

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
  template-pagina toont leden, status, publicatiedatum, **"Sinds"** (hoe lang het lid het al
  heeft), **geldigheid/verloop**, periode, laatst gewijzigd, gezien + aantal actief
  (`lib/schema-assignments.ts` → `toOverviewRows` serialiseert datums server-side → client
  filtert op status + aangepast + verloop). Statuslabels/kleuren + datum-/duurhelpers centraal
  in **`lib/schema-status.ts`** (`ASSIGNMENT_STATUS_META`, `isActiveNow`, `fmtDate/DateTime`,
  **`fmtSince`**, **`computeValidity`**).
- **Schema-geldigheid (verloop-flag)**: `WorkoutTemplate.validityWeeks Int?` (NULL =
  onbeperkt; migratie `20260701050000_schema_validity_weeks`) — ingevuld in de schema-editor,
  meegekloond naar elk lid-schema (`cloneToAssignment`/`duplicateTemplate`). `computeValidity`
  (lib/schema-status.ts) rekent vanaf de publicatiedatum: state `expired` → "Verlopen",
  `expiring` (≤14 dagen) → "Nieuw schema nodig". Getoond als badge in de Leden-lijst
  (`components/schema/member-schema-table.tsx`, met zoek + status/type/geldigheid-filters),
  het per-schema-overzicht en het per-lid-detail. Alleen kracht/alle-types agnostisch — puur
  op datum.
- **Audit** (lib/audit-actions.ts): `schema.reassign`, `schema.publish`, `schema.schedule`,
  `schema.archive`, `schema.notify.sent`, `schema.email.sent` — alle onder categorie `schemas`.
- **Bewust niet gebouwd**: lidmaatschapsgroepen (toewijs-flow is er wel op voorbereid via
  multi-select; "filter op groep" volgt zodra een MemberGroup-model bestaat).

### Leden bouwen zelf een schema (self-service, coach houdt controle)

Een lid kan **zelf een trainingsschema samenstellen** binnen door de sportschool
gestelde kaders, met optionele goedkeuring. Hergebruikt volledig de bestaande
`WorkoutTemplate → WorkoutDay → WorkoutExerciseItem`-structuur, de dynamische
oefeningstypes/params en de `AssignedWorkout`-zichtbaarheidslogica.

- **Controle-modus per tenant**: `Tenant.memberSchemaMode` (`enum MemberSchemaMode
  DISABLED | APPROVAL | DIRECT`, default DISABLED — opt-in). Owner kiest op
  `/owner/settings` (`setMemberSchemaMode`). DISABLED = functie uit; APPROVAL = lid
  dient in → coach keurt goed; DIRECT = lid activeert zelf (gym ziet mee).
- **Lid-levenscyclus op `AssignedWorkout`** (naast de zichtbaarheids-`status`):
  `origin AssignmentOrigin (COACH|MEMBER)`, `memberStatus MemberSchemaStatus
  (DRAFT|IN_REVIEW|APPROVED|REJECTED|ACTIVE|PAUSED)`, `submittedAt/reviewedAt/
  reviewedById/reviewNote`, `goal SchemaRequestGoal?`, `focusNote`, `frameworkId`.
  **Statusbrug** houdt bestaande zichtbaarheid intact: DRAFT/IN_REVIEW/REJECTED/APPROVED →
  `status=DRAFT` (verborgen), ACTIVE → `status=PUBLISHED` (zichtbaar via het ongewijzigde
  `getAssignedSchema`), PAUSED → `status=ARCHIVED`.
- **Kaders (`SchemaFramework`, tenant-scoped + RLS)**: toegestane oefeningen/types,
  min/max dagen, oefeningen-per-dag, sets/reps/rust, en `requireApproval`-override.
  Resolutie per lid: **per-lid koppeling (`MemberFrameworkAssignment`, uniek per lid) →
  tenant-default (`isDefault`) → geen** (vrij). Owner beheert op
  `/owner/schemas/frameworks` (+ `[id]`) en koppelt per lid op het lid-schema-profiel.
  Validatie is puur in **`lib/member-schema-constraints.ts`** (`validateAgainstFramework`,
  `isExerciseAllowed`, `describeLimits`) — de mobiele builder gebruikt het live
  (picker filteren, invoer clampen) én de server-action autoritatief (nooit de client
  vertrouwen; minimums pas bij indienen).
- **Startsjablonen = beide**: code-blueprints `lib/member-schema-blueprints.ts` (Full body,
  Upper/Lower, PPL, Cardio, Kracht, Conditie, Herstel, leeg) + door de owner vrijgegeven
  library-templates (`WorkoutTemplate.memberVisible`, toggle op de template-pagina).
- **Mobile-first lid-builder** (`app/member/schema/builder/*`,
  `components/member/member-schema-editor.tsx`): eigen mobiele editor die de pure logica
  hergebruikt (exercise-types/params, dnd-kit, autosave, type-bewuste velden) — géén
  owner-links. Zoeken, favorieten (`User.preferences.favoriteExerciseIds`), kopieer vorige
  dag, dupliceer oefening, voortgangsindicator, live voorbeeld. Serialisatie-contract
  identiek aan de owner-editor → gedeelde opslaglogica. Server-actions
  (`app/member/schema/builder/actions.ts`): `startMemberSchema`, `saveMemberDraft`
  (autosave) en `submitMemberSchema` delen `persistDraft` (voorkomt save-race bij
  indienen); verder `activateMemberSchema`, `pauseMemberSchema`, `deleteMemberSchema`,
  `setFavoriteExercises`. Toegang gegate via `requireMemberSchemaEnabled` (lib/member-schema.ts).
- **Coach-review** (`/owner/schemas/member-built` + `[id]`): queue van ingediende schema's;
  de coach opent het lid-schema in de bestaande owner `SchemaEditor` (het is een gewone
  niet-library `WorkoutTemplate`) om te bewerken, en keurt goed / goed+activeer / af
  (`reviewMemberSchema` in `app/owner/schemas/actions.ts`).
- **Meldingen** (`lib/member-schema-notify.ts`): indienen → coaches met `schemas:manage`
  (in-app via `notifyStaffWithPermission` + e-mail `memberSchemaSubmittedMessage`);
  beoordeling → lid (in-app + e-mail `memberSchemaReviewedMessage`). Best-effort.
- **Audit** (categorie `schemas`): `schema.member.start/submit/approve/reject/activate/pause`
  + `schema.framework.save/delete/assign`.
- **Bewust**: de 3-weg-sync/bulk-edit gelden alleen voor coach-master-schema's; zelf-gebouwde
  schema's hebben geen master (`sourceTemplateId = null`).

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

### Actieve-workout flexibiliteit (timers, skip, alternatief, annuleren, timeout)

Tijdens een actieve sessie kan het lid snel bijsturen zonder het template te muteren.
Alle timeracties lopen via de bestaande enkele rusttimer (`useRestTimer` → `timer.dismiss()`)
zodat er niets doorloopt na skippen/vervangen/afronden/annuleren.

- **Datamodel** (migratie `20260701140000_active_workout_flow`, geen RLS-wijziging —
  `WorkoutSession` is al tenant-scoped): `WorkoutSession.autoStoppedAt`/`autoStopNotified`
  (5-uur-timeout + eenmalige melding, patroon van `notifiedAt`/`seenAt`) en `overrides Json?`
  (sessie-scoped `{ skipped: string[], subs: {from,to,name}[] }`). Pure helpers in
  **`lib/session-overrides.ts`** (`parseOverrides`/`withSkipped`/`withoutSkipped`/`withSub`/
  `toOverridesJson`) — **altijd gekeyed op de oorspronkelijke template-oefening (`from`)** zodat
  overslaan en vervangen elkaar niet in de weg zitten. Globale timer-voorkeur in
  `User.preferences.disableSetTimers` (`lib/user-preferences.ts`, geen migratie).
- **Timers (per sessie + globaal)**: globale default via `getDisableSetTimers` → prop
  `timersDefaultOn` naar `ActiveSession`; per-sessie override in **localStorage**
  (`gymrebel-session-timers-<sessionId>`, overleeft reload, wint van de default). Header-toggle
  (Timer-icoon) + scope-regel ("deze sessie" vs "standaard"). Uit ⇒ geen auto-`startRest`,
  geen trilling/geluid; toggle naar uit stopt direct een lopende timer. Globale toggle op
  `/account/meldingen` (`components/account/timer-toggle.tsx` → `setSetTimerPreference`).
- **Overslaan**: `skipExercise`/`unskipExercise` (optimistisch, bevestiging via `Modal`);
  overgeslagen oefeningen tellen niet mee in voortgang/afronden (laatste-oefening-skip →
  completion) en renderen als collapsed kaart met undo. Timer `dismiss()` bij skip.
- **Alternatief** (apparaat bezet): `lib/exercise-alternatives.ts` `findAlternatives` scoort
  tenant-oefeningen op spiergroep (via `resolveRegion`), `exerciseType`, bodyPart en materiaal
  — nette lege staat als niets past. `getExerciseAlternatives` (lazy) + `substituteExercise`
  registreren de vervanging in `overrides.subs` en retourneren de vervanger-identiteit; de
  client swapt in-place (schema/type van origineel behouden, log fris; inner block krijgt
  `key={ex.exerciseId}` → schone remount). Betere aanbevelingen = rijkere catalogus/eigen-
  content-velden op `Exercise`.
- **Afronden/annuleren**: `endSession` stopt de klok direct (redirect weg → niet meer actief).
  **Annuleren** (`cancelSession`, subtiel + bevestiging in het afrondscherm) **verwijdert de
  sessie hard** (entries cascaden) → telt gegarandeerd niet mee in stats/PR's (die tellen
  volume uit álle sessies, ook niet-afgeronde). Terug naar `/member/schema`.
- **5-uur-timeout**: `lib/session-timeout.ts` `enforceSessionTimeout` (lazy, best-effort, géén
  cron) capt `endedAt` op `startedAt+5u` + zet `autoStoppedAt`; aangeroepen op `/member`,
  `/member/schema` en `/member/schema/active`. De auto-gestopte sessie **telt normaal mee**
  (duur gecapt). Eenmalige banner op `/member/schema` via `autoStopNotified`
  (`MarkAutoStopSeen`). Botst niet met handmatig afronden/annuleren (alleen `endedAt==null`).
- **Tests**: `tests/session-overrides.test.ts` (`node:test` via tsx, `npm test` — geen nieuwe
  dep). i18n-keys onder `member.active`/`member.schema` (nl+en; fy valt terug op nl).

### Spier-heatmap & -analyse (lid)

Een lid ziet op **`/member/muscles`** welke spiergroepen zijn schema traint (body-
heatmap) en of hij het schema volgt (radar: **schema-plan vs. echt getraind, 4 wkn**).
Volledig afgeleid — géén nieuw DB-model, géén migratie.

- **`lib/muscle-map.ts`** (puur, ook client — zoals `exercise-types.ts`): 16 canonieke
  `MuscleRegion`'s (chest/shoulders/biceps/…/calves) met NL-label + aanzicht (front/back).
  `RAW_TO_REGION` normaliseert de vrije spier-labels uit de catalogus (`target`,
  `secondaryMuscles`) én eigen oefeningen (`targetMuscle`, `muscleGroups`) naar een regio;
  `resolveRegion()` is de enige lookup. Volume-schaal `MUSCLE_LEVELS` (0=grijs…5=donkergroen)
  + `levelForWeeklySets()` (grenzen ~hypertrofie-richtlijn).
- **`lib/muscle-analysis.ts`** (`server-only`): `getMuscleAnalysis(memberId, tenantId)` telt
  wekelijks set-volume per regio uit het actieve schema (**plan**, aanname 1×/week) en uit de
  laatste 28 dagen `PerformanceEntry` (**echt getraind**, ÷4). Primaire spier telt vol,
  secundaire half (0.5). Serialiseert `regions[]` (plan/actual/level) + `topRegions`/`neglected`.
  Base `prisma` + expliciete `tenantId` (zoals `member-stats.ts`).
- **Visuals** (client): `components/muscle/body-heatmap.tsx` — een **anatomisch mensfiguur**
  (viewBox 400×900): grijs silhouet (torso/arm/been) met daaroverheen contour-paths per spier
  (delts, pecs, 6-pack, obliques, quad-koppen, kuiten resp. traps/lats/erector/glutes/hamstrings
  op de rugweergave). Elke vorm is de **linkerhelft**; de rechterhelft komt uit `mirrorPath()`
  (spiegelt M/L/C/Z om x=200) → altijd symmetrisch. Eén regio kan meerdere vormen hebben
  (quads = 3, abs = 4 blokken) die dezelfde `MuscleRegion` + kleur + klik delen. Klikbaar,
  front/back-toggle, niveau-legenda. `components/muscle/muscle-comparison.tsx`
  — per-spiergroep "bullet"-balken (accent-vulling = echt getraind, streepje = schema-doel) met
  bovenaan een therapietrouw-ring (% van gepland volume gehaald); vervangt de eerdere radar —
  duidelijker af te lezen welke spiergroepen achterblijven ("Achter") of extra getraind worden ("Extra").
- **Ingangen**: drawer-link, tikbaar spiergroep-blok op `/member` en een link op `/member/schema`.
  Toont "geen medisch advies"-melding (ontwerpprincipe 2). Nog niet i18n-gemigreerd (hardcoded NL,
  zoals `/member/progress`).

### Trofeeën, Achievements & Mijlpalen (Gym Passport)

Een motivatielaag die de bestaande trainings-/meet-/doeldata beloont met trofeeën, een
digitaal **Gym Passport** en automatisch gevierde mijlpalen. **Optioneel** en
**niet-brekend** (alles afgeleid — geen bestaande functionaliteit gewijzigd).

- **Opt-in**: per tenant `Tenant.achievementsEnabled` (owner-toggle op `/owner/settings`) **én**
  per lid verbergbaar (`User.preferences.hideAchievements`, toggle op `/account/meldingen`).
  Zichtbaarheids-helper `getAchievementUiState()` (lib/achievements/evaluate.ts) → `{enabled,
  hidden, visible}`.
- **Config-gestuurd (bron van waarheid, uitbreidbaar)** — idiomatisch zoals
  `lib/exercise-types.ts`/`training-goals.ts` (géén `server-only`, ook client-badges):
  **`lib/achievements/definitions.ts`** (`ACHIEVEMENTS[]` — key/category/rarity/metric/threshold;
  categorieën training|consistency|strength|cardio|goals|community) + **`rarity.ts`**
  (`bronze→legendary` styling). **Nieuwe achievement = één record**, geen migratie.
- **Engine** (`server-only`): **`metrics.ts`** `computeMemberMetrics` (leidt alles af uit
  `WorkoutSession`/`PerformanceEntry`/`Measurement`/`MemberGoal`/`User`; `goalsAchieved`
  hergebruikt `getGoals` uit lib/measurements). **`evaluate.ts`** `evaluateAndAward` (idempotent
  via `@@unique([tenantId,userId,key])` + `createMany skipDuplicates`) + `getAchievementsView`
  (behaald/vergrendeld/voortgang gegroepeerd) + `getPendingCelebrations`/`markCelebrated`.
  **`passport.ts`** `buildPassport` (stempels + levensfeiten). **`notify.ts`**
  `notifyAchievementsEarned` (in-app/push/e-mail, categorie **`achievements`**, `prefAllows`-gate,
  patroon van schema-notify). **`coach.ts`** `getCoachEngagement`.
- **Model `EarnedAchievement`** (tenant-scoped + RLS; migratie `20260701090000_achievements`):
  bewaart alleen wélke (`key`) + wanneer (`earnedAt`), met gedenormaliseerd category/rarity/value
  en `celebratedAt`. Definities blijven code-gestuurd.
- **Award-triggers** (best-effort, breken de actie nooit): `endSession`
  (app/member/schema/actions.ts), meting/doel-mutaties
  (app/owner/members/[userId]/progress/actions.ts), én **lazy** bij het openen van `/member/trophies`.
- **Celebration**: `celebratedAt==null` → `CelebrationOverlay` (confetti + `navigator.vibrate`,
  één-voor-één, `useReducedMotion`), gemount in `app/member/layout.tsx` (dekt álle pagina's, ook
  post-workout `/member/history`).
- **Leden-UI**: `/member/trophies` (kaarten + rariteit + voortgangsringen/-balken) en
  `/member/passport`; dashboard-widget `AchievementDashboardSummary` op `/member`; drawer-entry.
  Componenten in `components/achievements/`.
- **Coach/profiel**: `/owner/engagement` (`CoachOverview`, permissie `members:view`, `?mine=1`
  scoopt op coach-koppeling) — recente mijlpalen, bijna-behaald, langste streaks, meest actief,
  stale; compacte sectie op `StaffDashboard`; `MemberProfileAchievements` op `/owner/members/[userId]`.
- **Audit**: nieuwe categorie **`engagement`** + acties `achievement.earned`,
  `achievement.notify.sent`, `milestone.reached`.
- **Voorkeuren** consolideren in `lib/user-preferences.ts` (`getHideAchievements`/
  `withHideAchievements`, naast de Workout-Quotes-helpers). **i18n**: registry-titels hardcoded NL
  (precedent `training-goals.ts`/`staff-dashboard.tsx`); alleen de meldingscategorie is toegevoegd.
- **Seed**: `seedAchievements("fitpower")` in `prisma/seed.ts` zet de vlag aan + kent demo-trofeeën
  toe (zelfstandige tier-tabellen — importeert bewust **niet** de `server-only` engine, die throwt
  onder tsx).

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

### Sportschoolmedewerker (TENANT_STAFF) + permissie-gestuurd RBAC

Vierde rol **`TENANT_STAFF`** (Sportschoolmedewerker/coach): tenant-gebonden coachrol met
**per-medewerker in-/uitschakelbare permissies**. RBAC is van "vaste rollen" naar
**permissie-gestuurd** getild — de rol levert alleen de *defaults*.

- **`lib/rbac.ts`** (puur, ook client): `Permission`-union uitgebreid met feature-permissies
  (`schemas:manage`, `members:view`, `measurements:manage`, `coachnotes:manage`,
  `schedule:manage`, `exercises:manage`) + standaard-uit extra's (`members:import`,
  `reports:export`, `mailings:send`). `STAFF_CONFIGURABLE_PERMISSIONS` = wat een eigenaar per
  medewerker mag toewijzen (beheer-permissies nooit). `getEffectivePermissions(role, overrides)`
  (admin = volledige superset; staff = role-default + override), `hasPermission(user, perm)`,
  en `PERMISSION_GROUPS` (gegroepeerde catalogus → voedt de rechtenmatrix).
- **Opslag**: `User.permissions Json?` = `Record<Permission, boolean>` (null = role-default).
  Geen nieuw model — kolom op `User`, zoals `notificationPrefs`/`dashboardLayout`.
- **`/owner` = gedeelde tenant-werkruimte** voor admin + staff. **`lib/staff.ts`**:
  `requireTenantUser()` (admin óf staff, levert effectieve permissies) en
  `requirePermission(perm)` (admin passeert altijd, anders `forbidden()`). `requireOwner()`
  blijft **admin-only** (settings, audit, insights, machines, ledenadministratie, `/owner/staff`).
  Gedeelde pagina's/actions (schemas/exercises/rooster/requests/leden-view/metingen) zijn
  omgezet naar `requirePermission`. `proxy.ts` laat staff toe op `/owner`.
- **Navigatie permissie-gefilterd** in `app/owner/layout.tsx` (`filterNav` + `permission`/
  `adminOnly` op de nav-entries) — staff ziet alleen wat mag (geen verborgen-functie-fouten).
  **Rolbadge** (Eigenaar/Medewerker) in de header. Leden-lijst & ledenprofiel renderen een
  **read-only variant** voor staff (geen invite/rol/verwijderen); profieltabs zijn
  permissie-gefilterd.
- **Medewerkersbeheer** op **`/owner/staff`** (admin-only): uitnodigen (hergebruikt
  `inviteMember` met `role=TENANT_STAFF`), (de)activeren/verwijderen/opnieuw uitnodigen
  (hergebruikt `app/owner/members/actions.ts`; `tenantRole`-zod uitgebreid met `TENANT_STAFF`),
  en de **rechtenmatrix** (`components/staff/permission-matrix.tsx` → `setStaffPermissions`
  in `app/owner/staff/actions.ts`, `requireOwner` + `role:assign`). `listMembers` sluit staff
  bewust uit (filter admin+member); de staff-pagina queryt `TENANT_STAFF` apart.
- **Coachnotities** (nieuw): model `CoachNote` (tenant-scoped + RLS), `lib/coach-notes.ts`,
  tab "Coachnotities" op het ledenprofiel (`/owner/members/[userId]/notes`,
  `requirePermission("coachnotes:manage")`) met toevoegen/bewerken/pinnen/verwijderen.
- **Rol-bewust dashboard**: `app/owner/page.tsx` toont voor staff `StaffDashboard`
  (`components/dashboard/staff-dashboard.tsx`) — leden-actief-vandaag, openstaande
  schema-aanvragen, nieuwe metingen, aankomende lessen, snelle acties — alles permissie-gegate;
  géén audit/financiële data.
- **Notificaties**: `lib/staff-notify.ts` (`notifyStaffWithPermission`) informeert tenant-
  gebruikers met een bepaalde permissie. Schema-aanvraag-melding (`lib/schema-requests-notify.ts`)
  bereikt nu ook staff met `schemas:manage`; nieuwe les → staff met `schedule:manage`
  (categorie `changes`).
- **Audit**: `user.permissions.change` + `coachnote.add/update/delete` (categorie `members`).
  Uitnodigen/rol/(de)activeren/verwijderen loggen via de bestaande `user.*`-acties.
- **Migratie** `20260701030000_tenant_staff_rbac` (handgeschreven, conform de Prisma-
  beperking): `ALTER TYPE "Role" ADD VALUE 'TENANT_STAFF'` + `User.permissions` + `CoachNote`.
  RLS in `prisma/sql/rls.sql` (`npm run db:rls`). Seed: demo-medewerker `coach@fitpower.nl`.
- **Coach↔lid-koppeling**: model **`CoachAssignment`** (tenant-scoped + RLS; many-to-many,
  `@@unique([tenantId, coachId, memberId])`, migratie `20260701040000_coach_assignment`).
  Helpers in **`lib/coach-assignments.ts`** (`listMemberCoaches`, `listAvailableCoaches`,
  `listCoachMembers`, `countCoachMembers`); `lib/members.ts` kreeg een `coachId`-filter
  (→ "Mijn leden"). Beheer (admin) op het **ledenprofiel** (`assignCoach`/`unassignCoach` in
  `app/owner/members/actions.ts`): koppelen stuurt een **"Nieuw lid toegewezen"**-melding
  (`notifyInApp`, categorie `new_members`) naar de coach + audit (`coach.assign`/`coach.unassign`).
  De coach ziet z'n leden via de **"Mijn leden"**-toggle op `/owner/members?mine=1` en een
  **"Mijn leden"**-blok op het `StaffDashboard`. De koppeling is additief (een lens), geen
  restrictie: staff met `members:view` ziet nog steeds alle leden.
- **Zelf-toewijzen (optioneel)**: permissie **`members:assign-self`** (toewijsbaar in de matrix,
  standaard uit). Zet de eigenaar 'm aan, dan krijgt de medewerker op het ledenprofiel een
  knop "Mij koppelen/loskoppelen als coach" (`selfAssignCoach`/`selfUnassignCoach` in
  members/actions.ts, `requirePermission("members:assign-self")`, `coachId` geforceerd op
  zichzelf). Eigenaar-toewijzing (elke coach kiezen) blijft via `assignCoach`/`unassignCoach`.
- **"Eigen planning"** op het dashboard toont tenant-brede lessen (geen trainer-FK,
  `GroupClass.instructorName` is vrije tekst).

### Slim onderhoudsbeheer voor machines

Automatische signalering wanneer een machine onderhoud nodig heeft op basis van
**gebruik** of **tijd**, met onderhoudsdashboard, historie en meldingen. Volledig
geïntegreerd in de bestaande tenant-ervaring (RBAC/meldingen/audit/cron/whitelabel).

- **Datamodel**: `Machine` uitgebreid met inventaris (`location`/`serialNumber`/`purchaseDate`)
  en onderhoud (`status MachineStatus`, `usageCount`, `usageThreshold`,
  `maintenanceIntervalDays`, `lastMaintenanceAt`, `nextMaintenanceAt`,
  `maintenanceDueNotifiedAt`/`maintenanceWarnNotifiedAt` als idempotente melding-markers).
  Nieuwe tenant-scoped + RLS modellen: **`MaintenanceRecord`** (volledige historie; `kind
  MaintenanceKind SERVICE|INSPECTION|SAFETY_CHECK|REPAIR` = extensiepunt voor inspecties/
  keuringen) en **`MaintenancePolicy`** (standaardregels per `MachineType`, uniek per tenant+type).
  Enums `MachineStatus {ACTIVE|MAINTENANCE_DUE|IN_MAINTENANCE|OUT_OF_SERVICE}`. Migratie
  `20260701110000_machine_maintenance` (+ RLS in `prisma/sql/rls.sql`).
- **Pure logica** `lib/maintenance.ts` (geen `server-only`, ook client): `MACHINE_STATUS_META`/
  `MAINTENANCE_KIND_META`, `INTERVAL_PRESETS`, `computeMaintenanceState(machine,now)` →
  niveau `ok|soon|due` (zwaarste van gebruik/tijd; soon = ≥80% teller óf ≤14 dagen),
  `effectiveStatus` (handmatige status IN_MAINTENANCE/OUT_OF_SERVICE leidend, anders afgeleid),
  `computeNextMaintenance`, formatters. **Server** `lib/maintenance-eval.ts` (`server-only`):
  `getMaintenanceOverview` (geserialiseerde rijen + tellers; draait lazy `evaluateDueMachines`),
  `evaluateDueMachines` (ACTIVE↔MAINTENANCE_DUE transitie, levert due/soon-ids), `recordMachineUsageForSession`,
  `getMaintenanceAttentionCount` (dashboard-alert).
- **Gebruikstelling**: `endSession` (app/member/schema/actions.ts) telt +1 per gebruikte
  machine (via `PerformanceEntry`→`Exercise.machineId`), evalueert en meldt drempels — best-effort.
- **Tijd-trigger**: **Vercel Cron** `app/api/cron/maintenance-check` (`vercel.json`, dagelijks
  `0 6 * * *`, Bearer `CRON_SECRET`) + lazy check bij dashboard-open.
- **Meldingen** `lib/maintenance/notify.ts`: naar tenant-gebruikers met permissie
  `maintenance:manage`, respecteert voorkeuren (**nieuwe categorie `maintenance`**) over
  in-app/push/e-mail. `notifyMaintenanceThresholds` (idempotent via markers) +
  `notifyMaintenanceEvent` (uitgevoerd/status). E-mail via composer `maintenanceAlertMessage`
  (lib/email/messages.ts, non-DB-template zoals de schema-request-composers).
- **RBAC**: nieuwe medewerker-configureerbare permissie **`maintenance:manage`** (standaard aan,
  in `PERMISSION_GROUPS`). Machine-CRUD (`/owner/machines`) blijft **admin-only** (`requireOwner`);
  het onderhoudsbeheer (`/owner/maintenance` + actions) draait op `requirePermission`.
- **Server-actions** `app/owner/maintenance/actions.ts`: `saveMaintenanceRules`, `logMaintenance`
  (record + reset teller + status ACTIVE + herbereken volgende datum), `setMachineStatus`,
  `adjustUsage`, `saveMaintenancePolicy` (+ optioneel bestaande bijwerken). Inventarisvelden
  toegevoegd aan `machineSchema`/`saveMachine`; create past de type-policy toe.
- **UI**: `/owner/maintenance` (`MaintenanceDashboard`) — samenvattingskaarten (klikbaar filter),
  filterbalk (status/type/locatie/zoek), machinekaarten met statusbadge + gebruiksvoortgang +
  snelle acties, `MaintenanceCalendar`, historie-tabel. `MachineMaintenancePanel` op het
  machine-detail (regels/status/teller/historie). Statusbadge-kolom op de machinelijst.
  Dashboard-`MaintenanceAlert` op owner- én staff-dashboard (permissie-gegate). Componenten in
  `components/maintenance/`. UI hardcoded NL (precedent muscles/engagement).
- **Audit** (categorie `machines`, prefix `machine.`): `machine.maintenance.rule/performed/
  due/warn/notify.sent/policy`, `machine.status.change`, `machine.usage.adjust`.
- **Seed**: fitpower-machines krijgen regels + variatie (Loopband "onderhoud nodig", Crosstrainer
  "binnenkort", Beenpers "buiten gebruik") + demo-`MaintenanceRecord`s.

### QR-bulkexport voor apparaten (printbare labels)

Eén handeling om álle (of een selectie van) QR-codes van apparaten te downloaden als
**printbare A4-PDF** of **ZIP** met losse bestanden. Geïntegreerd in het bestaande
apparaatbeheer. De QR-codes zijn **whitelabel-gestyled** (zie "Gestylde QR-codes +
scan-tracking" hieronder) — afgeronde modules in de tenant-accentkleur + midden-logo,
niet de standaard zwart-witte blokjes. PDF via `pdf-lib`, ZIP dependency-vrij,
PNG-rasterisatie via `@resvg/resvg-js`.

- **Modulaire kern `lib/qr-export/`** — puur/gedeeld waar mogelijk, `server-only` waar nodig
  (idioom `lib/schema-pdf.ts`/`lib/email/`): `types.ts` (pure types + `LAYOUT_PRESETS` +
  `expectedPageCount`, ook client), `filename.ts` (`safeFilename`/`numberedFilename`
  → `Loopband-01.png` + `dedupeFilenames`), `zip.ts` (**dependency-vrije store-only ZIP-writer**,
  CRC32 + central directory; PNG/SVG zijn al compact), `qr-matrix.ts` (pure matrix via
  `qrcode`, foutcorrectie **H**), `qr-style.ts` (pure gestylde geometrie/SVG, zie sectie
  hieronder), `qr.ts` (`server-only`: `qrStyledSvg`/`qrSvgBytes` + `qrPngBytes` via resvg +
  `loadLogoDataUri`), `labels-pdf.ts` (`buildQrLabelsPdf(groups, options)` — A4-raster 2×4 of
  3×5, gestylde vector-QR via `page.drawSvgPath` + midden-logo,
  apparaatnaam/nummer/serienummer/categorie/locatie + tenantlogo & -naam, snijlijnen,
  branded kop/voet; elke tenant-groep start op een verse pagina → superadmin "alle tenants"),
  `archive.ts` (`buildQrZip` — submap per tenant bij multi), `data.ts` (`server-only`:
  `getExportGroupForTenant`/`getExportGroupsForTenants`, tenant-scoped, **stabiele nummering**
  over alle machines = createdAt asc), `respond.ts` (`buildQrExport` + `parseExportOptions`,
  gedeeld door beide routes), `post-download.ts` (client: POST-via-verborgen-formulier zodat
  grote id-selecties in de body passen — geen URL-lengtelimiet).
- **Routes** (model `app/member/schema/pdf/route.ts`): owner/medewerker
  `app/owner/machines/qr-export/route.ts` (GET+POST, `requirePermission("machines:qr-export")`);
  superadmin `app/admin/qr-export/download/route.ts` (GET+POST, `requireSuperadmin`, `tenantId`
  specifiek of `all`, per-tenant audit). Beide streamen PDF/ZIP met `Content-Disposition`.
- **RBAC**: nieuwe medewerker-configureerbare permissie **`machines:qr-export`** (standaard uit;
  in `PERMISSION_GROUPS` groep "Apparaten & onderhoud"). De machinelijst `/owner/machines` is
  daardoor bereikbaar voor staff mét de permissie in een **read-only variant** (`canManage =
  isAdmin`; CRUD-actions blijven `requireOwner`). Nav-item van `adminOnly` → `permission`.
- **UI**: `components/qr-export/qr-export-dialog.tsx` (gedeelde modal: bron
  selectie/filter/alles, formaat PDF/ZIP-PNG/ZIP-SVG, opmaak-opties, **live voorvertoning** —
  aantal + pagina-schatting + HTML-mock-raster). Owner: `machines-table.tsx` uitgebreid met
  multi-select + filters (type/status/locatie) + exportknop. Superadmin: `/admin/qr-export`
  (`components/qr-export/admin-qr-export.tsx` — tenant-kiezer + selecteerbare lijst + "alle
  tenants"-bundel) + nav-item + snelkoppeling op tenant-detail. UI hardcoded NL.
- **Audit** (categorie `machines`): `machine.qr.export` (`count` + `format`).

### Gestylde QR-codes + scan-tracking

QR-codes zijn **whitelabel-gestyled** (niet de standaard blokjes) en er wordt bijgehouden
**hoe vaak elke apparaat-QR gescand is**. Deelt de export-infra hierboven.

- **Gedeelde, pure renderer** `lib/qr-export/qr-style.ts` (géén `server-only`, ook client —
  idioom `exercise-types.ts`): `qrGeometry(matrix, opts)` → vector-pad (`accentPath` =
  afgeronde modules + finder-buitenring + pupil; `holePath` = witte ring in de ogen;
  `logoRect` = midden-badge) in een unit-grid met **bezier-hoeken** (identiek in SVG én
  pdf-lib). `renderStyledQrSvg` → self-contained SVG (accent-modules, afgeronde ogen, witte
  logo-badge + `<image>`). `resolveQrColor` bewaakt contrast (te licht accent → donkergrijs).
  Matrix uit `qr-matrix.ts` (pure, `qrcode`, **foutcorrectie H** i.v.m. logo-overlay).
- **Één renderer → alle formaten**: SVG-bestand + PDF (`drawSvgPath`, vector) + PNG
  (rasterisatie via **`@resvg/resvg-js`** — native addon, staat in `serverExternalPackages`
  in `next.config.ts`; leest geen remote URL's → logo als data-URI via `loadLogoDataUri`).
- **Losse download**: `app/owner/machines/[id]/qr/route.ts` (GET `?format=png|svg`,
  `requireOwner`) hergebruikt de renderer → pixel-identiek aan de bulk-export. Machine-detail
  toont een gestylde preview (server → data-URI `<img>`) + PNG/SVG-links.
- **Scan-tracking**: `Machine.scanCount`/`lastScannedAt` (gedenormaliseerd) + logmodel
  **`MachineScan`** (tenant-scoped + RLS; migratie `20260704120000_machine_qr_scans`).
  Tellen via **client-beacon** (`components/machine/track-scan.tsx` → POST
  `app/m/[qrToken]/scan/route.ts`) met `sessionStorage`-dedupe; bots/link-previews draaien
  geen JS → tellen niet. Route is best-effort (breekt de scan-ervaring nooit), koppelt
  `userId` alleen bij een ingelogd lid van dezelfde tenant. Aggregaties in
  `lib/machine-scans.ts` (`getScanOverview` → tabelkolom "Scans" + `↑ n deze week`;
  `getMachineScanTrend` → 12-weken-grafiek `components/machine/scan-trend-chart.tsx`).
- **Bewust niet**: scans worden niet geaudit (te veel ruis); geen feature-flag (QR is kern).

### Feature flags (Superadmin, per tenant)

Centraal, uitbreidbaar systeem waarmee de **Superadmin** per tenant bepaalt welke
modules beschikbaar zijn (subscription-tiers/pilots/tenant-config). Uitgeschakeld =
volledig weg (nav, pagina's, directe URL's, API, meldingen, widgets); bestaande data
blijft bewaard. **Geen hardgecodeerde aan/uit-controles verspreid door de code** — één
service die frontend én backend delen.

- **Code-registry `lib/features/catalog.ts`** (géén `server-only`, ook client — idioom
  `exercise-types.ts`/`audit-actions.ts`) = bron van waarheid. `FeatureKey =
  maintenance | group_classes | ai`; per record `name/description/icon/defaultEnabled`.
  **Nieuwe feature = één record hier** (+ de flag checken op de relevante plek). Defaults
  behouden bestaand gedrag (allemaal `true`).
- **Opslag**: model **`FeatureFlag`** (`@@unique([tenantId, key])`, tenant-scoped + RLS;
  migratie `20260701130000_feature_flags`) — `enabled` + `updatedById/updatedByEmail`
  (laatste-wijziging-metadata voor de UI). Ontbreekt een rij → code-default. Sleutels zijn
  vrije strings (géén enum → uitbreidbaar zonder migratie).
- **Service `lib/features/service.ts`** (`server-only`): `getTenantFeatures(tenantId)`
  (per-request `cache()`, defaults + DB-overrides), `isFeatureEnabled`,
  `getCurrentTenantFeatures`, **`requireFeature(tenantId, key)`** (→ `notFound()` bij uit —
  blokkeert directe URL/API), `getFeatureFlagRows` (beheer-UI), `setFeatureFlag` (upsert +
  audit; alléén achter `requireSuperadmin`). Wijzigingen zijn direct actief (cache leeft één
  request; action `revalidatePath`).
- **Masterschakelaar-patroon**: waar al een owner-toggle bestond, is de feature-flag de
  laag daarboven (beide moeten aan). `ai` = flag ∧ `Tenant.aiEnabled` → **`lib/ai/enabled.ts`
  `isAiEnabled`** (gebruikt door member-widget, owner exercise/member-profile-kaarten, en de
  gate in `lib/ai/assist.ts`). `group_classes` = flag ∧ `Tenant.classesEnabled` → verwerkt in
  **`lib/classes.ts` `areClassesEnabled`** (dé resolver; member/owner-nav + rooster-pagina's/
  actions + member enroll gebruiken 'm al). `maintenance` heeft geen owner-toggle → puur de flag.
- **Handhaving maintenance**: owner-nav (`disabledHrefs` in `app/owner/layout.tsx`),
  `/owner/maintenance` + actions (`requireFeature`), dashboard-alert (owner + staff),
  meldingen (`lib/maintenance/notify.ts` early-return), cron `maintenance-check` (skip),
  usage-hook in `endSession`, en de machine-detail/lijst onderhouds-UI.
- **Beheer-UI `/admin/features`** (`app/admin/features/`): tenant-kiezer
  (`components/admin/feature-tenant-picker.tsx`) + kaarten met naam, omschrijving, status,
  laatste-wijziging + toggle-switch **met bevestigingsdialoog**
  (`components/admin/feature-flags-manager.tsx` → `toggleFeature`-action). Nav-item in
  `app/admin/layout.tsx`.
- **Audit**: categorie **`features`** + actie `feature.toggle` (tenant, feature, oude/nieuwe
  status, actor) in `lib/audit-actions.ts`.

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

### Internationalisatie (i18n) — NL / EN / FY

Volledige meertalige UI op basis van **next-intl** (cookie-modus, **géén** URL-locale-prefix
→ URLs blijven `/member`, `/owner`, `/admin`). NL = standaard/bron, EN = volledig, FY = Frysk
(voorbereid: kern vertaald, rest valt terug op NL). **Nieuwe taal = één regel** in
`LOCALES`+`LOCALE_META` (`lib/i18n/config.ts`) + een `messages/<code>.json` (ontbrekende
sleutels → NL-fallback). Géén Prisma-migratie nodig: `enum Locale {NL,EN,FY}`, `User.locale`
(persoonlijke voorkeur) en `Tenant.locale` bestonden al.

- **Kern** (`lib/i18n/`): `config.ts` (talen-registry + helpers, geen `server-only`),
  `request.ts` (`getRequestConfig` — resolutie-keten **cookie `gymrebel-locale` →
  `Accept-Language` → NL**, DB-vrij), `messages.ts` (deep-merge NL-basis onder de actieve taal
  → nooit een harde missing key), `format.ts` (pure `Intl`-helpers voor datum/getal/valuta,
  ook server-side bruikbaar met expliciete locale), `actions.ts` (`setLocale` → cookie +
  `User.locale`).
- **Provider**: `app/layout.tsx` wrapt in `NextIntlClientProvider`; `<html lang>` volgt de
  **UI-locale** (niet langer `tenant.locale`). Tenant-branding (logo/accent/font) blijft
  100% taal-onafhankelijk.
- **Persistentie/detectie**: de switcher zet cookie + `User.locale`; de **JWT/session** dragen
  `locale` en **`proxy.ts`** zet bij de eerste request na login de cookie uit `User.locale`
  (dekt magic-link/OAuth/wachtwoord). Nieuwe gast → `Accept-Language` → NL.
- **Switcher**: `components/i18n/language-switcher.tsx` (`variant="menu"` / `"settings"`) →
  `setLocale()` + `router.refresh()` (directe RSC-re-render, géén full reload, state behouden,
  toast-bevestiging). Geplaatst in gebruikersmenu, `/account/taal` en het loginscherm.
- **Berichten**: één namespaced JSON per taal (`messages/{nl,en,fy}.json`), top-level
  namespaces (`common, nav, auth, account, member, owner, admin, errors, exercises, email,
  pdf, validation, notifications, …`). RSC: `getTranslations(ns)`; client: `useTranslations(ns)`;
  plurals/interpolatie via ICU; rich text via `t.rich`. `metadata`-titels → `generateMetadata`
  met `getTranslations`.
- **Rapport**: `npm run i18n:report` (`scripts/i18n-report.mjs`) diff't elke taal tegen NL
  (ontbrekende/overbodige sleutels; `I18N_STRICT=1` faalt bij gaten).
- **Migratie-status**: foundation + navigatie + auth + foutpagina's + member-dashboard zijn
  gemigreerd. **Nog te doen** (zelfde patroon): rest member-area, owner-area, admin-area,
  account-forms, gedeelde UI-componenten met defaulttekst, en server-side (e-mails
  `lib/email`, PDF `lib/schema-pdf`, zod-validatie, audit-zinnen, `getExerciseDetail`-locale).

## RLS-policies toepassen (vastgelegd in prompt 04)

De row-level-security policies staan in `prisma/sql/rls.sql` (buiten `prisma/migrations/`,
anders ziet `prisma migrate` het als een migratie).
- **Development**: toepassen met `npm run db:rls` (na een schema-migratie).
- **Productie/CI**: als aparte stap in de deploy-pipeline draaien na `prisma migrate deploy`.
- Elke query zet de tenant-context via `set_config('app.current_tenant', ...)` (zie
  `lib/tenant-db.ts`).
