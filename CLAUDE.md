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
2. **Tenant-resolutie via subdomein** — `fitpower.gymrebel-training.com` → tenant `fitpower`. Het basisdomein zelf (`gymrebel-training.com`, `www.` en de app-host `app.`) is géén tenant. In development gebruik `?tenant=fitpower` als query.
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
- **Seed-guard tegen dataverlies (`prisma/seed-guard.ts`)**: `seedTenant()` reset per
  tenant destructief (`deleteMany` in FK-volgorde) vóór het opnieuw opbouwen. De guard
  beschermt **álle** eigen data, niet alleen schema-toewijzingen, door de tenant te
  vergelijken met een **nullijn** (het moment van de laatste geslaagde seed):
  - **Opslag**: `PlatformSetting`-key `seed.baseline.<slug>`, weggeschreven aan het
    einde van een geslaagde `main()`. Geen markering → afgeleid uit de oudste gebruiker
    van de tenant + 15 min (die is per definitie door de seed gemaakt; de seed wist
    immers eerst álle gebruikers).
  - **Detectie**: per tabel op `createdAt`/`updatedAt` (vangt dus ook *bewerkte*
    seed-data, bv. een aangepast sjabloon), plus het onveranderde sterke signaal
    `AssignedWorkout.assignedById != null || origin: MEMBER`. Tabellen zónder eigen
    tijdstempel (`Exercise`, `ClassSession`, `WorkoutDay`/`WorkoutExerciseItem`) worden
    gedekt door het **auditlog-vangnet**: élke app-mutatie logt, de seed nooit. Puur
    niet-data-events (`auth.*`, `report.*`, `support.*`, `privacy.*`, `*.notify.sent`,
    `*.email.sent`, QR-export) staan in de negeerlijst zodat inloggen niets blokkeert.
  - **`WorkoutSession.createdAt`** (migratie `20260730130000_workout_session_created_at`)
    bestaat speciaal hiervoor: `startedAt` is teruggedateerd én krijgt voor de huidige
    dag willekeurige tijdstippen die ná de seedrun kunnen liggen → vals alarm.
  - **Volgorde**: `preflight()` controleert álle tenants (+ extra superadmins) vóórdat
    er iets gewist wordt; `seedTenant()` checkt daarnaast zelf (defense-in-depth).
  - **Commando's**: `npm run db:seed:check` toont zonder iets te wijzigen wat een seed
    zou blokkeren; `npm run db:seed:baseline` verklaart de huidige staat als vertrekpunt
    (nodig op een database van vóór deze guard). Override blijft
    `SEED_FORCE=1 npm run db:seed`; volledig schoon beginnen is `npm run db:reset`.
  - Een nieuwe demo-tenant toevoegen = één regel in `SEEDED_SLUGS` (seed-guard.ts).
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
  - **Wachtwoord vergeten (`lib/password-reset.ts`).** Eenmalige, kortlevende reset-token
    (**1 uur**) op `User` (`passwordResetToken @unique` + `passwordResetExpires`, migratie
    `20260712140000_password_reset`) — zelfde patroon als de e-mailwijziging-token, pre-auth
    met de base `prisma`. `requestPasswordReset(email, origin)` zet per **actief account** van
    het e-mailadres (tenant-accounts + superadmin) een token en stuurt per sportschool een
    gebrande mail (template-key `passwordReset`, composer `passwordResetMessage`) — **geen
    enumeratie** (scherm toont altijd "check je mail"). `completePasswordReset` dwingt
    `passwordMeetsPolicy` server-side af, nult de token (**eenmalig**) en zet
    `sessionsValidFrom = now` + revoket device-sessies (**logout overal**), plus best-effort
    `passwordChangedMessage`. Server-actions `requestPasswordResetAction`/`submitPasswordReset`
    in `app/login/actions.ts`; pagina's `/login/reset` (aanvraag), `/login/reset/check`
    ("check je mail") en `/login/reset/[token]` (nieuw wachtwoord, live checklist via
    `lib/password-policy`). "Wachtwoord vergeten?"-link in `login-form.tsx`. Audit
    `auth.password.reset.request`/`auth.password.reset.complete`. i18n `auth.reset.*` (nl/en/fy).
- **Tenant-resolutie (prompt 04).** `proxy.ts` lost de tenant op (subdomein of `?tenant`)
  via `lib/tenant-resolve.ts` en zet `x-tenant-slug` als request-header. Server Components
  lezen die via `lib/tenant.ts` (`getCurrentTenant()`, per-request `cache()`). Client
  Components via `useTenant()` (`components/tenant-provider.tsx`).
  - **HET BASISDOMEIN IS GÉÉN TENANT.** Een tenant-host heeft per definitie een label
    méér dan `NEXT_PUBLIC_APP_DOMAIN` (default `gymrebel-training.com`, dezelfde bron als
    de QR-URL's in `lib/machine.ts`). De oude regel ("≥ 2 labels en het eerste is niet
    gereserveerd") las het kale domein als slug `gymrebel-training`, dus elke bezoeker van
    `gymrebel-training.com` kreeg een niet-bestaande tenant mee. `www.` en de app-host
    `app.` vallen ook af (`RESERVED_LABELS`). Hosts búíten het basisdomein (`*.localhost`
    in dev, previews) houden de oude label-heuristiek. Tests: `tests/tenant-resolve.test.ts`.
  - **GÉÉN WILDCARD-DNS — elk tenant-subdomein wordt handmatig aangezet.** Vercel staat
    `*.gymrebel-training.com` alléén toe via hun eigen nameservers, en de DNS van dat
    domein hoort bij Cloud86 mét live mail (MX/SPF/DMARC/DKIM). Die zone verhuizen om een
    wildcard te krijgen weegt niet op tegen het risico dat de mail eruit ligt. **Bij het
    onboarden van een sportschool horen dus twee DNS-handelingen**: het subdomein
    `<slug>.gymrebel-training.com` toevoegen in Vercel → Domains, en het getoonde
    CNAME-target als CNAME `<slug>` in Cloud86 zetten. Vergeet je dat, dan werken de
    QR-codes van die gym niet (de rest van de app wel — die draait op `app.`).
    Herzien zodra het aantal tenants de handmatige stap onwerkbaar maakt; de QR-URL's
    veranderen daar niet van, dus geprinte stickers blijven bij zo'n overstap geldig.
  - **`Tenant.slug` is na de eerste QR-print onveranderlijk**: die slug staat als
    subdomein op fysieke stickers bij de apparaten.
- **Whitelabel theming.** De root-layout injecteert `--tenant-accent` (uit `tenant.accentColor`)
  als inline CSS-var op `<body>`; `bg-accent`/`text-accent` kleuren daardoor per tenant.
  `<html lang>` volgt sinds de i18n-ronde de **UI-locale** (niet `tenant.locale`).
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
- **Seed heeft 2 tenants** (**beide `locale = NL`** — taal is een lid-instelling, geen
  gym-instelling; zie `getContentLocale`): `gymrebel` (oranje, NL, rijk — voorheen `fitpower`; oudere
  verwijzingen hieronder naar "fitpower" lees je als `gymrebel`) en `ironhouse` (blauw, EN,
  compact). `duco@gymrebel.nl` bestaat in beide tenants (demonstreert e-mail uniek per
  tenant). `gymrebel` heeft **2 vestigingen** (Leeuwarden Centrum default + Leeuwarden
  Zuid — demonstreert de niet-optelbare actieve-leden-telling; ~30% van de sessies op de
  niet-thuisvestiging), `ironhouse` 1. De seed genereert ook **trainingsactiviteit**
  (sessies + prestaties, laatste ~12 weken) zodat het owner-dashboard cijfers heeft.

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
- **Afbeeldingen in de schema-PDF**: elke oefening met beeld krijgt een thumbnail in een
  eigen kolom (`THUMB_BOX` 34pt) links van de naam. De kolom bestaat **alleen** als het
  schema minstens één afbeelding heeft — anders houdt de oefening-kolom z'n volle breedte
  (tekst-only schema = identieke opmaak als voorheen); de ruimte gaat van de naam-kolom af,
  nooit van de smalle notities-kolom, en de thumbnail legt een ondergrens op de rijhoogte.
  URL via `exerciseThumbUrl` (zie de bibliotheek-sectie), embedden via **`lib/pdf-image.ts`**
  (`embedRemoteImage`/`embedRemoteImages`: dedupe per URL, 6 parallel, max 80, 5s-timeout).
  **Waarom `sharp` (nieuwe dependency)**: pdf-lib embedt alléén PNG/JPEG, terwijl de
  bibliotheek volledig **WebP** is (animaties incl.) en de klassieke catalogus `.gif` heeft —
  sharp normaliseert elke bron naar een verkleinde PNG (eerste frame bij animatie). Lui
  geïmporteerd: zonder sharp gaan PNG/JPEG nog rauw door en levert de rest simpelweg geen
  beeld op. Elke fetch/decode is best-effort → een download faalt nooit op een plaatje
  (bewezen: een 404-URL rendert die rij gewoon zonder beeld). Ook het tenant-logo loopt nu
  via deze helper (dus WebP/GIF-logo's werken, i.p.v. de oude `.png`-extensiecheck).
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

### Afbeelding bij een schema (omslagfoto's)

Elk trainingsschema heeft beeld. **`lib/schema-image.ts`** (puur, ook client —
idioom `exercise-types.ts`) is de bron van waarheid met een **3-lagen-resolver**
`schemaImage(template, {logoUrl})`: eigen upload (`WorkoutTemplate.imageUrl`,
migratie `20260730170000_schema_image`) → **herkomst-foto** van het
RepDB-voorbeeldschema (via `libraryTemplateId`) → **sportschoollogo**. `null` =
accent-vlak met icoon; een gat in de UI bestaat niet.

- **Gecureerde foto's = code-registry, géén kolom op `LibraryWorkoutTemplate`.**
  `LIBRARY_TEMPLATE_PHOTOS` heeft één record per voorbeeldschema (slug, Pexels-id,
  NL alt-tekst, optionele `focus`). Reden: `library:import` upsert't die tabel uit
  de RepDB-bundel — een kolom zou bij elke re-import weggeschreven worden, en de
  foto's zijn **onze** curatie, geen dataset-content. Nieuwe foto = één record +
  `npm run library:images`. `GOAL_FALLBACK_SLUG` dekt **beide** doel-woordenschatten
  (RepDB-goals én lib/training-goals.ts), zodat een schema uit een volgende bundel
  nooit beeldloos in de lijst staat.
- **Bron/licentie**: Pexels (gratis, commercieel toegestaan, naamsvermelding niet
  verplicht). Herkomst per foto vastgelegd als `pexelsId` → `pexelsSourceUrl()`.
  Bestanden **niet gehotlinkt** maar gekopieerd naar de eigen publieke container:
  `exercise-media/images/schema-templates/<slug>.webp` (eigen map — het is géén
  RepDB-materiaal), URL via het bestaande `libraryMediaUrl` (`LIBRARY_MEDIA_BASE_URL`).
- **`npm run library:images`** (`scripts/upload-schema-images.ts`): haalt de bron bij
  Pexels, snijdt met `sharp` naar **3:2** (`SCHEMA_COVER_*`) en upload als WebP.
  Idempotent (`--force` overschrijft, `--only=<slug>`, `--dry-run`). De doelcontainer
  wordt **afgeleid uit `LIBRARY_MEDIA_BASE_URL`** — nooit uit `AZURE_BLOB_CONTAINER`,
  dat wijst bewust naar de verouderde legacy-container.
- **Waarom 3:2 en waarom `focus`**: de helft van de bronfoto's is staand. 16:9 sneed
  het onderwerp eraf; en `sharp`'s `attention`-strategie faalt op donkere/wijd
  gekadreerde beelden (bewezen: `glutes-focus` hield alléén de vloer over). Vandaar
  per foto een geverifieerde `focus` (`attention` default, `center` waar nodig).
  Elke uitsnede is visueel gecontroleerd — wijzig `focus` niet zonder opnieuw te kijken.
- **KOPIËREN GAAT VIA `coverUrlForCopy`, NOOIT VIA `libraryTemplateId`.** Toewijzen
  (`cloneToAssignment`), dupliceren (`duplicateTemplate`) en het lid dat een sjabloon
  overneemt (`startMemberSchema`) schrijven de geërfde URL **hard** mee. Zou je
  `libraryTemplateId` meekopiëren, dan geldt de kopie als "al overgenomen" en stuurt
  `importLibraryTemplate` de owner naar het verkeerde schema (die idempotentie-check
  filtert niet op `isLibrary`).
- **UI**: gedeelde `components/schema/schema-cover.tsx` (géén `"use client"`; foto =
  `object-cover`, logo = `object-contain` op accent-vlak — een uitgesneden wordmark is
  geen sfeerbeeld). Ingebouwd op de voorbeeldschema-kaarten + detailmodal, de
  template-tabel, `/member/schema` (banner, niet de volle 3:2 — titel en startknop
  moeten op een telefoon in beeld blijven) en de lid-builder-startsjablonen.
  Rauwe `<img>`, geen `next/image`: zonder Blob-token levert de upload lokaal een
  data-URL op en die kan de optimizer niet aan.
- **Owner-upload**: sectie "Afbeelding" op `/owner/schemas/templates/[id]`
  (`schema-image-form.tsx` → `setTemplateImage`, `uploadSchemaImage` in lib/blob.ts,
  5 MB). Verwijderen zet het veld op NULL → terugval, dus "geen afbeelding" bestaat
  niet als eindtoestand. Audit `schema.image.set`. Tests: `tests/schema-image.test.ts`.

### Schema-aanvragen: nieuw schema vs. aanpassing (twee aparte types)

Een lid dat z'n **huidige** schema wil bijstellen vraagt iets anders dan een lid dat
een **nieuw** schema wil. Dat liep door elkaar: de link "Aanpassing vragen aan je
trainer" op `/member/schema` landde op een pagina met de kop "Trainingsschema
aanvragen" en een formulier dat om doel + startdatum vroeg, en één open aanvraag per
lid blokkeerde het andere verzoek. Sinds migratie `20260730160000_schema_request_kind`
zijn het twee types op één model.

- **Model**: `enum SchemaRequestKind { NEW_SCHEMA | CHANGE }` + `SchemaRequest.kind`
  (default NEW_SCHEMA → bestaande rijen zijn per definitie nieuw-schema-aanvragen) en
  **`goal` is nullable** geworden: een aanpassing kiest geen doel en geen
  `preferredStart`, maar vult `description` ("wat wil je aanpassen?", server-side
  verplicht). Géén RLS-wijziging (geen nieuwe tabel).
- **Pure kern `lib/schema-requests.ts`** (ook client, idioom `exercise-types.ts`):
  `REQUEST_KIND_META` (label + badge-tone), `REQUEST_KIND_PARAM`/`requestKindHref`/
  `parseRequestKind` (de URL-kant: `?type=aanpassing`), en de indienregel
  **`canSubmitRequest(kind, openKinds)`** = één open aanvraag **per type**, zodat een
  aanpassingsverzoek niet wacht op een lopende nieuw-schema-aanvraag. Daarnaast
  `OPEN_REQUEST_STATUSES` + **`canCancelRequest`** (intrekken mag in élke open status,
  óók `SCHEMA_CREATED` — anders zit het lid vast achter z'n eigen open aanvraag) en
  `DELETABLE_REQUEST_STATUSES` + **`canDeleteRequest`** (opruimen alleen bij
  CANCELLED/REJECTED; `COMPLETED` draagt `resolvedAssignmentId` = historie). Tests:
  `tests/schema-requests.test.ts`.
- **Lid**: `/member/requests` kiest het formulier op `?type=` — `SchemaRequestForm`
  krijgt `kind` en toont óf doel+toelichting+startdatum, óf alleen "wat wil je
  aanpassen?". Kop/subtitel/knop/succestekst volgen het type; een tekstlink schakelt
  naar het andere type. **Terugval**: `?type=aanpassing` zonder actief coach-schema valt
  op de nieuw-schema-variant terug (met uitleg) — er is dan niets om aan te passen.
  Server-action `submitRequest` valideert met een **zod discriminated union** op `kind`
  (nooit de client vertrouwen); `cancelRequest`/`deleteRequest` gebruiken de predicaten
  hierboven en scopen op tenant+lid in de `where` (geen aparte read-check).
- **`hasActiveCoachSchema`** (lib/member.ts) beslist waar "aanpassing vragen" zinvol is
  (member-layout → drawer-ingang, en de pagina). Die deelt de zichtbaarheidsregel met
  `getAssignedSchema` via de private `activeAssignmentWhere` — **nooit opnieuw
  uitschrijven** (wie `availableFrom`/`endDate` vergeet, telt een verborgen of verlopen
  schema mee). Let op: typeer die helper als `Prisma.AssignedWorkoutWhereInput`, niet
  `as const` — readonly arrays breken Prisma's payload-inferentie (`template` verdwijnt
  dan uit het resultaattype).
- **Coach**: `/owner/requests` toont het type als badge vóór de status en labelt de
  knop per type ("Schema maken" vs **"Schema aanpassen"**); de doel-regel valt weg als
  er geen doel is. Meldingen (`lib/schema-requests-notify.ts`) en de e-mailcomposer
  `schemaRequestReceivedMessage` hebben eigen kop/tekst/subject per type.
- **Audit**: `request.change.submit` naast `request.submit`, plus `request.delete`.
- **Bewust niet**: geen aparte kind-filter-tab in de coach-queue (de tabs blijven
  status-gebaseerd, het type staat als badge op de rij).

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
  `getAssignedSchema`), PAUSED → `status=ARCHIVED`. **Uitzondering (bewust): een
  bewerkt/heringediend schema dat al live stond behoudt `status=PUBLISHED`** — zie
  "Blijvend eigenaarschap" hieronder.
- **Blijvend eigenaarschap: het lid mag z'n eigen schema áltijd bewerken** — ook ná
  goedkeuring/activering. Pure regels in `lib/member-schema-status.ts` (getest in
  `tests/member-schema-status.test.ts`), gedeeld door de pagina-guard, de server-action en
  de knop-teksten:
  - `isEditableMemberStatus` = **alles behalve IN_REVIEW** (anders beoordeelt de coach een
    bewegend doel). Vastzitten kan niet: `withdrawMemberSchema` trekt de indiening in →
    `statusAfterWithdraw` volgt de zichtbaarheidspoort (PUBLISHED→ACTIVE, ARCHIVED→PAUSED,
    rest→DRAFT), dus intrekken pakt nooit een lopende training af.
  - **Autosave verandert nóóit de status** — alleen de expliciete commit-knop doet dat.
    Zou autosave naar IN_REVIEW flippen, dan sloeg het lid zichzelf midden in het bewerken
    buiten. Gevolg: op een al vastgelegd schema (`isCommittedMemberStatus`) landt een
    wijziging meteen in het schema ("live bewerken"), en de knop dient 'm daarna in
    (APPROVAL) of legt 'm vast (DIRECT).
  - **Herbeoordeling zonder onderbreking**: `submitMemberSchema` zet `memberStatus=IN_REVIEW`
    maar laat `status` staan → het lid traint door terwijl de coach kijkt. `reviewMemberSchema`
    spiegelt dat: goedkeuren van een PUBLISHED-schema geeft ACTIVE (niet APPROVED), afwijzen
    laat het draaien (met reden). `activate()` behoudt de bestaande `publishedAt` als het
    schema al live was — die datum is de nullijn voor voortgang/geldigheid.
  - **"Aangepast, nog niet ingediend"** is puur afgeleid (`hasUnsubmittedChanges`:
    `template.updatedAt` > `reviewedAt`) — géén extra kolom.
  - `persistDraft` schrijft `memberNote` (coach-boodschap per oefening) ongewijzigd terug:
    een bewerkronde van het lid mag de notitie van de coach niet wissen.
  - Verwijderen blijft beperkt tot DRAFT/REJECTED (historie beschermen).
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
  indienen); verder `activateMemberSchema`, `pauseMemberSchema`, `withdrawMemberSchema`,
  `deleteMemberSchema`, `setFavoriteExercises`. Toegang gegate via
  `requireMemberSchemaEnabled` (lib/member-schema.ts). Ingangen naar de editor: "Mijn
  schema's" (`/member/schema/builder`, knop **Bewerken** op élk bewerkbaar schema,
  **Intrekken & bewerken** bij IN_REVIEW) én een directe **Mijn schema bewerken**-link op
  `/member/schema` zodra het actieve schema `origin=MEMBER` is.
