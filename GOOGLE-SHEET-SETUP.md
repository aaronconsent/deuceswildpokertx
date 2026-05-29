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
       var ss = SpreadsheetApp.getActiveSpreadsheet();
       var sheet = ss.getSheetByName('Subscribers') || ss.insertSheet('Subscribers');
       if (sheet.getLastRow() === 0) {
         sheet.appendRow(['Date', 'Phone', 'Phone (digits)', 'Source']);
       }
       sheet.appendRow([
         data.ts ? new Date(data.ts * 1000) : new Date(),
         data.phone || '',
         data.phone_digits || '',
         data.source || ''
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
Each new sign-up appends one row: **Date · Phone (E.164, e.g. +19365551234) ·
Phone digits · Source page**. Duplicates are not re-added (the Worker de-dupes
by number). If `SHEET_WEBHOOK_URL` is unset, numbers still save to the Worker's
KV store so nothing is lost.

## Updating the script later
If you change the Apps Script, **Deploy → Manage deployments → Edit → New
version** (or the URL won't reflect your edits). The `…/exec` URL stays the same.

## Optional: lock it down
The Web app URL only lives in the Worker's env (never sent to browsers), so abuse
risk is low. If you want belt-and-suspenders, add a shared secret: have the
script read `e.parameter.token` / a JSON `token` field and compare to a value,
and tell me — I'll have the Worker send the matching token.
