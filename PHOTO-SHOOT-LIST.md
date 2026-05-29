# Deuces Wild Poker Club — Photo Shoot List & Integration Guide

Real photos are the single biggest trust upgrade left on the site. This is the
shot list + exactly how to drop them in (no code needed).

## How integration works (read this first)
1. Save each photo into **`/assets/img/`** using the **exact filename** below.
2. Add it to the manifest **`/data/photos.json`** (one line per photo).
3. Commit + push. The photo appears automatically.

Until a photo is listed in the manifest, the slot shows a branded placeholder —
**no broken images ever**. So you can add photos one at a time.

### Photo specs
- **Format:** JPEG (`.jpg`), sRGB. **Width:** 1600px (galleries) / 1200px (portraits) is plenty.
- **Keep files <300 KB each** if possible (compress at ~75% quality) — the site targets fast loads.
- **Style:** dark, moody, warm — real felt, real chips, real people. **No stock casino photos.**
- **People:** only shoot/publish players who give the OK. Owners (Mike & Ike) front and center.

---

## THE SHOTS

### Hero / Home carousel — `groups.home` (4–6 photos)
The first thing visitors see. Wide, cinematic, inviting.
| Filename | Shot |
|---|---|
| `room-wide.jpg` | The whole room from the door — tables, felt, lighting. Establishes "this is a real card room." |
| `table-action.jpg` | A table mid-hand from a flattering angle — chips in the pot, cards out, hands in frame (faces optional/with permission). |
| `chips-stack.jpg` | Tight close-up of chip stacks on green felt. Texture + color. |
| `neon-sign.jpg` | The Deuces Wild neon / signage (the brick-wall DWP sign if it's still up). Brand moment. |
| `dealer-deal.jpg` | A professional dealer pitching cards — conveys "legit, run right." |

### "Look Around" gallery on /first-visit/ — `groups.room` (4–6 photos)
Reassures the nervous first-timer. Show the path they'll walk.
| Filename | Shot |
|---|---|
| `front-door.jpg` | The entrance/front door from the parking lot — "this is where you walk in." |
| `host-stand.jpg` | The host stand / check-in area. |
| `cage.jpg` | The secure cash cage (no cash/sensitive info visible) — signals safety. |
| `seating.jpg` | An open seat at a table, inviting. |
| `crowd-fun.jpg` | People having a good time (with permission) — not posed, real. |

### Owner portraits — `portraits.mike` / `portraits.ike`
Used on /about/mike-ike/ (and great for /about/). Real faces = trust.
| Filename | Shot |
|---|---|
| `mike.jpg` | Mike — friendly, approachable portrait. Vertical (4:5) framing works best. |
| `ike.jpg` | Ike — same treatment, matching style. |

### Social / OG image — `og-default.png`
The preview image when the site is shared (texts, Facebook, etc.).
- **Currently set** to the real room-and-neon photo (reused from the original site) — already live as `/assets/og-default.png` and referenced sitewide.
- **Optional upgrade:** replace with a purpose-built **1200 × 630 px** card — the neon/room shot, darkened, with "DEUCES WILD POKER CLUB · Huntsville, TX · Rake-Free" in gold. Just overwrite `/assets/og-default.png`.

### Winners wall (optional, later)
Winner photos go in `/data/winners.json` per entry (`"photo": "/assets/img/winner-name.jpg"`), only with the player's permission.

---

## Manifest format (`/data/photos.json`)
```jsonc
{
  "base": "/assets/img/",
  "groups": {
    "home": [ { "file": "room-wide.jpg", "alt": "The Deuces Wild poker room in Huntsville" } ],
    "room": [ { "file": "front-door.jpg", "alt": "Front entrance to Deuces Wild Poker Club" } ]
  },
  "portraits": { "mike": "mike.jpg", "ike": "ike.jpg" }
}
```
Leave an array empty (`[]`) or a portrait `""` to keep the branded placeholder.
