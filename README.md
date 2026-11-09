# Daylog — life tracker

Tasks, notes, calendar and voice capture that turn every log into XP, levels, streaks and daily quests.
A working web app built from the **Daily Logs — Life Tracker App** design (7 desktop screens + 7 phone screens),
for desktop and mobile (installable as a PWA).

**Stack:** Next.js 15 (App Router) · TypeScript · Neon Postgres (`@neondatabase/serverless`) · Vercel.

## Deploy on Vercel + Neon

1. **Create a Neon project** (free tier is fine) and copy the *pooled* connection string.
   Or add the **Neon integration** from the Vercel Marketplace — it sets `DATABASE_URL` for you.
2. **Import this repo in Vercel.** Framework preset: Next.js (auto-detected).
3. **Add environment variables** (Project → Settings → Environment Variables):

   | Variable | Required | What it does |
   |---|---|---|
   | `DATABASE_URL` | yes | Neon connection string |
   | `APP_PASSWORD` | yes | The single password that unlocks your Daylog |
   | `AUTH_SECRET` | recommended | Signs the session cookie. `openssl rand -hex 32` |
   | `APP_USER_NAME` | no | Name in the Today greeting (default `Abubakar`) |
   | `GEMINI_API_KEY` | no | Turns on Gemini Live voice transcription and Gemini sorting (see below) |
   | `GEMINI_LIVE_MODEL`, `GEMINI_MODEL_FLASH_LITE`, `GEMINI_MODEL_FLASH` | no | Override the model IDs behind the Settings dropdowns |

4. **Deploy.** `npm run build` runs `db/schema.sql` against Neon first (idempotent), then builds Next.
5. Open the URL, enter your password. On a phone use *Add to Home Screen* to install it.

`GEMINI_API_KEY=… node scripts/live-test.mjs` checks the Live pipeline from the command line (synthesises speech, mints a token, streams it, prints the transcript).

Optional demo data that mirrors the mock-ups: `DATABASE_URL=… npm run db:seed` (only seeds an empty DB; `-- --force` wipes first).

## Local development

```bash
npm install
npm run dev            # http://localhost:3000
```

With no `DATABASE_URL`, dev uses an embedded Postgres (PGlite) stored in `.data/` — no setup needed, and login is disabled
unless `APP_PASSWORD` is set. Copy `.env.example` to `.env.local` to point at Neon instead.
`npm run db:seed` loads the demo data; `npx tsx scripts/smoke.ts` runs a backend smoke test.

## What works

- **Today / Tasks / Notes / Calendar / Progress / Settings / Voice** — all wired to the database.
- **XP, levels (30), streaks, streak freezes, day score, daily quests, badges** are derived from your data
  (`src/lib/progress.ts`, `src/lib/levels.ts`). Every log counts as a check-in; the daily goal is configurable.
- **Quick add** understands dates, times and hashtags: `Pay DEWA bill fri 6pm #life`. Untagged items are sorted into
  your hashtags automatically.
- **Voice capture:** with `GEMINI_API_KEY` set, the Voice screen streams your mic to a **Gemini Live** model (the
  "Listening model" setting) and shows the transcript as you speak; the words are then sorted by the "Sorting model" into
  tasks / notes / events / "done with X" and saved. The server only mints short-lived single-use tokens
  (`/api/voice/token`), so the API key never reaches the browser. If Gemini can't connect it falls back to the browser's
  speech recognition, then to a text box (works with keyboard dictation).
- **Shortcuts** (rebindable): T, N, E, Space, X, Shift+→, Ctrl+K search. Phone: swipe a task right to finish,
  left to push to tomorrow, press and hold for more.
- **Settings:** pages on/off, hashtags (they drive the classifier), themes unlocked by level, density, week start,
  12/24h, reminders, JSON export, Todoist/CSV import, reset progress.
- **Google Calendar is not connected yet** — the button is in the UI and labelled *Coming soon*.

## Honest notes / limitations

- **Gemini models** (verified against the live `ListModels` endpoint): Listening — Gemini 3 Flash Live =
  `gemini-3.1-flash-live-preview`, Gemini 3.8 Live = `gemini-3.8-live`, Gemini 2.5 Flash Native Audio Dialog =
  `gemini-2.5-flash-native-audio-preview-12-2025`, and an extra option, Gemini 3.5 Transcribe Live =
  `gemini-3.5-transcribe-live` (transcription only: no spoken replies, so it is the cheapest). Sorting — Gemini 3.5 Flash
  Lite = `gemini-3.5-flash-lite`, Gemini 3 Flash = `gemini-3-flash-preview`. Several of these are *preview* models and
  Google may rename or retire them; override IDs with `GEMINI_LIVE_MODEL`, `GEMINI_MODEL_FLASH_LITE`, `GEMINI_MODEL_FLASH`.
  Ephemeral-token support in the SDK is marked experimental by Google. Live models other than transcribe-live also
  generate spoken replies that Daylog discards, which uses extra tokens.
- Without a Gemini key everything still works: browser speech recognition + a rule-based sorter (the Voice screen's chip
  says which pipeline is active). There is no audio recording/playback of voice notes.
- **Reminders** are browser notifications that fire while Daylog is open or installed; there is no server push.
- Single user: one password, one database. Notebooks on the Notes screen follow your note hashtags.
- Time zone is taken from the browser and saved in settings; day boundaries (streaks, quests) use it.

## Project layout

```
db/schema.sql            tables (settings, tasks, notes, events, voice_logs, xp_log)
scripts/                 migrate (runs on build), seed, smoke test
src/lib/                 db adapter, progress/XP maths, AI sorter, quick-add parser, auth
src/app/api/*            REST endpoints (all behind the password middleware)
src/components/desktop   the 7 desktop screens      src/components/phone  the phone screens
```
