# GymRebel — Bouwgids voor Claude Code

**Een gestructureerde serie prompts om de GymRebel SaaS-app stap voor stap te bouwen met Claude Code in VS Code, met Git als backbone.**

Versie 1.0 — gebaseerd op de Technische Notitie v1.0

---

## Hoe je deze gids gebruikt

Dit is geen mega-prompt. Het is een **script van ~14 kleine prompts**, elk strak afgebakend, die je één voor één aan Claude Code voert. Tussen elke prompt zit een commit. Zo blijft het werk traceerbaar, terugdraaibaar en review-baar.

### Werkwijze per prompt

1. **Lees** de prompt
2. **Paste** in Claude Code (`claude` terminal of de VS Code extension)
3. **Wacht** tot Claude klaar is — beoordeel wat hij heeft gedaan
4. **Test** lokaal (`npm run dev`, of wat de prompt voorschrijft)
5. **Commit** met de meegegeven commit-boodschap
6. **Push** naar GitHub — Vercel maakt automatisch een preview deploy
7. **Door** naar de volgende prompt

### Vuistregels

- Werk altijd in een **feature branch** (`feat/01-foundation`, `feat/02-auth`, …)
- **Merge naar `main`** pas als een fase volledig werkt
- Bij twijfel: vraag Claude Code om eerst een **plan** te maken vóór hij code schrijft
- **Lees de diffs** — niet blind accepteren
- Als iets niet werkt: zeg `dit werkt niet, herstel naar de laatste commit en probeer anders`

---

## Eenmalige setup (vóór prompt 01)

### 1. Lokale tools

```bash
# Node.js 20+ (check: node -v)
# Claude Code:
npm install -g @anthropic-ai/claude-code

# VS Code extensions die handig zijn:
# - GitLens
# - Prisma (voor het ORM)
# - Tailwind CSS IntelliSense
# - ESLint
```

### 2. GitHub & lokale repo

```bash
# Maak een lege private GitHub repo: github.com/<jij>/gymrebel
git clone git@github.com:<jij>/gymrebel.git
cd gymrebel
code .  # opent VS Code
```

### 3. Vercel account

- Maak een account op vercel.com
- Connect je GitHub repo
- Kies **Europe** als region (Frankfurt of Dublin)

### 4. PostgreSQL — kies één

- **Neon** (neon.tech, gratis tier, EU regio) — aanbevolen voor MVP
- **Vercel Postgres** (Vercel dashboard → Storage → Postgres)
- **Supabase** (supabase.com, EU regio)

Bewaar de connection string in een veilige plek — Claude vraagt erom in prompt 02.

### 5. CLAUDE.md aanmaken

Plaats het bestand `CLAUDE.md` in de root van je repo (zie volgende sectie). Claude Code leest dit automatisch bij elke sessie als basis-context. **Dit is je belangrijkste tool om consistente output te krijgen.**

---

## CLAUDE.md — projectcontext

Maak `CLAUDE.md` in de root van je repo met onderstaande inhoud:

```markdown
# GymRebel — Project Context

GymRebel is een multitenant SaaS-app voor sportscholen. Elke sportschool is een aparte tenant met eigen leden, apparatuur, schema's en huisstijl. Onder de motorkap één codebase.

## Stack

- **Framework**: Next.js 15 (App Router, React Server Components)
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
```

**Tip:** commit deze `CLAUDE.md` direct na aanmaken. Update hem zodra een open beslissing valt of een architectuur-keuze verandert.

---

# Het promptscript

## Fase 1 — Foundation

### Prompt 01 — Project scaffolding

**Branch:** `feat/01-foundation`

