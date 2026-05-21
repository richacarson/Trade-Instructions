# IOWN Trade Instructions Dashboard

A shared, multi-user dashboard for the IOWN investment team to turn client-meeting
trade instructions into trackable tasks — with owners, status, multi-step
checklists, an activity log, and a staleness indicator that surfaces work that
has been sitting too long.

Built to prevent the failure mode where instructions are captured once, partially
executed, and then never re-read.

---

## Status

- **Phase 1 — Dashboard MVP:** built (this repo).
- **Phase 2 — Screenshot ingestion CLI:** not started. It will be added after
  Phase 1 is deployed and confirmed working.

---

## Tech stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Frontend   | React 18 + Vite + Tailwind CSS, deployed to GitHub Pages      |
| Routing    | React Router (`HashRouter` — works on GitHub Pages with no server config) |
| Backend    | Supabase (Postgres + Auth + Realtime + Row Level Security)    |
| Auth       | Supabase Auth — email + password, account creation locked to an email allowlist |

---

## Project structure

```
.
├── web/                      # React app
│   ├── src/
│   │   ├── components/        # Layout, badges, Logo, selects, etc.
│   │   ├── lib/               # supabase client, auth provider, helpers
│   │   ├── pages/             # Login, Home, ClientList, ClientDetail, …
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── .env.example
│   └── package.json
├── supabase/
│   ├── migrations/0001_init.sql   # schema + RLS + triggers + realtime
│   └── seed.sql                   # allowlist seed
└── .github/workflows/deploy.yml   # GitHub Pages deployment
```

---

## Setup

### 1. Create a Supabase project

1. Go to <https://supabase.com> and create a new project.
2. Note the project's **Project URL** and **anon public key** from
   **Project Settings → API**. You will also need the **service_role key** later
   for Phase 2 — do not put it in the web app.

### 2. Create the database schema

1. Open **SQL Editor** in the Supabase dashboard.
2. Paste the entire contents of `supabase/migrations/0001_init.sql` and run it.
   This creates all tables, indexes, triggers, Row Level Security policies, and
   adds the realtime tables to the `supabase_realtime` publication.
3. Paste the contents of `supabase/migrations/0002_signup_allowlist.sql` and run
   it. This locks account creation to allowlisted emails.

### 3. Seed the allowlist

Only emails in the `allowed_users` table can sign in.

1. **Edit `supabase/seed.sql` first** — replace every `lastname` placeholder with
   each teammate's real work email. This is the address they will use to create
   their account and sign in (matching is case-insensitive).
2. Paste the edited `seed.sql` into the SQL Editor and run it.

Add or remove people later:

```sql
insert into allowed_users (email) values ('first.last@paradiem.org')
  on conflict (email) do nothing;

delete from allowed_users where email = 'first.last@paradiem.org';
```

### 4. Sign-in: email + password

No company IT/admin access is required. Sign-in uses Supabase's built-in email +
password auth, and the `0002` migration locks account creation to the allowlist —
so only the emails seeded in step 3 can ever register. Each teammate chooses
their own password.

In the Supabase dashboard:

1. **Authentication → Sign In / Providers → Email** is enabled by default — leave
   it on.
2. In the Email provider settings, turn **Confirm email** OFF. New teammates
   then pick a password and get straight in, with no confirmation email to wait
   for — the allowlist is what keeps outsiders out. (Have everyone sign up within
   the first day or two after launch.)
3. **Authentication → URL Configuration → Site URL:**
   `https://richacarson.github.io/trade-instructions/`
   (the app's canonical URL).

**How teammates get in:** each person opens the app, clicks **"First time here?
Create your account"**, enters their work email and a password they choose, and
they're in. Anyone whose email is not on the allowlist is turned away.

To reset a forgotten password, an account owner can do it from **Authentication →
Users** in the Supabase dashboard.

### 5. Local environment variables

```bash
cd web
cp .env.example .env.local
```

Fill in `web/.env.local`:

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

`.env.local` is gitignored — never commit real credentials.

---

## Local development

```bash
cd web
npm install
npm run dev
```

Vite serves the app at **http://localhost:5173/trade-instructions/**
(the `/trade-instructions/` path matches the GitHub Pages base path).

Other commands:

```bash
npm run build     # production build into web/dist
npm run preview   # preview the production build locally
```

---

## Deploy to GitHub Pages

Deployment is automated by `.github/workflows/deploy.yml`.

### One-time configuration

1. **Repository Settings → Pages → Build and deployment → Source:**
   select **GitHub Actions**.
2. **Repository Settings → Secrets and variables → Actions → New repository
   secret** — add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   (These are injected at build time. The anon key is safe to ship in a client
   bundle — Row Level Security protects the data.)

### Deploying

The workflow runs on every push to `main` (or manually via the **Actions** tab →
**Deploy to GitHub Pages** → **Run workflow**). Development happens on the
`claude/iown-trade-dashboard-WJK8B` branch — merge it into `main` to publish.

The live site will be:
**https://richacarson.github.io/trade-instructions/**

> If the repository name ever changes, update `base` in `web/vite.config.js`,
> the URLs in this README, and the Supabase Site URL / Redirect URLs to match.

---

## Using the dashboard

- **All Open** — every unfinished instruction across all clients, stalest first.
  Filter by owner or client. Each row shows how many days the item has been open.
- **Clients** — alphabetical client list with open-instruction counts.
- **Client detail** — that client's instructions grouped by status (Done is
  collapsed by default).
- **Instruction detail** — change status/owner, check off sub-steps, read the
  original message, post notes, and review the full activity timeline.
- **New** — create a client (or pick an existing one) and an instruction with
  multiple steps.

Updates appear for everyone in real time via Supabase Realtime — no refresh.

### Staleness indicator

Each instruction shows days open since it was created:

- **0–6 days** — neutral
- **7–13 days** — yellow
- **14+ days** — red

Completing a sub-step or editing an instruction bumps its "last activity", which
re-sorts it on the All Open view.

---

## Notes

- **Logo:** the Paradiem mark is currently a faithful in-app recreation
  (`web/src/components/Logo.jsx`). To use the exact official artwork, add the
  vector file and swap it into that component.
- **Phase 2 (planned):** a local Node.js CLI (`scripts/ingest-screenshot.js`)
  that reads a screenshot of a Teams message, parses it with the Anthropic API,
  and inserts the resulting instructions via the Supabase service role key.
