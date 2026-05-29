# Deuces Wild Poker Club — deuceswildpokertx.com

Conversion-first static site for a rake-free private poker club in Huntsville, TX.
Static HTML + Alpine.js (CDN), **no build step**, deployed on Cloudflare with
Pages Functions + D1 + KV powering a real-time seat-tracking system.

> **This repo is the deploy root.** Cloudflare serves these files directly. The
> Python files in the parent folder (`crawl.py`, `enhance.py`, etc.) belong to
> the earlier Durable→static migration and are **not** part of this repo.

---

## Deployment: Cloudflare **Workers** project

This site deploys as a **Workers** project (connected to this GitHub repo;
Cloudflare builds on push). The entry point is **`worker.js`**, configured by
**`wrangler.jsonc`**:

- `worker.js` routes `/api/*` to the seat-tracking handlers and gates `/admin/*`
  behind the login cookie, then falls through to the static-assets binding
  (`env.ASSETS`) for every page/CSS/JS/image.
- It reuses the exact handler code in `/functions/` (imported), so the API logic
  lives in clean per-endpoint files.
- `wrangler.jsonc` sets `assets.run_worker_first: true` so the Worker runs on
  every request — **required** so the `/admin/*` auth gate is enforced (otherwise
  the static admin HTML would be served without a password).

You must fill in two binding IDs in `wrangler.jsonc` (D1 `database_id`, KV `id`)
and set the `ADMIN_PASSWORD` secret — see **Cloudflare setup** below.

---

## TODO before launch

- **Phone number:** every page uses the placeholder `(936) 000-0000` /
  `tel:+19360000000` and the schema uses `+1-936-000-0000`. Find-and-replace the
  real number across the repo (search `9360000000` and `(936) 000-0000`).
- **OG image:** add `/assets/og-default.jpg` (1200×630 felt-and-gold card).
- **Photos:** the home + first-visit pages have placeholder photo slots
  (marked `TODO (Prompt 5)`). Replace with real room/felt/chips/owner photos.
- Set the `ADMIN_PASSWORD` secret and create the D1 + KV bindings (below).

---

## Cloudflare setup (dashboard-first — no local Node needed)

Do these once. Everything is in the Cloudflare dashboard; the only repo edit is
pasting two IDs into `wrangler.jsonc`, then `git push` (Cloudflare rebuilds).

### 1. Create the D1 database + seed it
1. Dashboard → **Storage & Databases → D1 → Create database** → name `dwp-tracking`.
2. Copy its **Database ID** → paste into `wrangler.jsonc` →
   `d1_databases[0].database_id` (replacing `REPLACE_WITH_D1_DATABASE_ID`).
3. Open the new database → **Console** tab → paste the entire contents of
   `db/schema.sql` → **Execute**. This creates the tables and seeds 4 tables +
   40 seats (`t1-s1` … `t4-s10`) + the `referrals` table. (Idempotent — safe to
   re-run.)

### 2. Create the KV namespace
1. Dashboard → **Storage & Databases → KV → Create namespace** → name `DWP_STATUS`.
2. Copy its **Namespace ID** → paste into `wrangler.jsonc` → `kv_namespaces[0].id`
   (replacing `REPLACE_WITH_KV_NAMESPACE_ID`).