> Maak een nieuwe Next.js 15-app aan met TypeScript (strict), Tailwind CSS v4, ESLint en de App Router. Gebruik `npx create-next-app@latest .` met de juiste flags, geen src-directory, geen experimentele features tenzij we ze nodig hebben.
>
> Daarna:
> 1. Installeer Prisma (`prisma`, `@prisma/client`) en initialiseer het met PostgreSQL als provider.
> 2. Maak een `.env.example` met `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `BLOB_READ_WRITE_TOKEN`.
> 3. Voeg een `.gitignore`-regel toe voor `.env`, `.env.local`, en alle Next.js/Prisma generated files.
> 4. Maak een `README.md` met een korte intro, link naar `CLAUDE.md`, en hoe je lokaal start.
> 5. Voeg een basis-mappenstructuur toe: `app/`, `lib/`, `components/ui/`, `prisma/`, `types/`.
> 6. Configureer Tailwind met een tijdelijk neutraal palet (zwart, wit, accent-oranje #E84B1F) als CSS custom properties zodat we later per tenant kunnen overschrijven.
> 7. Vervang de placeholder homepage door een simpele "GymRebel — under construction" pagina in Nederlands.
>
> Aan het einde: bevestig dat `npm run dev` lokaal start zonder errors.

**Verificatie:** `npm run dev` → open `http://localhost:3000` → zie de placeholder pagina.

**Commit:** `chore: scaffold next.js + prisma + tailwind`

**Push & merge** naar `main`.

---

### Prompt 02 — Database schema & multitenant fundament

**Branch:** `feat/02-multitenant`

> Maak het basis Prisma-schema voor de GymRebel-app. Werk in `prisma/schema.prisma`.
>
> Modellen:
> - `Tenant` — id (cuid), slug (unique, voor subdomein), name, logoUrl, accentColor, locale (NL/EN/FY default NL), aiEnabled (Boolean default false), createdAt, updatedAt
> - `User` — id (cuid), email (unique), name, role (enum MEMBER | OWNER), tenantId (relation), createdAt
>     - email is unique per tenant, dus combineer met tenantId als composite unique
> - `Machine` — id, tenantId, name, type, description, instructionsMd (text), videoUrl, qrToken (unique), createdAt
> - `Exercise` — id, tenantId, name, description, targetMuscle, machineId (nullable, want sommige oefeningen zijn lichaamsgewicht)
> - `WorkoutTemplate` — id, tenantId, name, description, isLibrary (Boolean, default false) — als true zichtbaar als template
> - `WorkoutExerciseItem` — koppelt Exercise aan WorkoutTemplate met sets, reps, restSeconds
> - `AssignedWorkout` — id, tenantId, userId (MEMBER), templateId (nullable), customName (als handmatig gebouwd)
> - `Session` — id, tenantId, userId, startedAt, endedAt
> - `PerformanceEntry` — id, tenantId, sessionId, exerciseId, setNumber, reps, weightKg, notes
>
> Voeg op alle modellen behalve `Tenant` een `tenantId String` en een relation naar `Tenant`. Voeg op alle modellen `@@index([tenantId])`.
>
> Maak vervolgens een migration: `npx prisma migrate dev --name init`. Genereer de Prisma client.
>
> Maak `lib/db.ts` met een singleton Prisma client (voorkom hot-reload connection issues).
>
> Voeg in `prisma/seed.ts` een seed-script toe dat één demo-tenant aanmaakt ("FitPower Leeuwarden", slug "fitpower") met één owner, drie members, vijf machines, tien oefeningen, twee library templates. Update `package.json` met de seed-config.
>
> Run de seed na de migration. Bevestig dat je in `npx prisma studio` de data ziet.
>
> **Belangrijk:** schrijf NIET de RLS-policies in deze prompt — dat doen we in prompt 04 wanneer auth en tenant-context staan.

**Verificatie:** `npx prisma studio` → zie tenants, users, machines, etc. met seed-data.

**Commit:** `feat: prisma schema + seed for multi-tenant data`

---

### Prompt 03 — Authentication & rollen

**Branch:** `feat/03-auth`

