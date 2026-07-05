# MeetSpan — cross-timezone meeting scheduler

Find a meeting time across regions and timezones. The organizer creates a poll
and shares a link; anyone with the link joins by picking a **codename** and
painting when they're free — **in their own timezone**. No sign-up, no login.
When responses are in, the organizer enters the meeting details and MeetSpan
sums the overlap, suggests alternatives if nothing fits, and drafts an email.

- **Static frontend** (React + Vite + TypeScript) hosted free on **GitHub Pages**.
- **Shared state** in **Firebase Firestore** (free Spark tier) — called directly
  from the browser, no server code.
- **Timezone-correct** (Luxon, DST-safe). All times stored in UTC; each person
  sees their own local grid.

---

## How it works

1. **Create a poll** — pick specific dates *or* weekdays, a daily time window,
   slot size, and your timezone. You get two links:
   - a **participant invite link** (`#/p/<pollId>`) to share, and
   - a private **organizer link** (`#/o/<pollId>?k=<token>`) — your key.
2. **Participants** open the invite, set a codename, confirm their timezone, and
   paint availability. The organizer sees a live overlap heatmap.
3. **Close the poll**, enter the meeting name, duration, sessions/week, and type,
   then **Find times**. MeetSpan finds windows where everyone overlaps for the
   full duration. If none fit, it suggests: shorten the meeting, split it across
   days, or exclude a specific person — each with concrete times.
4. **Draft an email** from a template chosen by meeting type, auto-filled with a
   per-attendee local-time table. Copy it or open it in your mail app.

---

## One-time Firebase setup (free)

1. Go to <https://console.firebase.google.com> and **create a project**.
2. **Build → Firestore Database → Create database** (Production mode, any region).
3. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable.**
   The app signs every visitor in anonymously; the Firestore rules require it.
4. **Project settings (⚙) → Your apps → Web app (`</>`)**. Register an app and
   copy the `firebaseConfig` values.
5. Copy `.env.example` to `.env` and paste the values:
   ```bash
   cp .env.example .env
   # then edit .env
   ```
6. **Firestore → Rules**: paste the contents of [`firestore.rules`](./firestore.rules)
   and Publish. **Enable Anonymous Auth (step 3) first** — the rules deny every
   request that isn't signed in, so publishing them without it locks out the app.

> The Firebase web config is **public by design** — it only identifies your
> project. Security comes from Firestore rules + Anonymous Auth, not from hiding
> the config.

---

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # run the scheduling-engine + timezone unit tests
npm run build    # typecheck + production build
```

Open two browser profiles (or a normal + incognito window) to play both the
organizer and a participant. Use the in-app **timezone picker** to simulate
people in different zones.

---

## Deploy to GitHub Pages

1. Create a GitHub repo and push this project to the `main` branch.
2. **Settings → Secrets and variables → Actions → Variables** — add the same
   six keys as your `.env` (as *Variables*, not Secrets — they're not sensitive):
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
   `VITE_FIREBASE_APP_ID`.
3. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Push. The workflow in [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)
   builds and publishes to `https://<username>.github.io/<repo>/`.

Routing is **hash-based**, so deep links like `#/p/<pollId>` work on refresh
without any server-side SPA fallback.

---

## Security model & tradeoffs

Every visitor is signed in **anonymously** (Firebase Anonymous Auth). Possession
of the poll link still drives access, but [`firestore.rules`](./firestore.rules)
add real server-side integrity on top:

- Anyone with the link (signed in) can **read** the poll and everyone's
  availability — needed for the group overlap heatmap.
- A participant can only **edit their own** availability doc (bound to their
  anonymous uid); no one can overwrite someone else's selections.
- Collected **emails live in a separate `emails` collection readable only by the
  poll's organizer** — link-holders can't harvest them.
- Closing / finalizing stays **link-portable**: any signed-in user may write meta
  (gated in the app by the secret `adminToken`, whose SHA-256 hash is the only
  thing stored). So the organizer link keeps working on any device. **Keep it
  private.**

Tradeoffs to know:

- The organizer reads collected emails via their **anonymous uid, which is
  per-browser** — so recipient emails are visible only in the browser that
  *created* the poll. (Emails are a convenience; everything else is portable.)
  Truly cross-device email access would need a backend to verify the organizer
  token; this app is intentionally serverless.
- Anonymous identities are per-browser; clearing site data starts a new one.
- Polls/participants created **before** this change lack the uid fields and
  become read-only under the new rules — recreate them.

---

## Design

The UI follows a **Cal.com-inspired** visual language (derived from
[`awesome-design-md`](https://github.com/VoltAgent/awesome-design-md)) — a
clean, calendar-software-first look: monochrome and confident, with a single
blue accent reserved for scheduling data. All styling lives in
[`src/styles.css`](./src/styles.css) as CSS custom properties + semantic
classes; there are no hardcoded colors in the components.

**Color roles** — one job per color, applied consistently:

| Role | Token | Where |
| --- | --- | --- |
| Actions & headings | near-black `#111111` (`--ink`) | primary buttons, page/card titles |
| **Availability data** | blue `#2563eb` (`--brand-600`) | your painted cells (solid) + group heatmap (light→dark ramp) |
| Best time / success | emerald `#10b981` (`--good`) | chosen-window outline, "found a time" card |
| Destructive | red `#ef4444` (`--danger`) | close poll |
| Canvas / cards | soft-gray page, white cards, `#e5e7eb` hairlines | layout |
| Footer | dark `#101010` | closes every page (a Cal.com signature) |

**Type** — [Inter](https://fonts.google.com/specimen/Inter) throughout; display
headings use weight 600 with negative letter-spacing (a Cal Sans substitute).
Never bold display type past 600.

**Radii** — 8px buttons/inputs · 12px cards · 6px inner elements. Elevation is
soft (hairline borders + faint shadows), never heavy.

To re-skin, swap the tokens in `:root` at the top of `styles.css`. The design
language is derived from the Cal.com `DESIGN.md` in
[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md).

---

## Project layout

```
src/
  firebase.ts            Firebase init + anonymous auth (reads VITE_* env)
  lib/
    types.ts             shared types
    ids.ts               poll id / admin token / hashing
    slots.ts             timezone-safe slot expansion + grid projection (Luxon)
    overlap.ts           scheduling engine + suggestions  ← core, unit-tested
    email.ts             4 email templates + mailto/Gmail/Outlook compose links
    ics.ts               .ics calendar export (RFC 5545)
    poll.ts              Firestore CRUD + live subscriptions (+ private emails)
    adminStore.ts        localStorage for organizer/participant identity
    useAuthState.ts      React hook: anonymous sign-in status
  pages/                 Home (create), Participate, Organizer
  components/            AvailabilityGrid, AvailabilityBoard, Heatmap, TimezonePicker, ResultPanel, EmailModal
```
