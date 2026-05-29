# SMS Opt-ins → Google Sheet (direct, no Make.com)

The Text Club opt-in forms write **straight into a Google Sheet** via a tiny
Google Apps Script. No Make.com, no API keys, no service account. The site's
Worker formats the phone (E.164) + de-dupes, then appends the row to your sheet.

## One-time setup (~3 minutes)

1. **Make the sheet.** Create a Google Sheet (any name, e.g. "DWP Text Club").
2. **Open Apps Script.** In the sheet: **Extensions → Apps Script**.
3. **Paste this code** (replace anything there), then **Save**:

   ```javascript
   function doPost(e) {
     try {
       var data = JSON.parse(e.postData.contents);
       // Appends to your EXISTING sheet/numbers — adds a new row at the bottom,
       // phone in column A (next to your current numbers). Never edits existing rows.
       var ss = SpreadsheetApp.getActiveSpreadsheet();
       var sheet = ss.getSheets()[0]; // first tab. To target a specific tab:
                                       // var sheet = ss.getSheetByName('Sheet1');
       sheet.appendRow([
         data.phone || '',                                  // A: 17133848985
         data.source || '',                                 // B: source page (optional)
         data.ts ? new Date(data.ts * 1000) : new Date()    // C: date added (optional)
       ]);
       return ContentService
         .createTextOutput(JSON.stringify({ ok: true }))
         .setMimeType(ContentService.MimeType.JSON);
     } catch (err) {
       return ContentService
         .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
         .setMimeType(ContentService.MimeType.JSON);
     }
   }
   ```
   This **adds to your existing list** — each new sign-up is appended as a new
   row with the phone in **column A** (right where your current numbers are).
   It never overwrites existing rows. If you only want the phone (no source/date
   columns), change the `appendRow([...])` to just `[data.phone || '']`. If your
   numbers live on a different tab, switch to `ss.getSheetByName('YourTabName')`.

4. **Deploy.** Click **Deploy → New deployment** → type **Web app**.
   - **Execute as:** Me
   - **Who has access:** **Anyone**
   - Click **Deploy**, authorize when prompted, and **copy the Web app URL**
     (looks like `https://script.google.com/macros/s/AKfy.../exec`).
5. **Tell the site about it.** In Cloudflare → your Worker (**deuceswildpokertx**)
   → **Settings → Variables and Secrets** → add:
   - **`SHEET_WEBHOOK_URL`** = the Web app URL from step 4.
6. Done. Submit the footer "Text DEUCE" form once to test — a row should appear
   in the **Subscribers** tab within a second or two.

## What gets written
Each new sign-up appends one row to your existing sheet: **Phone (column A,
formatted as `17133848985` — country code 1 + 10 digits, no `+`) · Source page
(B) · Date (C)**. The Worker formats every number to that 11-digit form before
it's written, and de-dupes by number so the same phone isn't added twice. If
`SHEET_WEBHOOK_URL` is unset, numbers still save to the Worker's KV store so
nothing is lost.

## Updating the script later
If you change the Apps Script, **Deploy → Manage deployments → Edit → New
version** (or the URL won't reflect your edits). The `…/exec` URL stays the same.

## Optional: lock it down
The Web app URL only lives in the Worker's env (never sent to browsers), so abuse
risk is low. If you want belt-and-suspenders, add a shared secret: have the
script read `e.parameter.token` / a JSON `token` field and compare to a value,
and tell me — I'll have the Worker send the matching token.