> Installeer NextAuth v5 (Auth.js) met de Prisma-adapter. Gebruik email magic links als primaire login (via Resend of een lokale dev-provider). OAuth (Google) kunnen we later toevoegen.
>
> Stappen:
> 1. Installeer: `next-auth@beta`, `@auth/prisma-adapter`, `nodemailer` (voor email), `resend` voor productie.
> 2. Voeg de Auth.js-modellen toe aan Prisma (Account, Session, VerificationToken). Migrate.
> 3. Maak `auth.ts` in de root met de NextAuth-configuratie. De `session` callback moet `user.role`, `user.tenantId` en `user.email` toevoegen aan de session-token.
> 4. Maak een login-pagina op `/login` met email-input. Gebruik Server Action.
> 5. Maak een `middleware.ts` die member- en owner-routes beschermt: `/app/(member)/*` vereist `MEMBER`-rol, `/app/(owner)/*` vereist `OWNER`-rol. Niet-ingelogd → redirect naar `/login`.
> 6. Maak `app/(member)/layout.tsx` en `app/(owner)/layout.tsx` als minimale shells met hun eigen navigation.
> 7. Maak een logout-actie.
> 8. Voor dev: implementeer de email-provider zo dat magic links in de console worden gelogd (geen echte mail-versturing nodig nu).
>
> Test handmatig: log in als de owner uit de seed, kom op `/app/(owner)`. Log in als een member, kom op `/app/(member)`. Probeer cross-access — moet redirecten.

**Verificatie:** beide rollen kunnen inloggen en op hun eigen pagina komen. Cross-access werkt niet.

**Commit:** `feat: auth with member/owner roles via next-auth`

---

### Prompt 04 — Tenant-resolutie & whitelabel theming

**Branch:** `feat/04-tenant-theming`

> Implementeer tenant-resolutie: in productie via subdomein (`fitpower.gymrebel.app`), in development via query parameter (`?tenant=fitpower`) of een env var.
>
> Stappen:
> 1. Maak `lib/tenant.ts` met een functie `getCurrentTenant()` die uit de request de tenant-slug haalt en de Tenant uit de database fetcht (cache deze server-side per request).
> 2. Update de `middleware.ts` zodat de tenant-slug uit de hostname (subdomein) of `?tenant`-param wordt gehaald en in headers wordt gezet (`x-tenant-slug`).
> 3. Maak een React Context (Server Component-vriendelijk via wrapper) die de tenant beschikbaar maakt in alle pagina's.
> 4. Build een `<ThemeProvider>` component dat de tenant's `accentColor` en `logoUrl` injecteert als CSS custom properties op het root-element.
> 5. Vervang in de bestaande pagina's alle hardcoded "GymRebel" door `tenant.name`. Vervang hardcoded accentkleuren door `var(--tenant-accent)`.
> 6. Maak een `/login` flow die ook de tenant uit de URL pakt en de gebruiker scoped op die tenant authentiseert. Twee gebruikers met hetzelfde emailadres maar verschillende tenants moeten allebei kunnen inloggen.
> 7. Schrijf nu wél de RLS-policies. Maak `prisma/migrations/manual/rls.sql` met `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` en `CREATE POLICY tenant_isolation ON ... USING (tenant_id = current_setting('app.current_tenant')::text)` voor alle tenant-scoped tabellen. Documenteer in CLAUDE.md hoe deze applied wordt (handmatig in dev, via migrations CI in prod).
> 8. Update `lib/db.ts`: de Prisma client moet bij elke query `SET app.current_tenant = '<slug>'` uitvoeren. Gebruik Prisma middleware of een wrapper.
>
> Test: log in op de "fitpower" tenant. Probeer via Prisma Studio direct data van een andere tenant te queryen — moet leeg zijn.

**Verificatie:** twee tenants kunnen naast elkaar bestaan zonder cross-access. Logo en kleur per tenant zichtbaar.

**Commit:** `feat: tenant resolution + RLS + theming`

---

## Fase 2 — Owner functionaliteit

### Prompt 05 — Owner: machine-management

**Branch:** `feat/05-machines`

> Bouw de machine-beheerinterface voor de owner.
>
> Routes onder `/app/(owner)/machines`:
> - `page.tsx` — lijst van alle machines van deze tenant. Toon naam, type, foto-thumbnail, of QR is gegenereerd.
> - `new/page.tsx` — formulier om een machine toe te voegen.
> - `[id]/page.tsx` — detail/edit view.
>
> Velden in het formulier: naam (verplicht), type (dropdown: cardio / kracht / vrije gewichten / overig), beschrijving (textarea), instructie (markdown textarea), videoUrl (optional URL), foto-upload (via Vercel Blob).
>
> Gebruik:
> - Server Actions voor create/update/delete (Zod-validatie).
> - `react-markdown` voor de instructie-preview.
> - Vercel Blob (`@vercel/blob`) voor de foto-upload.
> - Toon de machines in een tabel met sorteer- en zoekfunctie (mag client-side).
>
> Genereer bij creation automatisch een `qrToken` (random 16-char string). Toon op de detail-pagina een knop "Download QR-code" die de QR genereert (gebruik `qrcode` npm package) als PNG download, met de URL `https://<tenant>.gymrebel.app/m/<qrToken>`.
>
> Niet bouwen: bulk import, categorieën, machine-availability scheduling — buiten scope.