- **Toegewezen schema laten aanpassen door het lid** (`Tenant.memberCanEditAssigned`,
  migratie `20260730160000_member_edit_assigned`, default **uit**): staat bewust LOS van
  `memberSchemaMode` — een sportschool kan zelf-bouwen uitzetten en dit tóch aanzetten (of
  andersom). Owner-toggle op `/owner/settings` (`setMemberCanEditAssigned`).
  - **Het lid bewerkt zijn eigen kopie**, nooit de master: een toewijzing wijst al naar een
    eigen niet-library `WorkoutTemplate`. De coach ziet de wijziging automatisch als
    **persoonlijke aanpassing** — `lib/schema-assignments.ts` berekent `personalized` uit
    `diffSnapshots(baselineSnapshot, snapshotOf(template))`; daar was dus niets voor nodig.
  - **Twee poorten, niet samengevoegd** (`assertEditAllowed` in
    `app/member/schema/builder/actions.ts` + de guard-keuze in `builder/[id]/page.tsx`):
    `origin=MEMBER` → `requireMemberSchemaEnabled` + `isEditableMemberStatus`;
    `origin=COACH` → `requireAssignedEditEnabled` (`lib/member-schema.ts`). `saveMemberDraft`
    doet daarom géén blanket `requireMemberSchemaEnabled` meer.
  - **`getMemberSchemaForEdit` heeft geen `origin`-filter meer** (wel userId+tenantId);
    de aanroeper kiest de poort.
  - **Kaders (`SchemaFramework`) gelden NIET op een toegewezen schema** — de coach is daar
    leidend. Zou je ze toch toepassen, dan sluit het schema van de coach het lid buiten van
    z'n eigen opslag zodra de coach iets voorschrijft dat buiten het kader valt (6 sets waar
    max 4 mag, meer dagen dan toegestaan, een niet-vrijgegeven oefening). De editor krijgt
    dus ook `limits={null}` (geen kader-chips, ongefilterde picker).
  - **Geen review-/activeerstap**: het schema staat al live. De editor rendert bij
    `kind="assigned"` geen indienknop maar een "Klaar"-link; `submitMemberSchema` heeft een
    defense-in-depth-guard (COACH → terug naar `/member/schema`) zodat `activate()` nooit een
    coach-toewijzing in de lid-levenscyclus trekt.
  - **Audit**: `schema.member.edit` bij élke save van een toegewezen schema (spiegelt
    `schema.update` van de owner-editor, die ook per autosave logt). Zelf-gebouwde concepten
    loggen bewust niet — te veel ruis.
  - Ingang: **"Dit schema aanpassen"** op `/member/schema` (alleen bij `origin=COACH` +
    vlag aan). Los daarvan staat er bij élk trainer-schema **"Aanpassing vragen aan je
    trainer"** → `/member/requests` (die link ontbrak: hij zat alleen in de verloop-banner).
- **Coach-review** (`/owner/schemas/member-built` + `[id]`): queue van ingediende schema's;
  de coach opent het lid-schema in de bestaande owner `SchemaEditor` (het is een gewone
  niet-library `WorkoutTemplate`) om te bewerken, en keurt goed / goed+activeer / af
  (`reviewMemberSchema` in `app/owner/schemas/actions.ts`).
- **Meldingen** (`lib/member-schema-notify.ts`): indienen → coaches met `schemas:manage`
  (in-app via `notifyStaffWithPermission` + e-mail `memberSchemaSubmittedMessage`);
  beoordeling → lid (in-app + e-mail `memberSchemaReviewedMessage`). Best-effort.
- **Audit** (categorie `schemas`): `schema.member.start/submit/withdraw/approve/reject/
  activate/pause` + `schema.framework.save/delete/assign`.
- **Bewust**: de 3-weg-sync/bulk-edit gelden alleen voor coach-master-schema's; zelf-gebouwde
  schema's hebben geen master (`sourceTemplateId = null`).

### Groepslessen (rooster, inschrijven, wachtlijst, meldingen)

De rooster-module uit prompt 12 is een ronde verder: tijdzone-correct, race-vrij,
vestiging-gescoped, met bewerken/herhalen, wachtlijst en meldingen aan leden.
Migratie `20260826120000_class_sessions_v2` (additief, geen RLS-wijziging).

- **LESTIJDEN LOPEN VIA DE VESTIGING-TIJDZONE, NOOIT VIA `new Date(string)`.**
  Een `datetime-local` levert een zoneloze klok ("2026-09-01T18:00"); `new Date`
  leest die als **servertijd**, dus op Vercel (UTC) werd 18:00 opgeslagen als
  20:00 Amsterdam. Weergave zonder `timeZone` verborg dat (dezelfde servertijd
  terug), maar `startsAt >= now`, het aanwezigheidspaneel, de no-show-grace,
  de bezettings-heatmap en e-mails liepen 2 uur uit. Nu: **`lib/tz.ts`** (puur,
  getest) `zonedInputToDate(input, tz)` / `dateToZonedInput(date, tz)` /
  `addWeeksZoned` (DST-veilig via de klok), met `Location.timezone` van de
  gekozen vestiging; `lib/datetime.ts` formatteert met een verplichte
  `timeZone` (vangnet `DEFAULT_TIMEZONE`). Geef bij élke nieuwe les-weergave de
  tijdzone van `venueLocation` mee. De schema-toewijzing (`availableFrom`)
  stuurt sinds deze ronde een absolute ISO-tijd vanuit de browser.
- **Capaciteit is race-vrij — én dat geldt voor ÁLLE promotie-paden**:
  `enroll`/`unenroll` draaien in een `Serializable`-transactie met retry op
  P2034 (**`lib/db-retry.ts`** `withSerializableRetry`), geen ruwe `FOR UPDATE`.
  Onder READ COMMITTED zagen twee gelijktijdige aanmeldingen dezelfde "nog 1
  plek". Óók de owner-kant (`updateClass`/`updateSession` → `promoteWaitlists`)
  draait Serializable + retry: Serializable-garanties gelden alleen tussen
  transacties die dat zélf zijn — een capaciteitsverhoging naast een
  gelijktijdige aanmelding kon anders dezelfde plek dubbel uitdelen. Nieuwe
  promotie-call-site = zelfde patroon, nooit een kale `$transaction`.
- **Pure regels in `lib/class-attendance.ts`** (getest): `sessionCapacity`
  (sessie-override `ClassSession.maxParticipants` wint van de les-default),
  `enrollmentWindowOpen` (aan- én afmelden tot de **start**; erna is een
  aanmelding definitief, anders poetst een lid een no-show weg), `decideEnroll`
  (gesloten → closed, vol → **wachtlijst**, anders aangemeld; her-inschrijven
  hergebruikt de CANCELLED-rij en zet `enrolledAt` opnieuw = wachtlijstvolgorde),
  `promotableCount`, `noShowCutoff` (gedeeld door cron én `isNoShowEligible`).
- **Wachtlijst = `EnrollmentStatus.WAITLISTED`** (bezet géén plek; telt nergens
  in capaciteit/no-show mee). Doorschuiven gebeurt **in dezelfde transactie**
  als de vrijmakende mutatie (`lib/class-enrollment.ts` `promoteWaitlist`, op
  `enrolledAt`-volgorde): bij afmelden, bij het verhogen van de les- of
  sessie-capaciteit, én bij een **vertrekkend lid**. Wachtenden van een
  afgelopen les worden door de cron CANCELLED. Het lid ziet z'n positie
  ("Wachtlijst, plek 2"). De promoted-melding ná commit loopt via het gedeelde
  `notifyPromotions` (lib/class-notify.ts).
- **Vertrekkend lid geeft z'n plekken vrij**: `releaseMemberClassSpots`
  (lib/class-enrollment.ts, best-effort — blokkeert de ledenadministratie
  nooit) annuleert ENROLLED/WAITLISTED-rijen van nog niet gestarte sessies en
  promoot de wachtlijst in één Serializable-transactie. Aangeroepen bij
  deactiveren/archiveren/verwijderen (owner- én superadmin-acties) en in de
  AVG-cron `delete-accounts` — daar **vóór** de `user.delete`, want de cascade
  wist de rijen zonder doorschuiving. Heractiveren = opnieuw aanmelden.
- **Vestiging-scoping is fail-closed** (zoals overal): `/owner/rooster` en het
  les-detail filteren sessies met `locationScopeWhere`; `addSession`/
  `updateSession` accepteren alleen een vestiging binnen de scope
  (`resolveVenue`), `deleteSession` en `markAttendance` checken de sessie-
  vestiging, `deleteClass` mag alleen als álle sessies binnen de scope vallen.
- **Bewerken + herhalen**: les (naam/omschrijving/instructeur/max) en sessie
  (tijd/vestiging/zaal/capaciteit) zijn bewerkbaar; "wekelijks herhalen"
  (`MAX_REPEAT_WEEKS` = 26) maakt N sessies met een gedeeld `seriesId` (geen
  reeks-model: de reeks heeft geen eigen eigenschappen). Verwijderen én
  bewerken kunnen "ook alle volgende in deze reeks": de reeks-bewerking past
  de tijdwijziging toe als **klok**-verschuiving (`wallClockDeltaMs`/
  `shiftWallClock` in lib/tz.ts, getest — di 18:00→19:00 blijft 19:00 lokale
  tijd voorbij de DST-overgang) en neemt vestiging/zaal/capaciteit-override
  één-op-één over, met per sessie een eigen moved-melding. Een **gestarte
  sessie met aanmeldingen is niet verwijderbaar** (aanwezigheidshistorie) —
  die regel is de gedeelde pure `canDeleteSession` (lib/class-attendance.ts),
  gebruikt door de UI-knop én de action (die liepen uiteen: knop zichtbaar,
  action weigerde stil). Een **verplaatste sessie** (starttijd gewijzigd) nult
  `remindedAt` zodat de herinnering-cron de nieuwe tijd opnieuw meldt;
  `markAttendance` weigert zelf zolang de les niet gestart is (de UI toont de
  knoppen pas ná afloop, defense-in-depth) en heeft naast Aanwezig/No-show een
  **Herstel**-knop terug naar ENROLLED.
