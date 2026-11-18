# Comeback Arc

A mobile-first habit tracker PWA for a small party of friends (up to 8), themed as a
tabletop RPG / roguelite. Google Sheets is the entire backend — no servers, no secret
keys to manage.

```
frontend/   React + Vite + TS + Tailwind PWA
backend/    Code.gs — a single Google Apps Script Web App bound to your Sheet
```

## How it works

- **Frontend** is a static React PWA. It can run in two modes:
  - **Demo mode** (no `VITE_API_URL` set): generates 4 fake players with 60 days of
    seeded history in memory, so you can try every screen before touching Google Sheets.
  - **Live mode**: talks to your deployed Apps Script Web App.
- **Backend** is `backend/Code.gs`, deployed as a Web App. It reads/writes a Google
  Sheet with four tabs (`Players`, `Habits`, `Logs`, `Config`), auto-created the first
  time you run `setup()`.
- **Auth** is a passphrase per player, hashed (SHA-256 + a generated salt) and checked
  on every write. **This is not real security** — there are no sessions or tokens, the
  Web App is reachable by anyone with the link, and the client re-sends the passphrase
  with every write. It's meant for a small group of friends who trust each other, not
  as a security boundary. Don't reuse a real password as your passphrase.
- **CORS**: the client POSTs with `Content-Type: text/plain`, so the browser never
  issues a CORS preflight request (which Apps Script Web Apps can't answer). The server
  parses the body as JSON regardless of the declared content type.
- **Offline**: writes are applied to the UI immediately (optimistic), and queued in
  IndexedDB when offline or when a request fails. The queue flushes automatically when
  the browser comes back online or every 60 seconds.

## 1. Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new, blank
   spreadsheet. Name it whatever you like, e.g. "Comeback Arc Data".
2. Open **Extensions → Apps Script**. This opens the script editor bound to your sheet.

## 2. Paste the backend script

1. In the Apps Script editor, delete the placeholder `Code.gs` contents.
2. Paste in the entire contents of [`backend/Code.gs`](backend/Code.gs) from this repo.
3. Click the **Save** icon (or Ctrl/Cmd+S).
4. In the function dropdown at the top, select **`setup`**, then click **Run**.
   - The first time, Google will ask you to authorize the script — click through the
     "Advanced" / "Go to (unsafe)" prompts. This is your own script running under your
     own account; the warning is standard for any new Apps Script project.
   - Check the sheet: you should now see four tabs — `Players`, `Habits`, `Logs`,
     `Config` — with headers and the default 18 habit rows already filled in.

## 3. Deploy as a Web App

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set:
   - **Execute as**: **Me** (your account)
   - **Who has access**: **Anyone with the link**
4. Click **Deploy**, authorize again if prompted, and copy the **Web app URL**. It
   looks like `https://script.google.com/macros/s/AKfycb.../exec`.
5. **Whenever you edit `Code.gs` later**, you must create a **new deployment version**
   (Deploy → Manage deployments → edit → New version) for the changes to go live — just
   saving the file is not enough.

## 4. Configure the frontend

1. In `frontend/`, copy the example env file:
   ```bash
   cp .env.example .env
   ```
2. Open `frontend/.env` and paste your Web App URL as the value of `VITE_API_URL`:
   ```
   VITE_API_URL=https://script.google.com/macros/s/AKfycb.../exec
   ```
   Leave it blank to keep running in demo mode. (There's also an optional
   `VITE_VAPID_PUBLIC_KEY` for push reminders — see section 7.)
3. Install dependencies and run locally:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. Open the printed `http://localhost:5173` URL. Create your character (name, class,
   passphrase) on the login screen — this calls `createPlayer` on your Apps Script and
   writes a new row to the `Players` sheet. Share the same Web App URL with your
   friends so they can create their own characters in the same party (max 8).

## 5. Deploy the frontend

Any static host works. **Netlify** is the simplest for this stack (static build + one
env var), so it's the default here; GitHub Pages and Vercel both work the same way if
you'd rather use those — the only thing that changes is where you set `VITE_API_URL`.

### Netlify (recommended)

1. Push this repo to GitHub.
2. In Netlify, **Add new site → Import an existing project**, pick the repo.
3. Build settings:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
4. **Site settings → Environment variables**: add `VITE_API_URL` with your Web App URL.
5. Deploy. Netlify gives you an HTTPS URL — PWA install requires HTTPS (or localhost).

### GitHub Pages

This repo already includes a working setup for this (what the live deployed copy
actually uses): [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml)
builds `frontend/` with `vite.config.ts`'s `base` automatically switched to
`/<repo-name>/` (via the `GH_PAGES=true` build env var the workflow sets — Pages serves
from a subpath, unlike Netlify/Vercel/localhost) and deploys it to GitHub Pages on every
push to `master`. One-time setup:

1. Repo **must be public** — Pages isn't free on private repos.
2. Repo **Settings → Pages → Build and deployment → Source**: "GitHub Actions" (or run
   `gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`).
3. Repo **Settings → Secrets and variables → Actions**: add a `VITE_API_URL` secret with
   your Web App URL (and, once you've set up push reminders below, `VITE_VAPID_PUBLIC_KEY`
   too).
4. Push to `master`, or run the workflow manually (Actions tab → "Deploy to GitHub
   Pages" → Run workflow). Your site is then at `https://<owner>.github.io/<repo-name>/`.

### Vercel

1. Import the repo, set **Root Directory** to `frontend`.
2. Framework preset: Vite. Build command and output directory are auto-detected.
3. **Settings → Environment Variables**: add `VITE_API_URL`.

## 6. Add to your phone's home screen

- **iOS (Safari)**: open the deployed URL → Share icon → "Add to Home Screen".
- **Android (Chrome)**: open the deployed URL → ⋮ menu → "Add to Home screen" (or
  Chrome may prompt automatically after a visit or two).

Once installed, the app opens full-screen with its own icon, and continues to work
offline for logging (writes sync once you're back online).

## 7. Push reminders (optional)

If you haven't logged anything by a time you pick, the app can send you a real push
notification — no Firebase, no third-party push service account; `Code.gs` signs the
required VAPID authentication itself (see "How push reminders work" below).

1. **Update your Apps Script**: paste the latest [`backend/Code.gs`](backend/Code.gs)
   over your existing script (it now includes the push-sending code and a
   `PushSubscriptions` sheet), save, and create a **new deployment version** (Deploy →
   Manage deployments → edit → New version) — editing the file alone doesn't go live.
2. **Run `setup` again** (function dropdown → `setup` → Run). It's safe to re-run — it
   only creates what's missing, and this time it also generates a VAPID key pair
   (stored server-side only, in Script Properties, never in a sheet cell) the first
   time. Open **View → Logs** (or Executions) and copy the public key it printed.
3. Paste that public key into `frontend/.env` as `VITE_VAPID_PUBLIC_KEY`, and into the
   matching GitHub secret, then redeploy the frontend (push to `master`, or re-run the
   Netlify/Vercel build).
4. **Schedule the sender**: in the Apps Script editor, run `installReminderTrigger`
   once. This installs a time-driven trigger that checks every 15 minutes for anyone
   who's enabled reminders, hasn't logged anything yet today, and has a configured time
   within that window.
5. In the app, open **Settings → Reminders**, set a time (or two), and tap **Enable
   Reminders** — this asks for notification permission and registers your subscription.
6. To test without waiting: in the Apps Script editor, run `sendTestPush` with your
   `playerId` as the argument (find it by checking the `Players` sheet) to fire one push
   immediately.

### How push reminders work (and their limits)

- **No service-account keys**: sending Web Push normally means Firebase Cloud Messaging
  (needs a Google Cloud service-account key) or a server library. Neither fits this
  project's "no services, no secret keys" constraint, so `Code.gs` implements the
  **VAPID** (RFC 8292) authentication itself — a from-scratch P-256 ECDSA signer using
  only `Utilities`' SHA-256/HMAC-SHA256 (Apps Script has no native ECDSA). This math is
  unit-tested in `frontend/src/lib/__tests__/vapid.test.ts` against RFC 6979's own
  published P-256/SHA-256 test vectors before being ported into `Code.gs`.
- **Payload-less pushes**: encrypting a push body (RFC 8291) needs ECDH + HKDF +
  AES-128-GCM on top of the above — out of scope here. Every reminder is sent empty, and
  the service worker ([`public/push-sw.js`](frontend/public/push-sw.js)) shows a fixed
  message ("⏰ you haven't logged today yet"); it can't say anything more specific per
  notification without that extra encryption layer.
- **~15-minute granularity**: the reminder check runs every 15 minutes and matches your
  chosen time within ±7 minutes, so expect some jitter rather than a to-the-minute ping.
- **One subscription per player**: registering on a new device replaces the old one.

## Demo mode

Don't set `VITE_API_URL` (or leave it blank) and the app generates 4 fake players —
Kael, Riya, Dev, and Ana — with 60 days of varied, seeded history: one very consistent
("Kael"), one streaky ("Riya"), one genuinely improving over time — the comeback arc
itself ("Dev"), and one who joined only 20 days ago to exercise the "don't penalize
late joiners" consistency math ("Ana"). Nothing in demo mode is persisted anywhere;
reloading regenerates the same seeded data. Login/habit-edit actions are no-ops.

## Running tests and the build

```bash
cd frontend
npm install
npm test     # Vitest — day-rollover, streaks, cheat-days, weekly study, fair
             # consistency, XP/levels, floors/runs, badges, and the VAPID P-256/ECDSA
             # signing math (against RFC 6979's own test vectors), all pure-function tested
npm run build  # tsc -b && vite build
```

## Data model (Google Sheet)

| Sheet     | Columns |
|-----------|---------|
| `Players` | `playerId, name, class, passHash, createdAt` |
| `Habits`  | `habitId, name, category, tier, weight, type, target, period, active, direction, unit, toleranceMinutes, group` |
| `Logs`    | `date, playerId, habitId, value, done, updatedAt` (one row per player/habit/day, upserted) |
| `Config`  | `key, value` — `rolloverHour`, `backfillDays`, `cheatDayLimit`, `goodDayThreshold`, `coreWeightMultiplier`, `restTokensPerWeek`, plus per-player habit overrides (see below) |

You can edit any habit's `target` or `active` cell directly in the `Habits` sheet at
any time — no redeploy needed, the frontend picks it up on next sync.

### Per-player habit overrides

The **Me** screen lets each player tweak their own targets/active flags. Since the
`Habits` sheet has no per-player column, these are stored as extra `Config` rows with
keys shaped `override.<playerId>.<habitId>.target` / `...active`. The frontend merges
these on top of the shared `Habits` sheet when computing that player's own scores —
other players' scores are unaffected.

## Scoring logic (`frontend/src/lib/`)

All of the interesting logic is pure, dependency-free TypeScript, unit tested in
`src/lib/__tests__/`:

- **`day.ts`** — the day rolls over at 4am IST (configurable), so logging between
  midnight and 4am still counts for the previous day. IST is treated as a fixed
  UTC+05:30 offset (India has no DST), so no timezone database is needed on either the
  client or in Apps Script.
- **`scoring.ts`** — daily score (weighted share of habits completed, core habits at
  2x weight by default), "good day" (score ≥ threshold *and* every core habit done),
  the no-sugar weekly cheat-token rule, weekly study pass/perfect thresholds, and
  consistency rates computed over a window that's clipped to each player's own start
  date (so a player who joined later is never compared against days before they could
  have logged anything).
- **`rpg.ts`** — XP/levels/class titles, weekly "floors" (pass = good average score +
  clearing weekly habits), run history (consecutive cleared floors), and badges.

## Known assumptions & limitations

- **Auth is not a security boundary** (see above) — by design, for a trusted friend
  group.
- **Workout sub-habits** (pushups/squats/crunches/dead-hangs/cardio) are five separate
  `Habit` rows sharing a `group: "workout"` tag, rather than a new schema column — the
  Today screen groups them into one card client-side.
- **Meds/supplements checklist items** are player-defined but stored client-side only
  (`localStorage`), not in the Sheet, since the `Habits`/`Logs` schema has no per-player
  item list. The logged value is just "all checked or not" (0/1).
- **Rest tokens** (one per week, protects a streak) are applied automatically/greedily
  to the first bad day each week, rather than requiring the player to choose to spend
  one.
- **The current, still-in-progress week's "floor"** can show as provisionally failed
  (e.g. if the weekly study target hasn't been hit *yet*) — it's a live, not-yet-final
  result until the week completes.
- **Apps Script concurrency**: Sheets writes aren't transactional. `Code.gs` wraps
  writes in `LockService` to avoid lost updates, which is sufficient at the scale of
  ~8 people logging a few times a day, but not for high write concurrency.
- Hosting instructions default to **Netlify** for simplicity; GitHub Pages and Vercel
  are both documented as drop-in alternatives — the live deployed copy actually uses
  GitHub Pages via the included Actions workflow.
- **Push reminders are payload-less and ~15-minute-grained** (see section 7) — a
  deliberate tradeoff to avoid needing RFC 8291 payload encryption (ECDH+HKDF+AES-GCM)
  on top of the VAPID signing Apps Script already has to do from scratch.

## Assumptions made during the build

- Exact numeric weights/targets per spec were translated into a concrete `Habits` seed
  list (`frontend/src/lib/habitDefs.ts`, mirrored in `backend/Code.gs`'s `setup()`) —
  edit either the Sheet (live) or regenerate demo data (`frontend/src/lib/demoData.ts`)
  if you want different defaults.
- XP amounts, level curve, and badge thresholds are original (not specified) — tuned to
  feel reasonable over a ~60-day window, easy to retune in `frontend/src/lib/rpg.ts`.
- "This Week" leaderboard metric on the Party screen uses 7-day consistency rather than
  the in-progress floor score, so it's stable to compare mid-week.
