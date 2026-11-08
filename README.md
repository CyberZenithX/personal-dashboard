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
   | `GEMINI_API_KEY` | no | Turns on Gemini sorting of voice/typed items (see below) |
   | `GEMINI_MODEL_FLASH_LITE` / `GEMINI_MODEL_FLASH` | no | Model IDs behind the two "Sorting model" options |

4. **Deploy.** `npm run build` runs `db/schema.sql` against Neon first (idempotent), then builds Next.
5. Open the URL, enter your password. On a phone use *Add to Home Screen* to install it.

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
- **Voice capture:** browser speech recognition → sorted into tasks / notes / events / "done with X" → saved.
- **Shortcuts** (rebindable): T, N, E, Space, X, Shift+→, Ctrl+K search. Phone: swipe a task right to finish,
  left to push to tomorrow, press and hold for more.
- **Settings:** pages on/off, hashtags (they drive the classifier), themes unlocked by level, density, week start,
  12/24h, reminders, JSON export, Todoist/CSV import, reset progress.
- **Google Calendar is not connected yet** — the button is in the UI and labelled *Coming soon*.

## Honest notes / limitations

- **Gemini:** with `GEMINI_API_KEY` set, sorting uses a structured-JSON Gemini call whose schema enum is built from your
  hashtags. The "Sorting model" labels in Settings are mapped to the model IDs in the env vars above (defaults:
  `gemini-2.5-flash-lite`, `gemini-2.5-flash`) — set them to whichever models your key can use. Without a key a built-in
  rule-based sorter is used (the Voice screen says which one). **The Gemini path has not been exercised against the live API.**
- **Speech-to-text** uses the browser's Web Speech API (Chrome/Edge/Safari). The "Listening model" setting is stored but
  does not select a model, and there is no audio recording/playback of voice notes. If the browser can't listen, the Voice
  screen offers a text box (works with keyboard dictation).
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