**Verificatie:** owner kan een machine toevoegen, bewerken, een foto uploaden en een QR-code downloaden.

**Commit:** `feat: machine management for owners`

---

### Prompt 06 — Owner: schema-beheer (templates + per lid)

**Branch:** `feat/06-schemas`

> Bouw de schema-beheerinterface. Twee soorten schema's:
> 1. **Templates** (`isLibrary = true`) — herbruikbare bibliotheek
> 2. **AssignedWorkout** — schema dat aan een specifiek lid is toegewezen
>
> Routes onder `/app/(owner)/schemas`:
> - `templates/page.tsx` — lijst templates met "nieuw"-knop
> - `templates/[id]/page.tsx` — edit een template (naam, beschrijving, lijst oefeningen met sets/reps/rust)
> - `members/page.tsx` — lijst van members met hun toegewezen schema's
> - `members/[userId]/page.tsx` — wijs een schema toe of bouw handmatig een schema voor dit lid (kan starten vanaf een template — "kopieer en pas aan")
>
> Bij het toevoegen van oefeningen aan een schema: laat alleen oefeningen zien waarvan de gekoppelde Machine in déze tenant bestaat. Voor lichaamsgewicht-oefeningen (machineId null): altijd zichtbaar.
>
> Gebruik:
> - Drag-and-drop voor het ordenen van oefeningen binnen een schema (`@dnd-kit/sortable`).
> - Server Actions voor alle mutaties.
> - Voor de edit-page een "save" knop die alles atomair opslaat (transactie).
>
> Niet bouwen: schema-versie-historie, AI-gegenereerde schema's, gedeelde schema's tussen tenants.

**Verificatie:** owner kan een template aanmaken, een lid een schema toewijzen (vanaf template of from scratch), en alleen relevante oefeningen verschijnen.

**Commit:** `feat: workout templates and per-member assignments`

---

### Prompt 07 — Owner: gebruiksinzichten dashboard

**Branch:** `feat/07-insights`

> Bouw het owner-dashboard met gebruiksinzichten. Dit is **geen onderhoudstool** — het toont bedrijfsmatige informatie: welke apparatuur is populair, op welke momenten piekt het gebruik.
>
> Op `/app/(owner)` (home dashboard):
> - Totaal aantal actieve leden vandaag (members met session vandaag)
> - Top 5 meest-gebruikte machines deze week (op basis van PerformanceEntry → Exercise → Machine)
> - Bottom 3 minst-gebruikte machines deze maand
> - Een eenvoudige bar chart van sessies per dag-van-de-week (laatste 30 dagen)
> - Een eenvoudige line chart van totaal aantal sessies per week (laatste 12 weken)
>
> Op `/app/(owner)/insights` (dieper dashboard):
> - Tabel met alle machines, gebruiksaantallen (sessions, total reps), trend (deze maand vs vorige).
> - Filter op periode (laatste 7 / 30 / 90 dagen).
>
> Gebruik:
> - `recharts` voor de grafieken
> - Server-side aggregaties via Prisma `groupBy`
> - Cache de queries kort (revalidate elke 5 minuten via Next.js cache)
>
> Niet bouwen: real-time updates, export naar Excel/CSV, drill-down per uur van de dag (later eventueel), ledenactiviteit per persoon.

**Verificatie:** owner ziet bij login direct zinvolle cijfers uit de seed-data. Grafieken renderen correct.

**Commit:** `feat: owner insights dashboard`

---

## Fase 3 — Member functionaliteit

### Prompt 08 — Member: home & schema view