- **Annuleren zonder verwijderen = `ClassSession.cancelledAt`** (migratie
  `20260904120000_class_session_cancelled`): de aanmeldlijst (historie) blijft
  bestaan, terugdraaien kan (`restoreSession`, meldingstype **`restored`**).
  `cancelSession` kan per sessie of met alle volgende in de reeks. Een
  geannuleerde sessie is overal een niet-sessie: `enroll` → closed,
  `promoteWaitlist` promoot er niemand in, herinnering- en no-show-cron slaan
  haar over (aangemeld voor een geschrapte les ≠ no-show), reeks-bewerken
  verschuift haar niet mee, en dashboards/inzichten/metrics tellen haar niet
  als bezettings-datapunt. **Nieuwe sessie-lees-site? Vraag je af of
  `cancelledAt: null` erbij hoort.** UI: rode badge (owner + lid), owner
  krijgt een herstel-link, lid geen actieknoppen.
- **Meldingen aan leden = `lib/class-notify.ts`** (`notifyClassEvent`, categorie
  **`classes`**, in-app/push/e-mail per voorkeur, push-kanaal `gymrebel-classes`):
  `enrolled`/`waitlisted` (bevestiging), `promoted`, `moved` (tijd/vestiging
  gewijzigd, met "was …"), `cancelled` (sessie geannuleerd of verwijderd),
  `restored` (annulering teruggedraaid), `reminder`. **E-mail staat voor
  `classes` standaard AAN** (`EMAIL_ON_BY_DEFAULT` in lib/notifications.ts,
  gespiegeld in notifications-form.tsx): promotie/verplaatsing/annulering zijn
  tijdkritisch — alleen-in-app maakt onwetende no-shows.
  De sessie gaat **expliciet** mee (niet via id): bij annulering bestaat de rij
  al niet meer. E-mail via `classNotificationMessage` (generieke shell; kop en
  intro zijn dezelfde vertaalde teksten als in-app, `notifications.classes.*`).
- **Crons** (`vercel.json`): `class-reminders` (dagelijks 16:00 UTC, venster
  `REMINDER_WINDOW_HOURS` = 30, idempotent via `ClassEnrollment.remindedAt`,
  markeert vóór verzending) en `class-attendance` (no-show + wachtlijst opruimen).
- **Feedback aan het lid** via `?msg=` op `/member/rooster` (enrolled/waitlisted/
  closed/unchanged/unenrolled, plus `?overlap=1` = amber waarschuwing dat de
  aanmelding overlapt met een andere eigen les — dubbelboeken mag, maar niet
  ongemerkt), gestart-maar-nog-bezig-lessen blijven zichtbaar (`endsAt >= now`)
  maar zijn niet boekbaar; het vestiging-filter zit **in de query** en het
  rooster toont een vaste **datumhorizon** (`ROSTER_HORIZON_DAYS` = 21, geen
  rij-limiet — `take: 40` kapte bij een paar weekreeksen al na ±2 weken stil
  af). `formatSessionStart` (lib/datetime.ts) toont het jaartal zodra de datum
  buiten het lopende jaar valt.
- **Audit** (categorie `schedule`): `class.create/update/delete`,
  `class.session.create/update/delete`, `class.enroll/waitlist/unenroll`,
  `class.notify.sent`, `class.reminder.sent` naast de bestaande
  `class.attendance.*`.
- **Bewust niet**: geen annuleerdeadline vóór de start (één regel: tot de start),
  geen per-lid limiet op aantal aanmeldingen, geen blokkade op overlappende
  aanmeldingen (alleen de waarschuwing), geen instructeur-FK
  (`GroupClass.instructorName` blijft vrije tekst).

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

### Oefeningen-bibliotheek (RepDB — dé standaardbron)

De **RepDB Standard**-bundel (gekocht, commerciële licentie; **v1.38 = 526 oefeningen**
(was v1.26 = 483), 100% dekking op álle velden) is dé bron van waarheid voor
oefening-content. Metadata in Postgres; media (WebP: `classic/` transparant + `flat/` +
463 animaties + 27 spierdiagrammen + 74 materiaal-iconen) op **Azure Blob**.