### 3. Set the admin password (secret)
Dashboard → your Worker (**deuceswildpokertx**) → **Settings → Variables and
Secrets → Add** → name `ADMIN_PASSWORD`, type **Secret**, value = the shared host
password. (Don't put this in `wrangler.jsonc`.)

### 4. Deploy
Commit + push `worker.js`, `wrangler.jsonc`, and the rest. Cloudflare's Workers
build picks up the bindings from `wrangler.jsonc`. Once live:
- `GET /api/sessions` returns `{open:false,sessions:[]}` (the home widget goes
  live), and
- `/admin/login.html` accepts the `ADMIN_PASSWORD`, after which `/admin/checkin.html`
  works end-to-end.

### CLI alternative (requires Node + `npx wrangler`)
```bash
npx wrangler d1 create dwp-tracking                       # -> database_id
npx wrangler d1 execute dwp-tracking --remote --file=db/schema.sql
npx wrangler kv namespace create DWP_STATUS               # -> id
npx wrangler secret put ADMIN_PASSWORD
```

> Local design review: `python3 -m http.server` serves the HTML but cannot run
> `worker.js`/D1 — the live widget then gracefully falls back to schedule mode,
> and the admin pages show "camera unavailable / no tables loaded". That's
> expected offline; it all works once deployed with the bindings above.

---

## QR seat codes

Print 40 laminated QR cards, one per chair, encoding the bare seat token
(`t1-s1` … `t4-s10`) — a plain-text QR of that string is enough (the scanner
also accepts a URL containing the token). The codes track **seats, not players**:
there is no player record and **no PII** anywhere in the seat-tracking data.

---

## How Mike & Terry use it (operator guide)

1. On a phone or tablet at the host stand, go to **`/admin/checkin.html`** and log
   in once with the club password.
2. Point the camera at a seat's QR card. The system figures out what to do:
   - **Empty seat, no game at that table yet** → pick the game
     (Hold'em Cash / Omaha Cash / Tournament). That starts the table.
   - **Empty seat at a running table** → instant check-in (no prompt). The seat
     turns green.
   - **Occupied cash seat** → "Check out?" → one tap.
   - **Occupied tournament seat** → "Busted out (Nth place)" or "Moving tables"
     (use *Moving tables* when consolidating — no finish position recorded).
3. Tap a seat square on the dashboard to do the same thing without scanning.
4. **End a table** with the red "End …" button — it checks out everyone left;
   for a tournament the last player standing is recorded as the winner (1st).
5. The home page's live widget reflects all of this within ~60 seconds.
6. Not running the QR system tonight? Use **`/admin/status.html`** to set a simple
   "Doors open / closed" message for the home page instead.
7. **`/admin/sessions.html`** shows the last 30 days of sessions + basic stats.

No reservations, no player data — just seats.

---

## API endpoints (`/functions/`)

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/sessions` | GET | public | Active sessions + seat counts (home widget) |
| `/api/scan` | POST | admin | Smart scan → checkin / needs-game / confirm |
| `/api/session/start` | POST | admin | Start a table + check in first seat |
| `/api/session/end` | POST | admin | End session, check out remaining seats |
| `/api/checkin` | POST | admin | Explicit seat check-in |
| `/api/checkout` | POST | admin | Check out (bust / move / cash) |
| `/api/admin/board` | GET | admin | Per-seat dashboard state |
| `/api/admin/history` | GET | admin | 30-day session history + stats |
| `/api/status` | GET/POST | GET public via sessions / POST admin | Manual doors-open override |
| `/api/login` | POST | public | Set/clear admin cookie |
| `/api/sms-optin` | POST | public | Queue SMS opt-in to KV |
| `/api/refer` | POST | public | Log referral to D1 |

Auth is a SHA-256 token cookie derived from `ADMIN_PASSWORD`
(`functions/_shared/auth.js`). On this **Workers** deploy, `worker.js` enforces
the gate (public allowlist for `/api/sessions|sms-optin|refer|login`, auth
required for everything else under `/api/*`, and a login redirect for `/admin/*`).
The `functions/*/_middleware.js` files are the Pages-Functions equivalents and
are kept only for Pages compatibility — they don't run on Workers.

---

## File map

```
index.html                 Home (live widget, trust band, schedule, FAQ, map)
first-visit/ tournaments/ cash-games/ why-deuces-wild/ is-this-legal/   Tier-1 pages
about/ contact/ refer/                                                  trust + capture
poker-near/<city>/         20 local-SEO city pages (generated)
admin/{login,checkin,sessions,status}.html                             host tools
assets/styles.css          design system (Bebas Neue + Outfit, black/gold/red)
assets/app.js              liveStatus() + tourCountdown() Alpine components
data/cities.json           city page content   data/winners.json  winners rotation
db/schema.sql              D1 schema + seed
functions/                 Pages Functions (API) + auth middleware
_partials/                 canonical head/nav/footer/script-tail/sms-optin snippets
../gen_city_pages.py       regenerates the 20 city pages from data/cities.json
```

### Editing shared chrome
There's no build step, so nav/footer markup is duplicated into each page inside
`<!-- PARTIAL: …START/END -->` zones. The canonical source is in `/_partials/`.
To change the nav or footer site-wide, edit the partial, then sweep the same
delimited block across pages (search for `PARTIAL: nav.html`).

### Regenerating city pages
```bash
cd ..               # to the repo's parent (where gen_city_pages.py lives)
python3 gen_city_pages.py
```