**Branch:** `feat/08-member-home`

> Bouw de member-home en schema-detail. **Mobile-first** — design voor 5-inch touch. Grote knoppen, veel witruimte, duidelijke acties.
>
> Routes onder `/app/(member)`:
> - `page.tsx` — home: groet (naam), het schema dat vandaag op het programma staat (als toegewezen), een grote "Start training" knop, en een prominente "Scan machine"-knop (link naar `/app/(member)/scan`).
> - `schema/page.tsx` — toon het actief toegewezen schema (oefeningen, sets, reps). Items afvinkbaar (client-side state — voortgang persisteren bij Start Training).
> - `history/page.tsx` — overzicht van eerdere sessies, met een lijngrafiek van gewicht per oefening over tijd.
>
> Visueel: gebruik de tenant-accentkleur voor primaire knoppen. Grijs/zwart voor alles anders. Geen schreeuwerige badges of gradients.
>
> Niet bouwen: deelfuncties, sociale elementen, push-notificaties (PWA-config komt later).

**Verificatie:** member logt in, ziet zijn schema, kan oefeningen aanvinken.

**Commit:** `feat: member home and schema view`

---

### Prompt 09 — Member: QR-scan & machine info

**Branch:** `feat/09-qr-machine`

> Bouw de QR-scan-flow en machine-detailpagina voor de member.
>
> Routes:
> - `/app/(member)/scan/page.tsx` — opent de camera (via `react-qr-reader` of `html5-qrcode`), scant een QR-code, redirect naar `/m/<qrToken>`.
> - `/m/[qrToken]/page.tsx` — public-ish route (still tenant-scoped), toont machine-info: naam, foto, instructie (rendered markdown), embedded video als aanwezig, en onderaan **altijd** een prominent kader met "Twijfel? Vraag een trainer." (de verplichte veiligheidsmelding).
>
> Belangrijke details:
> - De qrToken-lookup moet 404 geven als de machine niet bij de actieve tenant hoort.
> - Mobiel-vriendelijk: foto bovenaan groot, instructies eronder, scrollable.
> - Geef ook een "Voeg toe aan mijn schema"-knop als de member een AssignedWorkout heeft.
>
> Niet bouwen: AR-overlay, machine-availability check, comments.

**Verificatie:** scan van een QR uit prompt 05 brengt je naar de juiste machine-pagina. De veiligheidsmelding is altijd zichtbaar.

**Commit:** `feat: QR scan + machine info pages`

---

### Prompt 10 — Member: prestatie-tracking

**Branch:** `feat/10-tracking`

> Bouw de prestatie-tracking. Tijdens een sessie kan een member per oefening sets, reps en gewicht invoeren.
>
> Op `/app/(member)/schema/active/page.tsx`:
> - Start-knop op `schema/page.tsx` creëert een nieuwe `Session` en redirect hierheen.
> - Toont de oefeningen één voor één (of als lijst — keuze aan jou, ga met wat mobiel het prettigst werkt).
> - Per oefening: kleine inputs voor reps + kg per set. Save bij blur of bij volgende oefening.
> - Eind van de training: "Klaar" knop sluit de session (zet `endedAt`).
>
> Op `/app/(member)/history/exercise/[id]/page.tsx`:
> - Lijngrafiek met progressie (max gewicht per sessie, of geschatte 1RM).
> - Lijst van laatste 20 sessies met die oefening.
>
> Belangrijk:
> - Alle inputs via Server Actions, niet via API routes.
> - Optimistische UI: input → meteen zichtbaar, server sync op de achtergrond.
>
> Niet bouwen: rust-timer met geluid, supersets, drop sets, tempo-tracking, RPE.

**Verificatie:** member voert een complete sessie in met meerdere oefeningen en sets, ziet die terug in history.

**Commit:** `feat: performance tracking during workouts`

---

## Fase 4 — Optionele uitbreidingen

### Prompt 11 — Optionele AI-assistent

**Branch:** `feat/11-ai`