- **Blob-indeling (licentie-eis!)**: publiek `datarebel`/**`exercise-media`** bevat
  ALLEEN `images/**`; de ruwe bundel (exercises.json, sqlite, embeddings, …) staat in de
  **privé**-container **`exercise-source`** — de licentie verbiedt een open bucket met de
  dataset ("serving individual images is expressly fine"). Nooit ruwe data publiek zetten.
  ⚠️ Licentie-aandachtspunt: Standard dekt "multi-tenant onder eigen brand"; de
  whitelabel-clausule ("deliveries under a third party's brand → Enterprise") is voor
  GymRebel grensgeval — check bij support@repdb.co vóór commerciële livegang.
- **Modellen** (globaal, géén tenantId/RLS, zoals ExerciseCatalog): `LibraryExercise`
  (id = RepDB-slug; categorische velden als String → dataset-update zonder migratie;
  `met`, `images` Json varianten-map, `imageAlias`, `retiredAt`, `exerciseType` afgeleid
  bij import), **`LibraryExerciseText`** (`@@unique([exerciseId, locale])`, locale =
  lowercase ISO-String — en/de/es uit de bundel, **nl volledig vertaald** (zie hieronder);
  `origin` "dataset"/"machine"/"manual" maakt de latere vertaalronde idempotent en
  beschermt handwerk bij re-import), `LibraryMuscle`/`LibraryEquipment` (kleine lookups,
  `names` Json per taal), `LibraryRelation` (doel-relatief: alternative/progression_of/
  regression_of) en `LibraryWorkoutTemplate` (15 voorbeeldschema's, `days` verbatim Json).
- **Media = relatieve keys** + basis-URL uit env (`LIBRARY_MEDIA_BASE_URL`) — containerwissel
  is config, geen datamigratie (les van de legacy-hernoeming). Pure paden-helpers in
  `lib/exercise-library/media.ts` (alias-regel: `imageAlias` wint van `id`). Default-stijl
  **classic** (transparant → composeert op tenant-huisstijl).
- **Import**: `npm run library:import` (`scripts/import-library.ts`, tsx+Prisma) leest de
  bundel uit de privé-container, valideert licht, upsert idempotent op slug, vervangt
  relaties, **retire't** verdwenen slugs (nooit hard delete) en un-retire't terugkeerders.
  Versie uit CHANGELOG.md (`datasetVersion`).
- **DATASET-UPDATE = VASTE VOLGORDE, RAAKT GEEN TENANT-DATA.** Nieuwe bundel in een map
  (bv. `repdb-bundle-standard/`, staat in `.gitignore` — gelicentieerd, nooit committen):
  1. `npm run library:upload` (`scripts/upload-library-bundle.ts`): `images/**` → de
     publieke media-container (afgeleid uit `LIBRARY_MEDIA_BASE_URL`), de rest → de
     privé-container. **Idempotent op Content-MD5** (RepDB vervangt clips/illustraties
     onder dezelfde naam — een size-check mist die), verwijdert **nooit** iets, en
     eindigt met een **manifest-controle**: elk beeld dat `exercises.json` belooft moet
     op Azure staan, anders exitcode 1 + lijst. Dat vangt een onvolledige download
     (bij v1.38 ontbraken 206 beelden van de 43 nieuwe oefeningen in de geleverde map).
     `--dry-run`/`--force`/`--skip-media`/`--skip-source`/`--bundle=<map>`.
  2. `npm run library:import` (hierboven). Tenant-tabellen (`Exercise`, sessies,
     prestaties, schema's) worden niet aangeraakt; `Exercise.libraryId` blijft naar
     dezelfde slug wijzen.
  3. `npm run library:lookups` — nieuw materiaal/spieren eerst een NL-naam geven in
     `lib/translate/library-lookups-nl.ts` (het script somt gaten op, exitcode 1).
  4. `npm run library:translate` — vult alleen de nl-rijen van **nieuwe** oefeningen.
     Gewijzigde en-teksten van bestaande oefeningen worden **niet** hertaald (machine-
     rijen blijven staan); daarvoor is `--force` (volle Azure-ronde).
  Daarna `CLAUDE.md`-tellingen bijwerken.
- **Pure kern `lib/exercise-library/`** (géén `server-only`): `mapping.ts`
  (`inferLibraryExerciseType`, `machineTypeFromLibrary` op materiaal-tags,
  `difficultyFromLibrary`, `datasetLocalePreference` (nl→[nl,en], fy volgt nl),
  `pickLibraryText`/`pickJsonName`, `trainingGoalFromLibrary`, `parseTemplateReps`
  ("8-12"/"AMRAP" → int+notitie), NL-labels voor de RepDB-enums), `media.ts`, `source.ts`
  (`ExerciseSource` + `EXERCISE_SOURCE_META` + `exerciseSourceOf`). `search.ts`
  (`server-only`): `buildLibraryWhere`/`myLibraryEquipmentSlugs` (spiegel lib/catalog.ts).
  Tests: `tests/exercise-library.test.ts`.
- **Tenant-koppeling**: `Exercise.libraryId` naast het verouderde `catalogId`;
  **CHECK-constraint**: nooit beide (migratie `20260730140000_exercise_library`). Herkomst
  = `exerciseSourceOf` → `"standaard"` (bibliotheek) | `"klassiek"` (oude catalogus) |
  `"eigen"`. RepDB-spier-slugs resolven via `resolveRegion` (muscle-map leest `_` als
  spatie), maar een consument moet de slugs óók daadwerkelijk **selecteren** — zie de
  bron-bewust-waarschuwing onder "Spier-heatmap & -analyse".
- **EIGEN-OEFENING SCOPING = `OWN_EXERCISE_WHERE`** (`lib/exercise-library/source.ts`) —
  de query-tegenhanger van `exerciseSourceOf(...) === "eigen"`: `{ catalogId: null,
  libraryId: null }`. Sinds `libraryId` bestaat is **`catalogId: null` alléén niet meer
  "eigen"** (bibliotheek-rijen hebben óók `catalogId == null`). Dat gaf een bug: de
  Eigen-tab toonde de hele bibliotheek (484 i.p.v. 1) én de eigen-mutaties
  (bewerken/dupliceren/archiveren/verwijderen) matchten bibliotheek-oefeningen, wat
  eigen-content-velden náást een leidende externe bron kon zetten. Gebruik de constante
  overal — nooit weer een losse null-check. Regressietest in `tests/exercise-library.test.ts`.
- **THUMBNAIL = `exerciseThumbUrl`** (`lib/exercise-thumb.ts`, puur) — dé 3-weg-lookup voor
  "de afbeelding van een oefening": bibliotheek-media → klassieke `imageUrl`/`gifUrl` →
  eigen `imageUrls[0]`. Zelfde valkuil als `OWN_EXERCISE_WHERE`: nu de bibliotheek dé
  standaardbron is levert een losse `catalog?.imageUrl`-keten bij bijna elke oefening géén
  beeld op. Selecteer de bronnen met `EXERCISE_THUMB_SELECT` (select-sites) resp.
  `EXERCISE_THUMB_RELATIONS` (include-sites, o.a. `getAssignedSchema`) zodat een call-site de
  bibliotheek niet stil kan vergeten. Gebruikt door de pickers, `/member/exercises`, het
  schema-overzicht, de schema-PDF en de **volledige actieve-trainingsflow**
  (`lib/active-session-view.ts` incl. sessie-vervangingen, `lib/exercise-alternatives.ts`,
  `lib/workout-session-ops.ts`); getest in `tests/exercise-library.test.ts`. In
  `exercise-alternatives.ts` wordt `catalog` ná de spread bewust overschreven met een
  rijkere selectie (target/bodyPart/equipment/secondaryMuscles) die de matching nodig heeft.
  Nog niet omgezet (catalogus-only, dus blind voor bibliotheek-beeld):
  `app/m/[qrToken]/page.tsx`.
- **Resolver** `getExerciseDetail` is **3-weg** (bibliotheek → klassiek → eigen), zelfde
  `ExerciseDetail`-shape + nieuw: `tips[]`, `animationUrl`, `met`, `muscleDiagrams[]`,
  `equipmentIconUrl`, `source`. `getAlternativeExercises` gebruikt voor bibliotheek-
  oefeningen de gecureerde **relations** (+ spier-overlap-aanvulling); klassiek behoudt de
  oude match. `getLibraryPreview` = picker-preview. Gedeelde picker-query in
  **`lib/exercise-picker.ts`** (`getPickerExercises`) — gebruikt door de 3
  owner-schema-pagina's én de lid-builder; `AvailableExercise.source` is 3-waardig en
  beide editors renderen de badge via `EXERCISE_SOURCE_META`.
- **TAAL IS PER LID, NIET PER SPORTSCHOOL — `getContentLocale`** (`lib/i18n/content-locale.ts`,
  `server-only`): de **UI-taal van de lezer wint**, `tenant.locale` is alleen vangnet.
  Instructies/tips/spier-/materiaalnamen horen bij wie ze léést, niet bij de sportschool.
  Dit ging mis: de resolvers kregen `tenant?.locale ?? "NL"` mee, dus een Nederlandstalig
  lid bij de demo-tenant `ironhouse` (`locale = EN`) zag een Nederlandse interface met een
  **Engelse "Uitvoering"** — terwijl de nl-teksten allang bestonden. Gebruik de helper op
  élke nieuwe call-site van `getExerciseDetail`/`getLibraryPreview`/`getCatalogPreview`/
  `datasetLocalePreference`; nooit weer rechtstreeks `tenant.locale`. Buiten request-scope
  (scripts/tests) valt hij terug op het meegegeven vangnet.
  - **`Tenant.locale` = standaardtaal van de sportschool, géén dwang.** Beide demo-tenants
    staan op NL. Wat de taal wél bepaalt: de UI-cookie `gymrebel-locale` → `User.locale`
    (door `proxy.ts` in de cookie gezet na login) → `Accept-Language` → NL.
  - Reeds per ontvanger: e-mails/notificaties (`localeFromEnum(user.locale)` in
    `lib/schema-notify.ts` c.s.) en de **AI-antwoordtaal** (`lib/ai/assist.ts` gebruikt
    `getContentLocale`, niet langer `tenant.locale`).
- **Owner-UI** `/owner/exercises` (Standaard-tab): bibliotheek met filters (zoek op
  naam/synoniem/slug, lichaamsdeel, materiaal, niveau, doel, "mijn apparatuur" via
  tag-afgeleid machinetype), gedeeld bulk-grid (`catalog-bulk-grid.tsx`,
  `source="library"|"catalog"`), detailmodal met animatie + coach-tips.
  `bulkAddLibraryToGym`/`libraryPreview`/`removeLibraryExerciseFromGym` spiegelen de
  catalogus-actions; naam/spier komen uit de EN-tekstrij, type uit de import-inferentie.
- **Voorbeeldschema's**: sectie op `/owner/schemas/templates` → `importLibraryTemplate`
  maakt ontbrekende oefeningen als tenant-Exercise aan en bouwt het schema relationeel op;
  idempotent via `WorkoutTemplate.libraryTemplateId` (migratie
  `20260730150000_library_template_link`). Audit `schema.library.import`.
- **Vertaling NL — GEDAAN** (`npm run library:translate`, `scripts/translate-library.ts`):
  alle **526** oefeningen hebben een `nl`-rij (`origin: "machine"`), vertaald vanuit de
  en-rijen via **Azure Translator** (regio `germanywestcentral` = EU). `origin: "manual"`
  wordt **nooit** overschreven — en `library:import` raakt nl-rijen ook niet aan (loopt
  alleen en/de/es + slaat origin ≠ "dataset" over), dus de twee scripts kunnen in elke
  volgorde. Gedeelde client: `lib/translate/azure.ts` (chunking ≤90 items/45k tekens,
  backoff op 429/5xx, index-behoudend). Vier modi:
  - *(geen vlag)* — vult alleen wat nog mist (hervatbaar); `--limit`/`--dry-run` voor
    steekproeven, `--names=translate` om ook de namen te vertalen (zie naamsbeleid).
  - `--force` — hertaalt de machine-rijen volledig (kost een volle Azure-ronde).
  - `--repair` — vertaalt **alléén** de fragmenten die op het Engels zijn teruggevallen
    (nl == en). Gebruikt na het verscherpen van de ontkennings-controle; 27 fragmenten
    i.p.v. 4.317.
  - `--refix` — past het glossarium opnieuw toe op bestaande rijen, **zonder API-calls**
    (gratis + instant). Dít is de modus na elke uitbreiding van `DUTCH_FIXES`.
- **Vertaalkwaliteit = `lib/translate/fitness-nl.ts`** (puur + getest,
  `tests/translate-fitness-nl.test.ts`). Generieke MT mangelt sportschool-jargon, dus drie
  lagen — **nieuwe term = één regel**:
  1. `protectTerms()` forceert termen via Azure's *dynamic dictionary*
     (`<mstrans:dictionary translation="…">`). **ALLEEN zelfstandige naamwoorden/termen**:
     een geforceerde clausule sloopt de zinsbouw — empirisch bewezen ("Do not let the
     `<forced>`lower back arch`</forced>`" verloor de ontkenning). Een test dwingt af dat
     geen sleutel een lidwoord/voorzetsel bevat.
  2. `applyDutchFixes()` corrigeert de Nederlandse uitvoer voor de werkwoordsvormen en
     bewegingsnamen die MT structureel fout doet. Empirisch gevonden en afgedekt: `drive`
     → "Rijd door je hielen" (88×!) → **"Zet kracht door je hielen"**; `hinge` →
     "scharnier(en/ende/hoek)" (55×) → **"hip hinge"/"kantel vanuit je heupen"**; `squat`
     → "hurk(t/en)" (26×) → **"squat"/"zak in een squat"**; `curl` → "krul" (17×);
     `arch` → "de rugbogen komen"/"lichte boog in je onderrug" → **"hol trekken"/
     "holling"** (maar "brede boog" = échte arc blijft!); verder `press`→"pers",
     `crunch`→"kraak", `kettlebell`→"klok", `pullover`→"trui", `jerk`→"ruk",
     `delts`→"delta's". Sluit af met een **hoofdletter-normalisatie** (elk fragment is een
     zin) en is hoofdletter-behoudend per regel.
  3. `negationPreserved()` = **veiligheidsvangnet**: verdwijnt de ontkenning uit een
     instructie, dan is de betekenis omgeklapt en houdt het script de **Engelse** bron
     (fail-safe, nooit fail-wrong; ontwerpprincipe 2). Empirisch nodig: een geforceerde
     clausule liet "Do not let the lower back arch" omslaan in "Laat de onderrug hol
     trekken". **Let op de vervoegingen** in de markers (`voorkom\w*`, `vermijd\w*`) —
     zonder prefix-matching sloeg het vangnet aan op 27 correcte vertalingen.
  - **Eindstand**: 1 "treffer" over op 4.317 fragmenten, en dat is een correcte vertaling
    ("de bal *drijft* van links naar rechts" = drifts). Audit-query staat in de
    git-historie van deze ronde; hercontroleren = de jargon-regexes uit `DUTCH_FIXES`
    over de nl-fragmenten halen.
- **NAAMSBELEID (vastgelegd door de eigenaar + getest)**: **oefeningnamen worden niet
  vertaald** — in Nederlandse sportscholen is "bench press"/"lat pulldown"/"squat" de
  gangbare taal. Dat geldt voor het `name`-veld (default `--names=keep`) én *binnen* de
  instructieteksten (FORCED_TERMS mapt oefening- én apparaatnamen op zichzelf; dat is geen
  no-op, want MT wisselde anders willekeurig tussen "dumbbell"/"halter"/"domoor"). De
  owner-grid en `bulkAddLibraryToGym` lezen de oefening**naam** dus bewust uit de
  **en**-tekstrij. Anatomie krijgt altijd Nederlands ("posterior deltoids" → "achterste
  deltoïden", want MT maakte er "achterste delta's" van).
- **WEERGAVENAMEN VAN DE LOOKUPS ZIJN NEDERLANDS** (`lib/translate/library-lookups-nl.ts`,
  puur + getest; script **`npm run library:lookups`**, géén API-calls). `LibraryMuscle.names`
  en `LibraryEquipment.names` kwamen uit de bundel met alleen en/de/es, dus spierchips,
  hulpspieren, diagram-labels en materiaalfilters vielen terug op het Engels. Nu:
  - **Spieren**: Nederlands in het vocabulaire van de spierkaart ("Borst", "Bilspieren",
    "Voorste deltoïden"); anatomisch Latijn dat óók Nederlands is blijft ("Trapezius",
    "Quadriceps"). **Harde eis**: elke nl-naam moet door `resolveRegion` te herleiden zijn —
    de naam belandt als vrij label in `Exercise.targetMuscle`, en een onbekend label kleurt
    stil géén spier meer op de heatmap. `tests/library-lookups-nl.test.ts` dwingt dat af;
    de Nederlandse namen staan als sleutels in `RAW_TO_REGION`.
  - **Materiaal**: het woord dat hier op het apparaat staat — Nederlands waar dat de
    gangbare term is ("Loopband", "Crosstrainer", "Beenpers", "Kabelmachine",
    "Hometrainer"), het Engelse leenwoord waar *dát* de Nederlandse term is ("Dumbbell",
    "Barbell", "Kettlebell", "Smith machine"). Per term een keuze, geen automatisme.
    Dit is een **verruiming** van het oude "apparaatnamen blijven Engels": alleen de
    weergavenaam van de lookup is vertaald, ín de instructieteksten blijven ze Engels.
  - **Snapshots meegemigreerd**: het script zet `Exercise.targetMuscle` van
    bibliotheek-oefeningen om, maar **alleen waar de waarde letterlijk de en-naam is**
    (bewijs dat het de automatische snapshot is, geen handwerk van de sportschool).
    797 rijen omgezet, 15 ongemoeid. `--skip-snapshots` slaat de stap over.
  - **Re-import-veilig**: `library:import` bewaart een bestaande `nl` bij de upsert
    (`namesJsonKeepNl`) — het lookup-equivalent van `origin: "manual"` bij de teksten.
    Nieuw materiaal zónder curatie wordt opgesomd + exitcode 1, dus het blijft niet stil
    Engels. De twee scripts kunnen in elke volgorde draaien.
- **Bewust (nog) niet**: `embeddings.json` (semantische zoek — ligt klaar in
  `exercise-source`), MET-calorieën-UI (waarde wordt al opgeslagen/getoond als
  intensiteit), en een legacy→bibliotheek-migratie-assistent per oefening (kan later;
  koppeling per tenant-Exercise omzetten = `catalogId → null` + `libraryId` zetten).

### Aanvullende oefeningen-collectie (de oudere dataset, intern "klassiek")

De oude externe dataset (1.324 oefeningen, **non-commerciële licentie** — vervangen vóór
commercieel gebruik) blijft bestaan als geoormerkte aanvulling naast de bibliotheek. Media
staat op `datarebel`/**`exercise-media-legacy`** (hernoemd met `npm run blob:copy` — Azure
kán niet hernoemen → copy+verify+delete; de 1.324 absolute `image_url`/`gif_url`-waarden
zijn mee-herschreven).

- **NAAR DE GEBRUIKER HEET DIT "AANVULLEND", NOOIT "KLASSIEK/VEROUDERD".** Deze
  oefeningen worden nog gewoon gebruikt, dus een afstotelijk label hoort er niet: badge
  **Aanvullend** (neutraal sky-blauw, `Badge tone="info"`), sectie "Aanvullende
  oefeningen", feature-flag "Aanvullende oefeningen-collectie", admin-sectie "Aanvullende
  modules". De **interne** sleutels blijven ongewijzigd (`ExerciseSource "klassiek"`,
  flag-key `exercise_legacy_catalog`, i18n-keys `badgeClassic`/`legacy*`, anker
  `#klassiek`) — alleen labels zijn omgezet.
- **Vindbaarheid gated** door superadmin-feature-flag **`exercise_legacy_catalog`**
  (default aan; sectie "Aanvullende modules" in `/admin/features` via
  `FeatureDef.deprecated`). Uit = geen nieuwe aanvullende oefeningen toevoegen; **al
  gekoppelde blijven altijd werken** (resolver/render is niet gegate).
- **Nooit dominant**: op de Standaard-tab alleen als ingeklapte `<details>`-sectie onder
  de bibliotheek-resultaten (alleen zoekterm-filter, eigen paginering `lpage`), klapt
  automatisch open bij < 3 bibliotheek-hits mét zoekterm. Overal de
  **Aanvullend**-badge (grid, schema-editors, detailpagina's).
- **WEERGAVENAMEN = `formatExerciseName` (`lib/exercise-name.ts`, puur + getest)** — de
  dataset levert álles in kleine letters, wat naast de bibliotheek goedkoop oogt. Twee
  door de eigenaar vastgelegde regels: (1) **élk** woord een hoofdletter, ook
  verbindingswoorden ("Full Range Of Motion") en na `-`/`/` ("3/4 Sit-Up"), maar nooit na
  een apostrof; afkortingen (`ez`, `jm`, `pov`, …) in kapitalen. (2) het dataset-
  voorvoegsel **`lever` → `Machine`** ("lever calf press" → "Machine Calf Press"),
  **alleen als eerste woord** — "Back Lever"/"Front Lever" zijn calisthenics, geen
  apparaat. De functie is **idempotent** (bestaande hoofdletters blijven staan), dus
  herhaald toepassen is veilig. Gebruikt door de seed, beide catalogus-add-paden en het
  normalisatiescript. Tests: `tests/exercise-name.test.ts`.
- **`npm run data:names`** (`scripts/normalize-catalog-names.ts`) schrijft die namen naar
  de database: alle `ExerciseCatalog.name`-rijen (1.324 omgezet) plus de **naam-snapshots**
  op tenant-`Exercise` — maar alléén waar de waarde *letterlijk* de oude catalogusnaam is
  (bewijs dat het de automatische snapshot is, geen handwerk van de sportschool), zelfde
  precedent als `library:lookups`. `--dry-run` / `--skip-snapshots`. `data:import` roept
  het script na afloop aan, zodat een re-import de namen niet terugdraait.
- Import-scripts (`media:upload`/`data:import`/`data:link`) + `AZURE_BLOB_CONTAINER`
  wijzen naar de legacy-container en blijven alleen voor onderhoud van de oude set.

- **`ExerciseCatalog`** (`@@map("exercise_catalog")`) = globaal, **géén `tenantId`/RLS**
  (zoals Tenant/Auth-tabellen). Velden: category/bodyPart/equipment/target/muscleGroup/
  secondaryMuscles + `instructions`/`instructionSteps` (Json per taal) + image/gif-URL.
- **Tenant-`Exercise` cureert**: nieuw veld `catalogId String?` (nullable → eigen
  oefeningen blijven mogelijk). `name`/`description`/`targetMuscle` zijn overrides; media,
  spiergroepen en instructies komen uit de catalogus. Downstream FK's
  (`WorkoutExerciseItem`, `PerformanceEntry`) blijven naar tenant-`Exercise` wijzen.
- **Resolver `lib/exercise.ts`** (`getExerciseDetail`) merget Exercise + catalogus en kiest
  taal via **`getContentLocale`** (UI-taal van de lezer, `tenant.locale` als vangnet — zie
  "TAAL VAN DATASET-CONTENT" in de bibliotheek-sectie) met **EN-fallback** (dataset heeft
  en/es/it/tr/nl).
- **Owner**: `/owner/exercises` doorzoekt de catalogus (filters + paginering) en voegt
  items toe als tenant-`Exercise`; `suggestMachineType()` (lib/machine.ts) stelt een
  MachineType voor, owner kiest de machine. **Member**: detailpagina + machine-QR-pagina
  tonen gif/stappen/spieren (altijd met "raadpleeg een professional"-melding).
- **Scripts** (`scripts/`, idempotent): `media:upload` (Azure), `data:import`
  (catalogus + en→nl vertaling via Azure Translator), `data:link` (naam-koppeling).
  Seed koppelt demo-oefeningen via `catalogName` (exacte, lowercase catalogus-naam).
- **Vertaalstand: compleet** — alle **1.324** rijen hebben nl-instructies én nl-stappen
  (geverifieerd: 0 rijen waar het nl-slot leeg is of identiek aan het Engels). De eerdere
  "deels gevuld"-notitie (Azure F0-throttling) is achterhaald.
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
- **Sets toevoegen én verwijderen (sessie-scoped, blijft staan)**. `SessionOverrides` heeft
  naast `skipped`/`subs` een derde veld **`setCounts: Record<exerciseId, number>`** (geklemd
  op 1..`MAX_SESSION_SETS` = 20, de grens van `setInputSchema`) — gekeyed op de **gerenderde**
  oefening (dus ná een vervanging, net als de log-entries).
  - **Waarom**: een toegevoegde set leefde alleen in client-state. Was 'ie nog leeg, dan stond
    er geen `PerformanceEntry` tegenover en verdween 'ie bij de eerste herrender/schermwissel.
    Nu legt `setSetCount` het aantal vast; `buildActiveSessionView` geeft het door als
    `ActiveExercise.sessionSets` en de initialisatie rekent
    `max(groepsrondes ?? sessionSets ?? schema-sets, hoogste gelogde setnummer, 1)` — een
    gelogde set kan dus nooit verdwijnen, ook niet door een verkeerde teller.
  - **Verwijderen kan altijd, maar alleen de láátste set** (`removeSessionSet`, setNumber ≥ 2):
    zo verschuiven de nummers van opgeslagen sets nooit. Eerder was de knop beperkt tot sets
    *boven* het schema-aantal én ongevinkt — vandaar het "ik kan pas vanaf set 4 verwijderen".
    De op te ruimen sets worden ook echt gewist (`deleteMany` op `setNumber ≥ n`), anders komt
    de set bij herladen terug én blijft 'ie in het volume meetellen. Bij een set mét gegevens
    vraagt de UI eerst om bevestiging (gedeelde modal voor kracht + niet-kracht).
  - **Een nieuwe set erft de waarden van de voorgaande set** (gewicht/reps resp. de logvelden);
    dat is bijna altijd de bedoeling en scheelt getik met zweethanden.
  - Toevoegen/verwijderen zit in beide blokken (`ExerciseBlock`, `DynamicExerciseBlock`) als
    één knoppenrij onderaan de kaart — bewust géén tweede "−"-badge per set erbij.
- **Alternatief terugzetten**: `withoutSub` + `revertSubstitution` (ops) draaien een gekozen
  alternatief terug naar de oorspronkelijke oefening. De op het alternatief gelogde sets
  **blijven** staan (dat werk is echt gedaan en telt in de historie); alleen de weergave gaat
  terug. De action retourneert de identiteit + de al gelogde sets van het origineel, zodat de
  kaart in-place herstelt zonder herladen; de client bewaart daarnaast een snapshot van de
  oefening van vóór de vervanging (`originalSnapshots`) zodat ook "vorige keer" terugkomt —
  na een reload is die weg en vult de server de rest aan.
- **"Training bezig"-balk**: `getRunningSessionStart` (lib/session-timeout.ts, alleen lezen —
  geen write op elke navigatie) voedt `components/member/active-workout-bar.tsx` vanuit
  `app/member/layout.tsx`. Op élke member-pagina, met meelopende klok en directe ingang;
  verbergt zichzelf op `/member/schema/active` (daar staat dezelfde klok al in de
  voortgangsbalk) en toont een sessie voorbij de 5-uur-grens niet meer.
  - **STICKY ZIT OP DE WRAPPER, NIET OP DE BALK.** Header + balk plakken samen als één
    `sticky top-0`-blok in de member-layout. Geef je de balk een eigen `top`-offset, dan moet
    dat getal exact de headerhoogte raken — die is 61px (`py-3` + de `size-9`-belknop), niet
    de 3,25rem die je uit de padding zou schatten, dus de balk schoof bij het scrollen deels
    onder de header en leek te krimpen.
  - **Achtergrond moet dekkend zijn**: `bg-accent-soft-solid` (nieuw token in globals.css:
    zelfde tint als `accent-soft` maar gemengd met `--surface-1` i.p.v. `transparent`, licht
    én donker). `accent-soft` is half-transparant en liet de meescrollende inhoud
    doorschemeren.
- **"Niet opgeslagen" bij een set die daarna wél werkte** — drie oorzaken aangepakt:
  1. `setInputSchema` **weigerde** reps/gewicht buiten bereik (`z.number().int()`), dus een
     kommagetal uit de stepper (12,5 herhalingen) faalde structureel — óók bij "Opnieuw".
     Nu `clampedNumber`: afronden/klemmen i.p.v. afwijzen (geverifieerd: 12,5 → 13).
  2. Twee snelle saves van dezelfde set konden elkaar kruisen → unique-violation (P2002) op
     `(sessionId, exerciseId, setNumber)`. `writePerformanceEntry` vangt P2002 op en werkt de
     rij alsnog bij; gedeeld door `upsertSet` én `upsertLog`.
  3. Client-side `saveWithRetry`: één korte herkansing (600 ms) rond `saveSet`/`saveLog`, zodat
     een hapering (cold start, wegvallende wifi) geen foutmelding meer oplevert.
  Een afgewezen save logt nu ook server-side de reden (`console.warn`) — anders is zo'n melding
  achteraf niet te herleiden.
- **Tests**: `tests/session-overrides.test.ts` (`node:test` via tsx, `npm test` — geen nieuwe
  dep). i18n-keys onder `member.active`/`member.schema` (nl+en+fy).

### Groeperen (supersets/giant/circuit/AMRAP), dropsets & per-lid notitie

Feilloze schema-authoring: een coach groepeert oefeningen (superset, giant/ultra set,
circuit, AMRAP), markeert dropsets, stelt rust vooraf in (presets) en schrijft per
oefening een **per-lid** boodschap. Migratie `20260717120000_schema_exercise_groups`
(toegepast) — alle velden additief + nullable op `WorkoutExerciseItem`, dus geen
RLS-wijziging.

- **Datamodel (vlak op het item, géén apart groep-model)** — de hele codebase leest items
  als platte lijst (actieve sessie/PDF/3-weg-diff/klonen). Een "groep" = opeenvolgende items
  met dezelfde `groupId`. Velden: `groupId`/`groupType` (String, uitbreidbaar zoals
  `exerciseType`)/`groupOrder`/`groupRounds`/`groupRestSeconds`/`groupLabel`/
  `groupTimeCapSeconds` (AMRAP) + `dropsetCount`. Groep-niveau-instellingen worden door de
  editor **consistent op elk groepslid** geschreven (single writer). `memberNote` = per-lid
  coach-boodschap: alleen op lid-schema's, lid-gericht, **nooit** meegesynct vanuit de master.
- **Pure kern `lib/exercise-groups.ts`** (géén `server-only`, ook client — idioom
  `exercise-types.ts`): registry `GROUP_TYPES` + `groupItems()` (adjacency-groepering),
  `groupSummary`/`groupPositionLabel`, `normalizeGroupColumns` (autoritatieve server-clamp,
  gedeeld door owner- én member-save), `pickGroupFields`, `REST_PRESETS_SECONDS`. Tests
  `tests/exercise-groups.test.ts`.
- **Editor** (`components/schema-editor.tsx`): multi-select → "Groepeer als …"; groep-kop
  (type/rondes/rust-ná-groep/label/AMRAP-timecap) + A/B/C-badges + ontgroeperen; dropset-toggle,
  rust-chips + "rust → alle in dag"; `memberNote`-veld via prop `showMemberNote` (aan op
  lid-schema-pagina's). `serializeEditorDay` normaliseert (groepen < 2 leden self-healen naar
  losstaand).
- **TWEE NOTITIE-NIVEAUS, NIET DOOR ELKAAR**: `WorkoutTemplate.coachNote` (de
  "Schema-notitie") hoort bij het **programma** — elk lid dat het schema krijgt leest
  dezelfde tekst — en is daarom **alleen op een library-template bewerkbaar**
  (prop `showCoachNote`, default aan; `false` op `/owner/schemas/members/[userId]` en
  `/owner/schemas/member-built/[id]`, waar de editor de meegekloonde notitie alleen-lezen
  toont). Persoonlijk richting één lid gaat via `WorkoutExerciseItem.memberNote` (per
  oefening) en `AssignedWorkout.trainerMessage` (bij de toewijzing). `saveSchema` is
  autoritatief: op een niet-library-template blijft `template.coachNote` staan (de client
  stuurt het veld daar niet mee, dus zonder die regel zou het wissen); de 3-weg-sync blijft
  de master-notitie doorduwen naar de kopieën. `serializeEditorDay` is verder gedeeld met
  de mobiele lid-builder (`member-schema-editor.tsx`, pariteit: dropset + rust-chips +
  groep-weergave).
- **RUST = ÉÉN BEDIENING (`components/schema/rest-picker.tsx`)**: de rust stond dubbel in beide
  editors — één keer als dynamisch doelveld ("rust (sec)", want `PARAM.rest` heeft
  `column: "restSeconds"` en zit dus in `targetFields`) en één keer als preset-chips; twee
  invoervelden op dezelfde `values.restSeconds`. Nu chips-only: `RestPicker` (30s/60s/90s/2m/3m +
  **Aangepast** → getalveld in seconden, geclampt op de veld-/kader-grenzen) en beide editors
  filteren het rustveld met **`isRestField`** uit de `targetFields`-rij. Voeg je een nieuw
  oefeningstype met rust toe, dan hoef je niets te doen — het loopt automatisch via de picker.
  De owner-editor geeft "→ alle in dag" als `children` mee; de lid-builder geeft de door
  `boundsFor` vernauwde kader-grenzen mee. Groep-rust ("rust ná groep") blijft bewust een eigen
  getalveld in de groep-kop (ander concept, één keer per groep).
- **Downstream**: `schema-diff.ts` draagt groep/dropset als bundel-velden `"group"`/`"dropset"`
  (3-weg-sync); `memberNote` valt er bewust buiten. Klonen/dupliceren nemen groep/dropset mee
  (`cloneToAssignment` laat `memberNote` weg — per lid vers). Member-checklist
  (`schema-checklist.tsx`) + PDF (`lib/schema-pdf.ts` `buildPdfItems`, gedeeld door beide
  PDF-routes) tonen groepen/dropset/`memberNote`.
- **Actieve sessie** (`active-session.tsx` + `lib/active-session-view.ts`): doorlopende lijst
  met groep-kop + A/B/C-badge; **rust-semantiek** via `startRestFor` — géén rusttimer binnen een
  superset/circuit, wél `groupRestSeconds` ná de laatste oefening van de ronde. Dropset-hint +
  `memberNote` (✎) getoond. i18n `member.active.supersetHint/dropsetHint/groupRestAfter` (nl/en/fy).
- **Geleide groep-flow (superset-wizard)**: échte groepen renderen in de actieve sessie
  standaard als **ronde-voor-ronde wizard** (`group-guided-block.tsx`): A1 → B1 → groepsrust →
  A2 → …, met ronde-voortgang, A/B/C-stappen, grote invoer (BigStepper/LogFields), "hierna"-hint
  en per groep een **Geleid ↔ Lijst**-toggle (persist in localStorage per sessie). AMRAP is
  open-ended met een lokale tijdslimiet-klok + rondeteller ("AMRAP afronden" door het lid).
  **Architectuur**: de wizard is puur een andere *weergave* over dezélfde state — de positie is
  volledig **afgeleid** uit opgeslagen sets (pure kern **`lib/guided-group.ts`**:
  `deriveGuidedPosition`/`effectiveGuidedRounds` (rondes = setnummers, cap 20 = log-limiet)/
  `isRoundComplete`; tests `tests/guided-group.test.ts`), dus weergave-wissel/reload verliest
  nooit data. Daarvoor is de niet-kracht-log-state **gelift** naar `ActiveSession` (`DynRow`,
  `DynamicExerciseBlock` is nu controlled; "klaar" = afgeleid `dynExerciseDone`). In een échte
  groep telt het **rondetal als set-aantal** (init van set-/log-rijen). Rust: wizard vuurt
  `requestRest(groupRest)` alléén ná de laatste oefening van een ronde (niet na de laatste
  ronde); binnen de ronde nooit. Overslaan/alternatief/undo werken vanuit de wizard (zelfde
  modals); mislukte opslagen elders in de groep blijven zichtbaar met retry. i18n
  `member.active.guided.*` (nl/en/fy).
- **Bewust (nog) niet**: dropset-logging is hint/markering (geen aparte per-drop sub-entries).

### Spier-heatmap & -analyse (lid)

Een lid ziet op **`/member/muscles`** welke spiergroepen zijn schema traint (body-
heatmap) en of hij het schema volgt (radar: **schema-plan vs. echt getraind, 4 wkn**).
Volledig afgeleid — géén nieuw DB-model, géén migratie.

- **`lib/muscle-map.ts`** (puur, ook client — zoals `exercise-types.ts`): 16 canonieke
  `MuscleRegion`'s (chest/shoulders/biceps/…/calves) met NL-label + aanzicht (front/back).
  `RAW_TO_REGION` normaliseert de vrije spier-labels uit de catalogus (`target`,
  `secondaryMuscles`) én eigen oefeningen (`targetMuscle`, `muscleGroups`) naar een regio;
  `resolveRegion()` is de enige lookup — die dekt de RepDB-slugs (`_` als spatie), de
  afwijkende RepDB-wéérgavenamen ("Side Delts"/"Glute Medius"/"Deep Core"/"Serratus", die
  als vrij label in `targetMuscle` belanden) én Nederlandse labels voor eigen oefeningen
  ("Borst"/"Bilspieren"/…). Meerduidige termen ("benen", "hele lichaam") worden **bewust
  niet gegokt** — liever geen kleur dan de verkeerde spier. Volume-schaal `MUSCLE_LEVELS`
  (0=grijs…5=donkergroen) + `levelForWeeklySets()` (grenzen ~hypertrofie-richtlijn).
  De **telregel** woont hier ook (puur + getest, `tests/muscle-volume.test.ts`):
  `accumulateMuscleVolume(acc, ex, sets)` met `primaryMuscleRaws`/`secondaryMuscleRaws`.
- **BRON-BEWUST (3-weg) — lees dit vóór je aan de spier-analyse werkt.** De telling moet
  `library.primaryMuscles`/`secondaryMuscles` gebruiken bij een bibliotheek-oefening: dat zijn
  de gecureerde slugs (vaak méérdere primaire spieren; die tellen allemaal vol), terwijl
  `Exercise.targetMuscle` daar slechts één afgeleide weergavenaam is. Dit ging eerder mis:
  `exerciseMuscleSelect` selecteerde alleen `targetMuscle`/`catalog`, waardoor na de
  RepDB-migratie **alle** secundaire spieren wegvielen en het demo-schema 3 van 16 regio's
  kleurde i.p.v. 12. De slug-test alléén dekt dit niet af — die bewijst de *mapping*, niet de
  *query*. Voeg `library` dus toe aan élke nieuwe spier-selectie.
- **`lib/muscle-analysis.ts`** (`server-only`): `getMuscleAnalysis(memberId, tenantId)` telt
  wekelijks set-volume per regio uit het actieve schema (**plan**, aanname 1×/week) en uit de
  laatste 28 dagen `PerformanceEntry` (**echt getraind**, ÷4) via `accumulateMuscleVolume`:
  primaire spieren vol, secundaire half (0.5), elke regio max. één keer per oefening.
  Serialiseert `regions[]` (plan/actual/level) + `topRegions`/`neglected`.
  Base `prisma` + expliciete `tenantId` (zoals `member-stats.ts`).
- **Visuals** (client): `components/muscle/body-heatmap.tsx` — een **anatomisch spierfiguur**
  (voor/achter) waarvan de spier-polygonen **gevendord** zijn uit `react-body-highlighter`
  (**MIT**, © 2020 GV79): `components/muscle/body-model-data.ts` (`ANTERIOR`/`POSTERIOR`,
  `BodyPart[] = {region, points[]}`, viewBox `0 0 100 200`) + `body-model-LICENSE.txt`. Het
  figuur is dus géén handgetekende SVG meer maar een pro-spierkaart. De library-muscle-slugs zijn
  bij het genereren gemapt naar onze `MuscleRegion` (bv. `front-deltoids`/`back-deltoids`→`shoulders`,
  `quadriceps`→`quads`, `gluteal`→`glutes`, `left/right-soleus`+`calves`→`calves`); `head`/`neck`/
  `knees` → `region=null` (grijze basis). Het component tekent per `BodyPart` de polygonen, kleurt
  ze op volume-niveau (`MUSCLE_LEVEL_COLOR`), maakt ze klikbaar en highlight de geselecteerde regio.
  **GEDEELDE POLYGONEN (`REGION_SHARED_POLYGON` in lib/muscle-map.ts)**: de MIT-dataset heeft géén
  aparte `lats`-vorm (die zit in `upper-back`), terwijl RepDB `latissimus_dorsi` wél onderscheidt.
  Eén polygoon draagt daarom méérdere regio's: hij kleurt op de **zwaarst belaste** ervan (som zou
  hetzelfde oppervlak dubbel tellen), `aria-label` noemt beide en het detailpaneel splitst ze uit
  met elk hun eigen volume. De geometrie blijft ongemoeid — nooit met de hand splitsen; regenereren
  = de MIT-bron opnieuw mappen. Een test in `tests/muscle-volume.test.ts` dwingt af dat élke regio
  zichtbaar is (eigen polygoon óf gekoppeld) én dat een meelifter op hetzelfde aanzicht staat als
  zijn gastheer — zo kan een nieuwe regio nooit stil onzichtbaar blijven.
  `components/muscle/muscle-comparison.tsx`
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
- **Tenant-admin** beheert eigen leden op `/owner/members` (uitnodigen, (de)activeren,
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
  `inviteMember`, met rolkeuze medewerker/beheerder), (de)activeren/verwijderen/opnieuw
  uitnodigen (hergebruikt `app/owner/members/actions.ts`), rol wisselen (`setMemberRole`)
  en de **rechtenmatrix** (`components/staff/permission-matrix.tsx` → `setStaffPermissions`
  in `app/owner/staff/actions.ts`, `requireOwner` + `role:assign`).
- **LEDEN ↔ TEAM ZIJN GESCHEIDEN LIJSTEN.** `/owner/members` = uitsluitend
  **`TENANT_MEMBER`** (de sportersadministratie), `/owner/staff` = het **team**
  (`TENANT_ADMIN` + `TENANT_STAFF`). Eerder stonden beheerders tússen de leden: het
  toevoegformulier had een rolkeuze "Lid/Beheerder", waardoor een beheerder in de
  ledenlijst, de ledentellingen en de leden-uitnodigingen meeliep. Nu:
  - `listMembers` (lib/members.ts) filtert hard op `role: "TENANT_MEMBER"` (de
    `role`-optie is weg — er valt niets meer te kiezen); de ledenlijst heeft geen
    rolkolom meer en toont alleen `TENANT_MEMBER`-uitnodigingen.
  - `addMember` negeert een meegestuurde rol en maakt altijd een sporter;
    `inviteMember` accepteert alléén de teamrollen (`TEAM_ROLES`) en is dus de staff-kant.
  - **Bulk-import maakt altijd sporters**: `ImportFieldKey` heeft geen `role` meer
    (een "rol"-kolom in een klantbestand zou stil beheerders aanmaken).
  - **Promoveren gebeurt op het ledenprofiel** (`member-edit-form.tsx`, admin-only):
    kies Medewerker/Beheerder → de persoon verdwijnt uit de ledenlijst en verschijnt
    bij Medewerkers. Degraderen kan met dezelfde rol-select op `/owner/staff`.
  - **Zelf-degradatie is geblokkeerd** in `setMemberRole` én `editMember` (spiegelt
    `setMemberActive`/`deleteMember`): een eigenaar sluit zichzelf anders buiten.
  - Alle gedeelde acties revalideren **beide** paden (`/owner/members` + `/owner/staff`).
  - Een beheerder heeft per definitie alle rechten op álle vestigingen, dus zijn kaart
    op `/owner/staff` toont géén rechtenmatrix en géén vestiging-chips.
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

### Organisatie → Vestigingen (Location) + per-vestiging analytics

Expliciete hiërarchie **Organisatie → Vestiging**: `Tenant` = de organisatie/keten
(modelnaam bewust behouden — ~1700 filter-sites, JWT-claim en RLS hangen eraan;
tenant-resolutie is zuiver org-niveau en bleef onaangeraakt), nieuw model **`Location`**
= fysieke vestiging. Elke tenant heeft er minstens één (migratie `20260728120000_locations`
maakte per tenant een "Hoofdvestiging", `isDefault=true`, adres gekopieerd van Tenant) —
géén speciaal geval voor single-location. Tenant-adresvelden blijven als
facturatie-/juridisch adres; `Location` draagt het vestigingsadres + `openingHours` +
**`timezone`** (IANA, default Europe/Amsterdam). `Machine.location`/`ClassSession.location`
(vrije tekst) blijven de **zone/zaal bínnen** de vestiging.

- **Lidmaatschap = de per-tenant `User`-rij** (org-niveau: tenantId + role + active/
  archivedAt) + `homeLocationId` (thuisvestiging). Een lid traint bij élke vestiging van
  de keten zonder tweede lidmaatschap; twee ketens = twee User-rijen, volledig gescheiden.
- **Verplichte `locationId`** (ON DELETE RESTRICT → vestiging met historie alleen
  archiveerbaar) op `Machine`, `WorkoutSession`, `ClassSession`, `MachineScan` (snapshot
  van de machine-vestiging op scanmoment) en `MaintenanceRecord` (idem). Nullable:
  `User.homeLocationId`, `Measurement`, `AuditLog` (geen FK — forensisch),
  `EarnedAchievement` (geen FK — weergave). Bewust géén locationId: `GroupClass`
  (les-definitie is org-niveau; de sessie kiest), `PerformanceEntry`/`ClassEnrollment`
  (erven via de sessie), `MaintenancePolicy` (org-brede type-defaults) en `AiUsage`
  (metering, geen vestigingsactiviteit). **Checklist nieuwe activiteitstabel**:
  locationId + tenantId, tabel in `prisma/sql/rls.sql`, scope-helpers gebruiken,
  analytics-index `(tenantId, locationId, tijdstip)`.
- **Sessie-locatie-resolutie** (`lib/location-resolve.ts`, één pad): expliciete keuze →
  device-cookie `gymrebel-location` (action `setActiveLocation`, switcher
  `components/member/location-switcher.tsx` op `/member/schema`, alleen zichtbaar bij
  multi-vestiging) → `User.homeLocationId` → default-vestiging. Trainer-sessie = vestiging
  van de **trainer**; machine-scan = vestiging van de **machine** (anonieme scans blijven
  werken). `lib/locations.ts`: `getTenantLocations` (per-request cache),
  `getDefaultLocationId`, `isMultiLocation`.
- **Toegang is een RESTRICTIE** (anders dan de additieve coach-lens): `StaffLocationAccess`
  (patroon CoachAssignment) koppelt medewerker↔vestiging; **zonder koppelingen ziet staff
  níéts** (fail-closed; migratie koppelde bestaande staff aan de default-vestiging).
  TENANT_ADMIN/SUPERADMIN = impliciet alle vestigingen. Pure kern
  **`lib/location-scope.ts`**: `LocationScope` (`org`|`locations`), `accessibleLocations`,
  `locationScopeWhere`/`sessionLocationWhere` (dragen ALTIJD tenantId), `canRollUp`
  (org-totaal is admin-only), `assertLocationAccess`, `scopeCacheKey`. Server-laag
  `lib/location-access.ts` (`getLocationScope`, `requireLocationAccess`). Rollen: geen
  nieuwe enum — "vestigingsmanager" = TENANT_STAFF + koppeling(en) + permissie
  **`analytics:view`** (staff-configureerbaar, default uit); **`locations:manage`** is
  admin-only (beheer op `/owner/locations`: CRUD, precies-één-default, archiveren,
  toegangsmatrix).
- **CACHE-KEY-REGEL (lek-risico)**: élke `unstable_cache` met een scope-parameter MOET
  `scopeCacheKey(scope)` in de keyParts hebben — anders deelt een vestigingsmanager tot
  300s de cache met de eigenaar (er zijn geen revalidateTag-call-sites om dat te purgen).
- **Telregels — gedeeld, nooit ad hoc** (`lib/metrics/definitions.ts`, puur + getest):
  **bezoek** = trainingssessie óf ATTENDED-les-deelname; **actieve leden org** = distinct
  lidmaatschappen, **per vestiging** = distinct-actief-aldáár → vestigingstotalen tellen
  bewust NIET op tot het org-totaal (UI toont verplicht de `NonAdditiveNote`); **bezoeken**
  wél optelbaar; **retentie** = aandeel van maand M dat in M+1 terugkeert; dag/uur-bucketing
  ALTIJD in de vestiging-tijdzone (`hourPartsInTz`, nooit servertijd);
  `ACTIVE_MEMBER_WHERE` = dé actief-lid-definitie (role+active+archivedAt) — overal
  hergebruiken. Server-querylaag `lib/metrics/queries.ts` (`getLocationComparison`:
  per-vestiging-rijen + org-totalen alleen bij `canRollUp`); UI op `/owner/insights`
  (guard `analytics:view`, vestiging-tabs, vergelijking + bezetting-heatmap + machinetabel)
  + dashboard-widget `location-comparison` (multi-vestiging, admin).
- **Aanwezigheid/no-shows**: `enum EnrollmentStatus` op `ClassEnrollment`
  (ENROLLED/CANCELLED/ATTENDED/NO_SHOW; migratie `20260728130000_class_attendance`,
  historie gebackfilled naar ATTENDED). Uitschrijven = status CANCELLED (géén hard delete;
  her-inschrijven = zelfde rij terug naar ENROLLED); **capaciteit telt alleen
  ENROLLED+ATTENDED** (`lib/class-attendance.ts` — élke tel-site gebruikt dit). Staff
  markeert aanwezigheid op het les-detail (`markAttendance`, schedule:manage +
  requireLocationAccess); cron `class-attendance` zet ENROLLED → NO_SHOW 12u na `endsAt`.
- **Trofee-scopes** (`lib/achievements/scope.ts`): `AchievementDef.scope` =
  `ORGANIZATION` (default, eenmalig per lidmaatschap) | `LOCATION` (telt per vestiging,
  per vestiging behaalbaar) | `GLOBAL` (platform-gedefinieerd, locatie-agnostisch bínnen
  de org — cross-org-identiteit bestaat bewust niet). Unieke sleutel
  `EarnedAchievement @@unique([tenantId,userId,key,locationScopeKey])`
  (`""` = org/global, locationId bij LOCATION) houdt `createMany(skipDuplicates)` werkend.
- **Meldingen**: onderhoudsmeldingen gaan alleen naar beheerders mét toegang tot de
  vestiging van de machine (`lib/maintenance/notify.ts`, deny-by-default).
- **Tests**: `tests/location-scope.test.ts` (spec b+c), `tests/location-metrics.test.ts`
  (spec a + TZ + retentie + no-shows), `tests/achievement-scope.test.ts` (spec d),
  `tests/class-attendance.test.ts`.
- **Vestiging archiveren is geblokkeerd zolang er komende groepslessen staan**
  (`setLocationArchived` → `?err=lessen`-banner op het vestiging-detail):
  anders blijven sessies boekbaar op een gesloten locatie. Vangnet voor
  bestaande data: `enroll` behandelt een sessie op een gearchiveerde vestiging
  als gesloten.
- Openingstijden zijn **per vestiging** bewerkbaar op de vestiging-form (zelfde
  `hours_<dag>`-idioom als de tenant-form; alles leeg = vestiging-tijden gewist → het lid
  ziet de organisatie-tijden als vangnet op `/member/gym`).
- Staff-vestiging-koppelingen zijn op twee plekken beheerbaar: de matrix op het
  vestiging-detail én **chips per medewerker op `/owner/staff`** (zelfde action
  `setStaffLocationAccess`; waarschuwing bij nul koppelingen — fail-closed).
- Het member-rooster filtert bij multi-vestiging **standaard op de eigen
  (actieve/thuis)vestiging** (`?loc=all` / `?loc=<id>` via filter-chips); "Mijn lessen"
  blijft bewust ongefilterd zodat eigen aanmeldingen elders altijd zichtbaar zijn.

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

### Probleem melden aan de developers (/admin/meldingen)

Gebruikers (leden én sportschool-gebruikers) melden bugs/feedback/vragen over
**de app zelf** (niet apparatuur) aan het GymRebel-team. Eén inbox voor het
team met herkomst-onderscheid; automatisch meegestuurde technische context.

- **Datamodel**: `AppReport` + `ReportQuota` (migratie `20260729120000_app_reports`)
  zijn **globale tabellen zoals AuditLog** — géén FK's (forensisch), géén RLS,
  base `prisma`. `reporterRole` = Role-string (herkomst afgeleid:
  `TENANT_MEMBER`/null = lid, rest = sportschool); `reportedById` null = anoniem.
  `ReportQuota` staat **los van de inhoud**: bij een anonieme melding wordt wél
  een quota-rij met userId geschreven (geen koppeling naar wélke melding →
  anonimiteit blijft, daglimiet geldt toch). `ipHash` = HMAC(AUTH_SECRET, ip)
  voor niet-ingelogde submits; het ruwe IP wordt nergens opgeslagen.
- **Whitelist-context `lib/report-context.ts`** (puur, ook client + test):
  `sanitizeReportContext` houdt uitsluitend `REPORT_CONTEXT_KEYS` over
  (route/appVersion/buildId/platform/os/device/screen/ua/locale/clientErrors),
  trunceert en scrubt secret-achtige substrings (Bearer/JWT/cookie/token-query)
  uit vrije tekst. **Client verzamelt, server saneert autoritatief.** Test:
  `tests/report-context.test.ts` (expliciet: nooit token/cookie/Authorization).
  Ringbuffer laatste 5 client-errors: `lib/report-client-errors.ts`, gevuld door
  `components/error/client-error-recorder.tsx` (gemount in `app/layout.tsx`);
  `useReportContext()` (lib/hooks) bundelt alles. `appVersion` =
  `CHANGELOG[0].version`; `buildId` = `NEXT_PUBLIC_BUILD_ID` (next.config.ts ←
  `VERCEL_GIT_COMMIT_SHA`, lokaal "dev").
- **Intake `POST /api/reports`** (bewust route-handler, geen server action —
  `app/global-error.tsx` heeft geen providers en meldt met een kale fetch):
  zod, daglimiet 10/gebruiker resp. 5/ipHash (patroon AiUsage), screenshot via
  `uploadReportScreenshot` (lib/blob.ts — **géén data-URL-fallback**; zonder
  Blob-token wordt alleen de screenshot geweigerd), crash-vlag → severity HIGH,
  piek-detectie ≥3/uur zelfde route → `notifyDevTeamImmediate`.
- **Meldknop**: `components/reports/report-problem-modal.tsx` (type/titel/
  omschrijving, screenshot-opt-in mét preview, anoniem- en contact-toggles,
  uitklapbare "Dit sturen we mee"-samenvatting = exact het verstuurde object,
  referentienummer na verzenden). Plekken: user-menu, side-nav-drawer,
  member-drawer, foutpagina's (preset-vlag `actions.report` in lib/errors.ts →
  crash-prefill incl. `error.digest`), global-error (self-contained mini-knop).
  i18n `report.*` (nl/en/fy volledig).
- **Inbox `/admin/meldingen`** (superadmin-only; NL hardcoded per admin-
  precedent): tellers (nieuw vandaag/open/open per versie), URL-filters
  (herkomst/type/status/severity/platform/versie/gym/periode/zoek —
  `lib/report-query.ts`, spiegel audit-query; namen batch-gefetcht want geen
  FK's), detailmodal met screenshot, techcontext, **audit-afgeleide status-
  tijdlijn** (geen apart event-model) en acties status/severity/duplicaat/
  interne notitie/GitHub-issue (`app/admin/meldingen/actions.ts`).
  **Screenshot-proxy** `/admin/meldingen/[id]/screenshot`: de blob-URL verlaat
  de server nooit (Vercel Blob kent geen private ACL — bescherming = onraadbare
  key + deze auth-route).
- **`/admin` = 404 voor tenant-gebruikers**: proxy.ts rewrite naar `/__404`
  (ingelogde niet-superadmin; niet-ingelogd houdt de login-redirect) +
  `notFound()` in `app/admin/layout.tsx` als defense-in-depth. Het admin-gebied
  lijkt daardoor niet te bestaan.
- **Notificaties `lib/reports/`**: `notify.ts` (BLOCKER-opschaling & piek →
  e-mail naar `getSupportEmail()`; RESOLVED → melder alléén bij
  `contactAllowed`, in-app categorie `system` + gebrande mail in eigen taal),
  `github.ts` (`GITHUB_TOKEN` + `GITHUB_REPO`, issue zonder melder-PII →
  `externalRef`). **Geen Slack** — bewust verwijderd, niet herintroduceren;
  team-alerts gaan per e-mail. Composers
  `reportAlertMessage`/`reportDigestMessage`/`reportResolvedMessage` in
  lib/email/messages.ts. Alles best-effort.
- **Crons** (vercel.json): `reports-digest` (dagelijks 8u, skip bij 0) en
  `reports-retention` (dagelijks 4u — screenshots `REPORT_SCREENSHOT_RETENTION_DAYS`
  (183) na afronding wissen; **eerste `del()`-gebruik van @vercel/blob**).
- **AVG**: account-export bevat eigen (niet-anonieme) meldingen;
  account-verwijdering nult `reportedById` (inhoud blijft forensisch, zoals
  AuditLog) en wist `ReportQuota`-rijen.
- **Audit**: categorie `reports` — `report.create/status.change/severity.change/
  duplicate.link/note.update/github.create/notify.sent/retention.cleanup`.

### Apparaatdefect melden aan de sportschool (EquipmentDefect)

Leden melden defecte apparaten aan de **eigen sportschool** (los van AppReport,
dat naar de developers gaat). Behandeling door trainers/beheer per vestiging;
een gevaarlijke melding blokkeert het apparaat direct.

- **Datamodel** (migratie `20260730120000_equipment_defects`, tenant+location-
  scoped + RLS): `EquipmentDefect` (status `DefectStatus OPEN|ACKNOWLEDGED|
  IN_REPAIR|RESOLVED|REJECTED`, severity `DefectSeverity MINOR|MAJOR|UNSAFE`,
  `symptom` String uit de code-registry, `machineLabel` naam-snapshot óf vrije
  tekst bij `machineId null`, `photoKeys[]`, `duplicateOfId`, `digestedAt`
  digest-marker), `DefectConfirmation` ("ik zie dit ook", uniek per lid) en
  `DefectQuota` (daglimiet 10, patroon ReportQuota — quota-rij mét userId óók
  bij anoniem, zonder koppeling naar wélke melding). `Tenant.defectReminderDays`
  (achterstand-termijn, `/owner/settings`). User-FK's `SetNull` → account-
  verwijdering anonimiseert. **Géén `isOutOfService`-veld**: UNSAFE zet het
  bestaande `Machine.status = OUT_OF_SERVICE` (in dezélfde transactie als de
  create) en vrijgeven zet 'm terug op ACTIVE.
- **Pure kern `lib/defects.ts`** (ook client): `DEFECT_SYMPTOMS` (vaste lijst,
  per `MachineType` gefilterd via `symptomsForMachineType`), status/severity-
  meta, `CONFIRM_BUMP_THRESHOLD = 3`, `bumpSeverity` (MINOR→MAJOR, **nooit**
  naar UNSAFE), achterstand-helpers. Tests `tests/defects.test.ts`.
- **Serverlaag `lib/defects-server.ts`**: scope-bewuste queries via
  `locationScopeWhere` (fail-closed); **cross-locatie/-tenant = `notFound()`**
  (404, geen 403 — bewust anders dan `requireLocationAccess`). Ook
  `machineWarningMap` (open MAJOR/UNSAFE per machine) en `hasOtherOpenUnsafe`
  (vrijgeef-guard).
- **Member-flow**: `components/defects/report-defect-modal.tsx` (i18n `defects`,
  nl/en/fy) — symptoom-chips, max 2 foto's (AVG-hint), veiligheidsvraag (→
  UNSAFE), anoniem-toggle (`reportedById null`), duplicaatcheck ("ik zie dit
  ook" → `confirmDefect`; 3 bevestigingen → severity-bump + directe melding).
  Instappen: QR-pagina (voorgevuld, ≤3 taps), `/member/defects` (picker + eigen
  meldingen), member-drawer. Actions `app/member/defects/actions.ts`
  (`requireMember` + `requireFeature`).
- **Doorwerking buiten gebruik**: `findAlternatives` sluit
  OUT_OF_SERVICE/IN_MAINTENANCE-machines uit; QR-pagina toont banner (rood =
  buiten gebruik, amber = open MAJOR) en verbergt+blokkeert "voeg toe aan
  schema".
- **Owner-dashboard `/owner/defects`** (`requirePermission("defects:manage")` —
  nieuwe staff-configureerbare permissie, standaard aan): tabel op ernst →
  leeftijd (UNSAFE rood bovenaan), filters, "vaakst gemeld" (90 d), detail met
  statustijdlijn/meldhistorie/interne notitie en acties (bevestigen/toewijzen/
  in-reparatie/oplossen mét verplichte notitie + vrijgeven — alleen als er geen
  ándere open UNSAFE ligt/afwijzen/samenvoegen; verwijderen + termijn
  admin-only). **Foto's**: Blob-URL komt nooit naar de client — beschermde
  route `/owner/defects/[id]/photo/[index]` streamt server-side (AVG).
- **Meldingen** (`lib/defects/notify.ts`, spiegel maintenance/notify; categorie
  `defects`): UNSAFE + escalatie direct naar behandelaars mét vestiging-toegang
  (deny-by-default); melder krijgt kort bericht bij RESOLVED (niet-anoniem).
  Composer `defectAlertMessage`. **Cron `defects`** (dagelijks 6:30,
  `lib/defects/digest.ts`): samenvatting per vestiging (nieuw MINOR/MAJOR
  idempotent via `digestedAt`; achterstand > `defectReminderDays` herhaalt) +
  AVG-opschoning (foto's 12 mnd, meldingen 24 mnd na afronding).
- **Feature-flag `defects`** (default aan) gate't alles; audit-categorie
  `defects` (`defect.create/confirm/…/digest.sent/cleanup`); AVG-export bevat
  eigen niet-anonieme meldingen. Seed: `seedDefects("gymrebel")`.

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

### Merk-assets & Brand Book-kleuren (GymRebel zelf)

Het GymRebel-logo (beeldmerk "GR"-halter + woordmerk) en het Brand Book-palet zitten in
de app. **Whitelabel blijft leidend**: dit is het *platform*merk, geen tenant-huisstijl.

- **Eén bron van waarheid = `components/brand/logo-art.ts`** (puur, ook client — idioom
  `exercise-types.ts`): `BRAND` (het palet) + de vector-geometrie (`MARK_BARS`,
  `MARK_MONOGRAM`, `WORDMARK_GYM`, `WORDMARK_REBEL`). Zowel de React-componenten als het
  generator-script lezen dáár uit, dus een bestand in `public/` kan nooit uit de pas lopen
  met wat de UI rendert.
- **React**: `components/brand/gymrebel-logo.tsx` → `GymRebelMark` (alleen het beeldmerk,
  volgt `currentColor`), `GymRebelWordmark` en `GymRebelLogo` (horizontale lockup).
  **Inline SVG, geen `<img>`**: het merk moet mee kunnen kleuren met z'n ondergrond
  (wit op een accent-tegel, charcoal op licht) en een `<img>` erft geen `currentColor`.
  `tone="mono"` zet óók "REBEL" op `currentColor` — nodig zodra het logo óp het accent
  staat, want oranje-op-oranje verdwijnt.
- **Statische bestanden**: `npm run brand:assets` (`scripts/generate-brand-assets.ts`,
  rasteriseert met het al aanwezige `@resvg/resvg-js`) schrijft `public/brand/*.svg`
  (mark, horizontale + gestapelde lockup in licht/donker/mono, app-icoon),
  `public/favicon.svg`, `public/icons/*.png` (PWA + apple-touch, maskable met 80%-veilige
  zone), `app/favicon.ico` (16/32/48 in één container), het **e-maillogo** en de
  **Android-iconen**. Idempotent — vervangt het oude `icons:generate` met z'n
  placeholder-halter.
- **E-MAILLOGO IS PNG, NOOIT SVG** (`public/brand/gymrebel-logo-email.png`): Gmail en
  Outlook weigeren SVG in `<img>`. Wit-op-transparant, want `renderEmailLayout` zet de
  header altijd op een accentbalk (oranje-op-oranje zou wegvallen). 480 px breed = 3× de
  weergavemaat van 160 px.
- **Android (Capacitor)**: het script overschrijft `android/app/src/main/res` als die map
  bestaat — launcher (5 dichtheden), rond icoon, adaptive **foreground** en de splash in
  alle 11 formaten, plus `values/ic_launcher_background.xml` op Rebel Orange (het
  adaptive-icon leest die kleurresource, niet de gelijknamige drawable). De foreground
  beslaat maximaal **58%** van het 108dp-canvas: Android maskeert tot een cirkel van ~66dp
  en de halter is breed, dus meer betekent afgesneden gewichtschijven. **Draai het script
  opnieuw na elke `npx cap add android`** — Capacitor zet dan zijn eigen placeholders terug.
- **URL'S DIE DE APP VERLATEN LOPEN VIA `lib/app-url.ts`** (`appBaseUrl`/`toAbsoluteUrl`,
  getest in `tests/app-url.test.ts`): in een mailbox of een PDF bestaat `/brand/logo.png`
  niet. `resolveEmailBranding`, `embedRemoteImage` (PDF) en `loadLogoDataUri` (QR) maken
  een relatief pad daarom absoluut; een al absolute Blob-URL blijft ongemoeid. Zonder dit
  viel het logo van élke tenant met een relatief pad stil weg.
  - **Keten: `APP_BASE_URL` → `AUTH_URL` → `NEXTAUTH_URL` → `https://app.gymrebel-training.com`.**
    Schrijf die keten **nergens opnieuw uit** — de crons, `lib/{defects,maintenance,reports}/`
    en `lib/passkey.ts` (rpID/origin) roepen allemaal `appBaseUrl()` aan.
  - **`APP_BASE_URL` bestaat omdat `AUTH_URL` géén neutrale instelling is.** NextAuth
    herschrijft met `reqWithEnvURL()` (next-auth/lib/env.js) de origin van **élke**
    request naar `AUTH_URL`, óók in de proxy. Stond die op de Vercel-deploy-URL, dan
    bouwde `proxy.ts` z'n login-redirect met `new URL("/login", nextUrl)` op díé host en
    werd elke bezoeker van het eigen domein naar `*.vercel.app` gestuurd (zichtbaar aan
    de cookie `__Secure-authjs.callback-url`). Een vaste waarde botst bovendien met
    tenant-subdomeinen: een lid op `fitpower.gymrebel-training.com` wordt er bij elke
    middleware-redirect afgetrokken. In productie mag `AUTH_URL` dus leeg —
    `trustHost: true` (auth.config.ts) leidt de origin af uit de request — mits
    `APP_BASE_URL` gezet is.
- **WAAR HET LOGO WÉL EN NIET MAG.** Alleen waar GymRebel zélf de afzender is:
  `/admin` (superadmin), de pre-tenant landingspagina, login **zonder** tenant, de
  offline-/crashpagina en de PWA-iconen. Een sportschool zónder eigen logo houdt haar
  **initiaal-tegel** — daar het GymRebel-merk tonen zou de whitelabel-belofte breken
  (ontwerpprincipe: geen GymRebel-branding hardcoded in de tenant-UI). De demo-tenant
  `gymrebel` krijgt het logo wél, maar via het gewone `Tenant.logoUrl`-veld (seed).
- **Palet (Brand Book)**: Rebel Orange `#FF4D00` (default `--tenant-accent`, vervangt het
  oude `#E84B1F`), Deep Orange `#FF6A1A`, Charcoal `#111111`, Slate `#1E1E1E`, Black
  `#000000`, White. Het donkere thema mapt die drie neutralen letterlijk op de
  vlak-hiërarchie: Black = pagina, Charcoal = kaart, Slate = verhoogd. De neutralen zijn
  bewust **kleurloos** (de eerdere blauwzweem vocht met het oranje).
  `readableText("#FF4D00")` blijft wit (3,3:1) — getest in `tests/color-contrast.test.ts`.
- **Whitelabel in e-mail**: een tenant **zonder** eigen logo houdt de tekst-wordmark met
  háár naam; alleen de platformmail (geen tenant) krijgt het GymRebel-woordmerk. Zelfde
  regel als in de UI.
- **Nog open**: het Brand Book schrijft ook typografie voor (Poppins ExtraBold koppen +
  Inter body) terwijl de app op Geist/Space Grotesk draait. Besluit ligt bij de eigenaar;
  omzetten is één blok in `app/layout.tsx` (beide staan in `next/font/google`) plus de
  koppen nalopen op gewicht (ExtraBold is te zwaar onder ~24 px).

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
  GymRebel-defaults (accent `#ff4d00`, Rebel Orange). `readableText(hex)` kiest knop-tekstkleur.
  Gebruikt bewust de base `prisma` (Tenant heeft geen RLS).
- **`layout.ts`** (`renderEmailLayout`) — de centrale HTML-shell: table-based,
  600px, inline CSS, `<style>` met responsive + `prefers-color-scheme:dark`, MSO
  conditionals, verborgen preheader, branded header (logo/wordmark) + footer
  (contact, socials, reden, auto-bericht, copyright). `scheme` (`"auto"` default |
  `"light"` | `"dark"`) forceert één weergave zonder media-query — de
  template-preview gebruikt dat (licht/donker-schakelaar in de editor).
- **`components.ts`** — table-safe string-bouwstenen (`emailButton` = bulletproof
  VML-knop, `emailHeading/Paragraph/Muted/Divider/LinkFallback/InfoCard`,
  `escapeHtml` voor álle gebruikers-/tenant-input).
- **LEESBAARHEID IN DARK MODE = `!important` + de `dm-*`-klassen.** E-mailinhoud
  draagt **inline** kleuren (verplicht voor Outlook/Gmail) en die winnen van een
  gewone klasse-regel. De dark-mode-CSS kleurde daarom alleen de kaart donker,
  terwijl elke `<h1>`/`<p>` op `#1f2937` bleef staan: **1,2:1 — onleesbaar**.
  `DARK_RULES` (layout.ts) zet nu álles met `!important`, want een
  `!important`-declaratie uit het `<style>`-blok verslaat wél een inline `style`.
  Bouwstenen dragen `dm-text`/`dm-muted`/`dm-panel`/`dm-divider`; daarnaast is er
  een **vangnetregel** `.dm-card h1,…,p,td,span,strong,li` zodat óók door de
  Superadmin geschreven template-HTML (die onze klassen niet kent) leesbaar
  blijft. **`<a>` staat bewust NIET in dat vangnet** — dat zou het knoplabel
  overschrijven en `accentText` op een licht accent slopen. Nieuwe bouwsteen =
  de passende `dm-*`-klasse meegeven; test `tests/color-contrast.test.ts`.
- **Knop-/headertekst = `readableText`** (lib/color.ts, puur + gedeeld met
  `--tenant-accent-foreground`): wit zolang dat ≥ 3:1 haalt, anders donkergrijs.
  De oude luminantie-grens (0,55) gaf **wit op geel/limoen** (~1,8:1); donkere en
  middeldonkere accenten (o.a. het GymRebel-oranje) houden gewoon wit.
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
- **UITNODIGINGEN ZIJN TRANSACTIONEEL, GEEN MELDING.** `createInvitation`
  (lib/invitation.ts) loopt bewust **niet** langs `shouldNotifyByEmail` — net als de
  magic link en de e-mailverificatie: zonder die mail komt de ontvanger niet binnen.
  Dat ging eerder mis: e-mail staat per categorie standaard **uit** (alleen `schemas`
  staat aan), dus elke (her)uitnodiging naar een adres dat al een `User`-rij had
  verdween stil terwijl de UI "opnieuw verzonden" meldde. De categorie `invitations`
  bestaat nog voor reeds opgeslagen voorkeuren maar stuurt niets meer aan en staat
  daarom **niet** meer in `/account/meldingen`. Niet opnieuw als gate gebruiken.
- **BEZORGRESULTAAT WORDT GEREGISTREERD, NOOIT AANGENOMEN.** `sendEmail` geeft
  `"sent" | "logged"` terug; `sendInviteEmail`/`createInvitation` geven dat door
  (die gooiden het eerder weg, waardoor niemand kon zien of er echt iets wegging).
  `createInvitation` audit **zelf** `user.invite.email` (`{email, delivery}`, status
  `FAILED` bij `logged`) zodat geen enkel uitnodig-pad dat kan vergeten; de
  call-site-audits (`user.invite`/`user.invite.resend`) dragen `delivery` als extra
  metadata. `listPendingInvitations` leidt `lastDelivery` af uit die auditregel
  (**geen extra kolom**, zelfde patroon als de statustijdlijn bij app-meldingen) →
  badge "E-mail niet verstuurd" in `PendingInvitationsTable`. Ook zichtbaar in het
  superadmin-uitnodigingsformulier, de import-wizard en op `/invite/[token]`
  (`?resent=0`). **Let op**: Graph verstuurt app-only vanuit `GRAPH_SENDER`, en de
  JSON-fallback zet `saveToSentItems: false` — de Verzonden-map is dus géén bewijs
  van (niet-)verzending, het auditlog wel.

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
  in een sandboxed `<iframe srcDoc>` (device-toggle desktop/tablet/mobiel +
  **licht/donker-toggle** — de preview forceert het schema via `renderPreview`, want de
  iframe zou anders de dark-mode van de beheerder z'n eigen browser volgen + tenant-selector
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
- **DE OFFLINE-FALLBACK IS STATISCHE HTML, GEEN NEXT-ROUTE** — `public/offline.html`,
  geserveerd door `public/sw.js` als een navigatie faalt. Dit hoort níét bij de
  presets hierboven: een App Router-pagina precachet alleen haar HTML, terwijl haar
  JS-chunks een build-hash dragen en dus niet in `PRECACHE` kunnen staan. Offline
  faalden die chunks, herlaadde de Next-runtime, kreeg opnieuw de fallback en faalde
  opnieuw — een **zichtbaar flikkerende offline-pagina**. De vorige `app/offline/page.tsx`
  is daarom verwijderd. Het bestand heeft als enige **externe** bron
  `/icons/icon-192.png`, dat `sw.js` meeprecachet; voeg er nooit een asset aan toe zonder
  die in `PRECACHE` te zetten. Een **inline** script mag wél — dat laadt niets bij en kan
  de faalmodus hierboven dus niet terugbrengen (zelfde afweging als
  `capacitor/www/error.html`). Wijzig je `offline.html` of `PRECACHE`, **hoog dan `CACHE`
  op** (`activate` wist alleen ándere cacheversies, dus anders houden bestaande clients
  hun oude kopie). Tekst is hardcoded NL: de fallback wordt één keer bij install gecachet
  en had als Next-route sowieso al de taal van dát moment bevroren; de ongebruikte
  `errors.offline`-sleutels staan nog in `messages/*.json`.
  - **GEEN `dvh` OP DEZE PAGINA, MAAR `svh`.** De inhoud staat verticaal gecentreerd in
    een `min-height`-container. `dvh` is per definitie dynamisch: hij krimpt en groeit mee
    terwijl de mobiele browserbalk in- en uitschuift, dus hercentreerde de hele kolom
    zichtbaar. `svh` gaat uit van de kleinste viewport en blijft staan (met `100vh` als
    terugval erboven).
  - **"Probeer opnieuw" navigeert niet als het toestel aantoonbaar offline is**
    (`navigator.onLine === false` → `preventDefault`). Die navigatie faalde toch en de
    SW serveerde dezelfde pagina opnieuw: een volledige herlaadbeurt met flits en nul
    resultaat. In plaats daarvan verschijnt een statusregel die zijn ruimte **altijd**
    bezet houdt (`visibility`, geen `display`) zodat er niets verspringt. Zonder JS blijft
    de link een gewone navigatie; `online` triggert alsnog automatisch verdergaan.
- **De service worker draait óók in development** (`ServiceWorkerRegister` in
  `app/layout.tsx` heeft geen productie-gate). Stopt of herstart de dev server, dan
  serveert de SW dus de offline-pagina. Dat is correct gedrag, geen bug — in DevTools
  "Bypass for network" aanzetten of de SW unregistreren.

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
  100% taal-onafhankelijk. **Dataset-content** (oefeningteksten) volgt dezelfde regel via
  `getContentLocale` — zie "TAAL VAN DATASET-CONTENT" in de bibliotheek-sectie.
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

### Native apps: App Store + Play Store (Capacitor)

Beide apps zijn **Capacitor-wrappers** rond de gehoste site (`server.url`). De TWA
voor Android is uitgefaseerd: één wrapper-technologie voor beide stores. Volledige
operationele handleiding in **`capacitor/README.md`**; publiceerchecklist,
testplan en store-metadata in **`store/`**.

- **Identiteit (onveranderlijk na publicatie)**: bundle ID/package name
  `nl.gymrebeltraining.app`, host `app.gymrebel-training.com`. Het koppelteken uit
  het websitedomein kán niet in een Android-package-name (alleen letters, cijfers,
  underscores). Env: `CAPACITOR_APP_ID`, `CAPACITOR_SERVER_URL`,
  `ANDROID_PACKAGE_NAME`, `NEXT_PUBLIC_APP_DOMAIN`.
  **De `nl.`-prefix blijft**, ook nu het domein `.com` is: een package-name is een
  reverse-DNS identifier, geen URL, en is onveranderlijk zodra er gepubliceerd is.
- **GEEN GEBUNDELDE BUILD, EN DAT KAN OOK NIET.** De app draait op RSC + Server
  Actions + Prisma; er bestaat geen statische `out/` (`output: "export"` sluit
  server actions en de proxy uit). Gevolg: web-wijzigingen zijn direct live zonder
  store-review, maar zónder netwerk werkt de app niet. Opgevangen met
  `server.errorPath` → `capacitor/www/error.html` (gebrand, herstelt bij `online`).
  Capacitor documenteert `server.url` zelf als "not intended for production".
- **Apple-richtlijn 4.2** is het reële publicatierisico, niet de techniek. De
  verdediging is de native laag die er al ligt: haptics, camera-QR, APNs-push,
  passkeys. Geef de reviewer een **lid**-account, geen owner-account: die ziet dan
  QR-scannen bij een apparaat in plaats van een desktop-dashboard op een telefoon.
  De app is als **sporter-app** gepositioneerd (store-teksten/screenshots), maar
  staff wordt **niet** geblokkeerd — dat zou mobiel zinvolle taken afpakken
  (defect afhandelen bij het apparaat, aanwezigheid afvinken).
- **`ios/` staat niet in de repo** en is niet op Windows te genereren (Xcode en
  CocoaPods zijn macOS-only). Daarom is alles wat iOS raakt een **script** dat na
  `npx cap add ios` draait: `npm run ios:plist` (Info.plist-sleutels, idempotent)
  en `npm run brand:assets` (vult `Assets.xcassets`). Capabilities (Push,
  Associated Domains) zijn entitlements en blijven handwerk in Xcode.
- **iOS-app-icoon zonder alfakanaal.** resvg levert altijd RGBA; App Store Connect
  weigert dat met `ITMS-90717`. `pngOpaque()` in de merkgenerator plat het af.
- **Android-meldingsicoon = alfa-silhouet in `drawable-*`** (`ic_stat_gymrebel`).
  Android gebruikt alléén het alfakanaal; een gekleurd icoon wordt een witte blob.
  Bewust drawable en niet mipmap: FCM zoekt een drawable op naam.
- **Versiebeheer**: `app-version.json` is de enige bron; `npm run version:sync` /
  `:bump` / `:check` schrijven naar Gradle en Info.plist. Eén buildteller voor
  beide platforms. **Niet verwarren met `lib/changelog.ts`**, dat een marketing-
  label voor release notes is en los mag lopen.
- **Signing** leest uit `android/keystore.properties` of uit env (CI). Zonder die
  gegevens wordt er géén signingConfig gezet, zodat uploaden zichtbaar faalt in
  plaats van stil een verkeerd getekend artefact op te leveren. Keystores en
  `google-services.json` staan in `.gitignore`. `minifyEnabled` blijft **uit**
  (Capacitor-plugins gaan via reflectie); de debug-build krijgt bewust **geen**
  `applicationIdSuffix`, want dat breekt App Links-verificatie en FCM.

### Push op alle drie de kanalen (web, APNs, FCM)

`sendPushToUser` (lib/push.ts) bedient **web-push (VAPID) + APNs (iOS) + FCM
(Android)**. Die derde was er niet, waardoor een Android-app wél een token
registreerde maar nooit iets ontving: de Capacitor-WebView krijgt géén
service-worker-push, dus web-push bereikt alleen browsers en geïnstalleerde PWA's.

- **`lib/push-fcm.ts`** spiegelt `push-apns.ts`. **Dependency-vrij**: het
  access-token is een RS256-JWT via `node:crypto`, gecacht (1 uur). Env
  `FCM_PROJECT_ID` / `FCM_CLIENT_EMAIL` / `FCM_PRIVATE_KEY`; de app heeft daarnaast
  `android/app/google-services.json` nodig. Zonder config: nette no-op.
- **`lib/push-channels.ts`** (puur) = Android-meldingskanalen per
  `NotificationCategory`, met eigen `importance`: een onveilig apparaat mag
  onderbreken (4), een trofee niet (2). Zonder expliciete kanalen belandt alles in
  Androids naamloze "Overig" en kan de gebruiker alleen álles tegelijk uitzetten.
  **De categorie is een apart veld op `PushPayload`, nooit afgeleid uit `tag`** —
  die tags lopen niet gelijk met de categorieën ("achievement" vs "achievements").
  Het vangnet-kanaal moet gelijk blijven aan `default_notification_channel_id` in
  `strings.xml`; `tests/push-channels.test.ts` bewaakt die driewegkoppeling.
- **Voorgrond**: iOS via `presentationOptions` (banner+sound), Android via een
  in-app toast in `native-push-register.tsx`. Zonder dat is een melding tijdens
  gebruik volledig onzichtbaar.
- **Token intrekken bij uitloggen** (`native-push-cleanup.tsx`, gemount op
  `/login`). Het token hoort bij het *toestel*, niet bij de sessie: zonder dit
  leest iemand die je telefoon leent op het vergrendelscherm mee. Op het
  loginscherm en niet in de uitlogknop, want uitloggen redirect direct en er zijn
  meerdere uitwegen (uitlogknop, "log overal uit", verlopen sessie).
- **Deep links**: `components/pwa/deep-link-handler.tsx` (`appUrlOpen`). Zonder
  deze listener opent een magic link de app wél, maar op de startpagina in plaats
  van op de inloglink. Volgt alleen paden binnen de eigen host — een custom scheme
  (`nl.gymrebeltraining.app://`) kan door elke app op het toestel worden afgevuurd.

### Publieke informatiepagina's (`/privacy`, `/cookies`, `/support`)

Store-vereiste: privacy-URL én support-URL moeten **zonder login** te openen zijn,
anders wordt de app afgekeurd. Apple accepteert geen `mailto:` als support-URL.
Gedeelde shell `components/public/info-page.tsx`; bewust **buiten** de
tenant-huisstijl (platformmerk), want de afzender is GymRebel, niet een sportschool.

- `lib/legal.ts` = bedrijfsgegevens + verwerkerslijst. ⚠️ `LEGAL_ENTITY` staat nog
  op `TODO` voor adres en KvK; de teksten zijn niet juridisch getoetst.
- Het cookiebeleid legt vast waaróm er geen toestemmingsbanner is: alle cookies
  zijn functioneel of een expliciete voorkeur. Voeg je ooit analytics toe, dan is
  een banner verplicht en moet die pagina mee.
- **Accountverwijdering voldoet al aan Apple 5.1.1(v)**: self-service op
  `/account/privacy` + `api/cron/delete-accounts` voert 'm na de bedenktijd
  automatisch uit. Geen beheerder-tussenstap.

## RLS-policies toepassen (vastgelegd in prompt 04)

De row-level-security policies staan in `prisma/sql/rls.sql` (buiten `prisma/migrations/`,
anders ziet `prisma migrate` het als een migratie).
- **Development**: toepassen met `npm run db:rls` (na een schema-migratie).
- **Productie/CI**: als aparte stap in de deploy-pipeline draaien na `prisma migrate deploy`.
- Elke query zet de tenant-context via `set_config('app.current_tenant', ...)` (zie
  `lib/tenant-db.ts`).