> Voeg de optionele AI-assistent toe — alleen actief als de tenant `aiEnabled = true` heeft.
>
> Maak `lib/ai.ts`:
> - Wrapper rond OpenAI of Anthropic (kies één — neem aan dat je de keuze in `CLAUDE.md` updatet zodra je beslist hebt; werk hier met OpenAI, gemakkelijk te switchen).
> - Functie `askGymAssistant(question, context)` waarbij `context` de tenant's machine-bibliotheek + de user's huidige schema bevat.
> - System prompt expliciet: "Geef nooit medische diagnose. Bij pijn, blessure of medische twijfel: stuur door naar een professional. Beperk antwoorden tot oefeningen die in déze sportschool beschikbaar zijn (lijst meegegeven). Antwoord in dezelfde taal als de vraag."
>
> UI:
> - Op `/app/(member)` een chat-bubble rechtsonder (alleen als `aiEnabled`).
> - Click → modal met chatinterface. Geen geschiedenis tussen sessies bewaren (privacy + simpler).
> - Rate-limit per member: max 20 vragen per dag (in-memory of via Upstash Redis).
>
> Owner-controles:
> - In `/app/(owner)/settings` een toggle voor `aiEnabled`.
> - Display: aantal vragen deze maand (voor kostenmonitoring).
>
> **Belangrijk**: bouw een hard fallback in — als het AI-antwoord de woorden "diagnose", "medisch advies", "geneesmiddel" of "blessure" bevat, vervang het antwoord met de standaard "raadpleeg een professional"-melding.

**Verificatie:** met `aiEnabled=true` werkt de chat. Met `false` is hij volledig onzichtbaar. Een vraag over pijn triggert de safety-fallback.

**Commit:** `feat: optional AI assistant with safety guardrails`

---

### Prompt 12 — Groepslessen (rooster)

**Branch:** `feat/12-rooster`

> Voeg het lesrooster toe — alleen voor tenants die groepslessen hebben.
>
> Modellen toevoegen aan Prisma:
> - `GroupClass` — id, tenantId, name, description, instructorName, maxParticipants
> - `ClassSession` — id, tenantId, classId, startsAt, endsAt, location
> - `ClassEnrollment` — id, sessionId, userId, enrolledAt
>
> Migrate.
>
> Owner-routes onder `/app/(owner)/rooster`:
> - Lijst groepslessen + planner-view (week-overzicht)
> - Toevoegen/wijzigen sessies (datum + tijd + max-aantal)
>
> Member-routes onder `/app/(member)/rooster`:
> - Week-overzicht met beschikbare plekken (genre Google Calendar maar simpler)
> - "Aanmelden"-knop per sessie (atomair: check max niet overschreden, anders "vol")
> - "Mijn lessen" overzicht
>
> Niet bouwen: wachtlijst, recurring lessons-builder (laat owner per keer aanmaken voor MVP), cancellation policies, betaling.

**Verificatie:** owner plant een les, member meldt zich aan, max wordt gerespecteerd.

**Commit:** `feat: group classes scheduling`

---

### Prompt 13 — Printklare schema's

**Branch:** `feat/13-print`

> Voeg een printklare PDF toe van het toegewezen schema.
>
> Op `/app/(member)/schema/page.tsx` een knop "Download als PDF". Server Action genereert een nette PDF met:
> - Header: lidnaam, schema-naam, datum
> - Tabel met oefeningen, machines, sets, reps, gewichtssuggestie, kolom voor handmatig invullen
> - Footer met tenant-logo en de melding "Bij twijfel: vraag een trainer."
>
> Gebruik `@react-pdf/renderer` of `pdf-lib`. Genereer server-side, stream als download.
>
> Niet bouwen: customizable templates, branded printtemplates per tenant (alleen logo erop).

**Verificatie:** PDF downloadt netjes, ziet er presentabel uit, A4-formaat.

**Commit:** `feat: printable PDF for assigned workouts`

---

### Prompt 14 — Meertalig (NL / EN / Frysk)

**Branch:** `feat/14-i18n`

> Voeg meertaligheid toe. Talen: Nederlands (default), Engels, Frysk. Configureerbaar per tenant via `tenant.locale`.
>
> Gebruik `next-intl`.
>
> Stappen:
> 1. Installeer `next-intl` en configureer voor de App Router.
> 2. Maak `messages/nl.json`, `messages/en.json`, `messages/fy.json` met alle UI-strings die je tot nu toe hebt gebruikt.
> 3. Wrap routes in een `<NextIntlClientProvider>`.
> 4. Vervang alle hardcoded NL-strings door `useTranslations()` calls.
> 5. Op de owner settings: dropdown voor `locale` per tenant.
> 6. Voor Frysk: gebruik een eerste vertaling — laat duidelijk in de tekst zien welke strings nog ruwe NL zijn (placeholder). Owner kan later aanvullen.
>
> Niet bouwen: per-member taal-keuze (alleen tenant-niveau voor MVP), automatic translation, locale-detection via browser.

**Verificatie:** wijzig de tenant-locale van NL naar EN naar FY — UI verandert mee.

**Commit:** `feat: i18n with NL/EN/Frysk per tenant`

---

# Tussen-fase: Productie-deploy

Voor je verder gaat met meer features, doe dit:

### Vercel productie-deploy

1. Push `main` naar GitHub.
2. In Vercel: configureer environment variables (DATABASE_URL, NEXTAUTH_SECRET, etc.).
3. Zet de region op Frankfurt of Dublin.
4. Configureer een **wildcard subdomain**: `*.gymrebel.app` → Vercel.
5. Test productie: maak een test-tenant aan via een aparte admin-flow (later prompt — voor nu doe je dat handmatig via Prisma Studio in prod).

### Monitoring

- Sentry voor error tracking (gratis tier)
- Vercel Analytics ingebouwd

---

# Tips voor effectief werken met Claude Code

## 1. Eerst plan, dan code

Voor grote prompts, vraag: *"Maak eerst een plan voordat je code schrijft. Laat me het plan reviewen."* Voorkomt grote refactors achteraf.

## 2. Beperk de scope expliciet

Elke prompt eindigt met een "**Niet bouwen**" sectie. Dat houdt Claude binnen scope.

## 3. Test-eerst voor kritieke logica

Voor RLS-policies, tenant-isolatie, auth-flows: vraag Claude om eerst tests te schrijven die bewijzen dat de isolatie werkt. Dan de implementatie.

## 4. Lees de diffs

Voordat je commit: `git diff --staged`. Begrijp wat er gewijzigd is. Claude maakt soms onverwachte aanpassingen elders.

## 5. CLAUDE.md actief houden

Update `CLAUDE.md` zodra je beslissingen valt of conventies vastlegt. Het is je belangrijkste persistente geheugen tussen sessies.

## 6. Bij vastzitten

- *"Maak eerst een minimaal werkend voorbeeld, dan breiden we uit."*
- *"Wat zijn drie verschillende aanpakken? Vergelijk de trade-offs."*
- *"Lees [bestand X] en leg uit hoe het werkt voordat je het wijzigt."*

## 7. Recovery

Als een prompt fout gaat:
```bash
git checkout .       # reset working dir
git reset --hard HEAD  # reset all staged
```

Of in Claude Code: `/clear` start een verse sessie zonder context-pollution.

---

# Wat NIET in deze gids staat

Dit script bouwt de **technische app**. Wat hier niet in zit en wel ergens vandaan moet komen:

- **Huisstijl van GymRebel zelf** (logo, kleuren, typografie) — komt van Keimpe's commerciële traject. Tot dan: neutraal palet.
- **Marketingsite** (gymrebel.app als landing page) — los project, niet hier.
- **Pricing & billing** — komt later, hangt af van het verdienmodel.
- **Onboarding flow voor nieuwe gyms** — handmatig voor de eerste pilots; geautomatiseerd in fase 3.
- **Customer support tooling** — voor de eerste gyms doe je dat met directe lijn (Slack/mail/bellen).

---

# Slot

Met dit script bouw je de complete MVP en de meeste fase-2 features. Vooral de eerste vier prompts (foundation) zijn cruciaal — daar zit het multitenant-DNA. Doe die zorgvuldig, lees elke diff, en commit klein.

Als je vastloopt, ga terug naar de Technische Notitie v1.0 voor de waarom achter de keuzes.

Succes — en commit vaak.

**— GymRebel team**
