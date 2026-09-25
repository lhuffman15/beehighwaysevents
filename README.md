# Bee Highways Pollinator Parties schedule

A visual event list for beehighways.org. Events come from a Google Form, land in a Google Sheet, and show up on this page as stops along the Bee Highways road. Past events move into a "Past Parties" section on their own.

## What's in here

| File | What it does |
| --- | --- |
| `index.html` | The page |
| `styles.css` | Colors, fonts and layout from the Bee Highways design system |
| `app.js` | Reads the sheet and draws the schedule. No need to edit. |
| `config.js` | **The one file you edit**: your sheet link, contact email, button links |
| `sample-events.js` | Sample events, shown until you add your sheet link. Also lets you preview by double-clicking `index.html`. |
| `assets/` | Fonts, the meadow painting, the bee and monarchs |
| `setup/create-form.gs` | A one-time script that builds the Form, Sheet and photo folder for you |

---

## 1. Create the Form and Sheet (one time, ~5 minutes)

1. Go to [script.google.com](https://script.google.com) while signed in to the Bee Highways Google account, and click **New project**.
2. Delete the code that's there, paste in everything from `setup/create-form.gs`, and click **Save**.
3. Optional: put your two teammates' emails in the `EDITORS` line near the top, like `var EDITORS = ["sam@gmail.com", "ana@gmail.com"];`
4. Choose **createEventForm** in the menu at the top and click **Run**. Allow the permissions Google asks for. (It may warn that the app isn't verified. That's because you wrote it. Click **Advanced** then **Go to project**.)
5. Open **Execution log** at the bottom. It lists links to your new Form, the **Bee Highways Events** sheet, and a **Bee Highways Event Photos** Drive folder.

## 2. Connect the Sheet to the page

1. Open the **Bee Highways Events** sheet.
2. **File → Share → Publish to web**.
3. In the first dropdown pick **Events**. In the second pick **Comma-separated values (.csv)**. Click **Publish**.
4. Copy the link it gives you and paste it into `config.js`:

   ```js
   sheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?gid=0&single=true&output=csv",
   ```

Only the Events tab is public, and the form doesn't collect anyone's email, so nothing private is published.

## 3. Put it on GitHub Pages

1. Create a new repository, for example `bee-highways-events`.
2. Upload everything in this folder (keep the `assets` and `setup` folders as they are).
3. **Settings → Pages →** under "Build and deployment", pick **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
4. After a minute or two the page is live at `https://YOUR-USERNAME.github.io/bee-highways-events/`.

Optional: to use an address like `events.beehighways.org`, add it under **Settings → Pages → Custom domain** and follow GitHub's instructions for the DNS record.

## 4. Add it to beehighways.org

**Easiest:** point the "Upcoming Events" button on the homepage to the GitHub Pages address.

**Embedded in the page:** add a **Custom HTML** block where you want the schedule and paste:

```html
<iframe id="bh-events" src="https://YOUR-USERNAME.github.io/bee-highways-events/?embed=1"
        title="Bee Highways events" style="width:100%;height:2400px;border:0" loading="lazy"></iframe>
<script>
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "bh-events-height") {
      document.getElementById("bh-events").style.height = e.data.height + "px";
    }
  });
</script>
```

`?embed=1` hides the page's own painted header and green footer, since beehighways.org already has those. The little script grows the frame to fit the schedule. beehighways.org runs on WordPress.com, and depending on the plan, WordPress.com may strip iframes or scripts from Custom HTML blocks. If the script is stripped, the iframe still works at its fixed height (adjust `2400px`). If the iframe is stripped too, use the button link instead.

---

## Adding and changing events

- **Add an event:** fill out the Form. It appears on the site in about 5 minutes (Google refreshes published sheets on its own schedule).
- **Fix or change an event:** edit its row in the Events sheet.
- **Take an event down without deleting it:** type `yes` in its **Hide** column.
- **Past events** move to "Past Parties" automatically once they end. Add a photo link to a past event's row to show off how it went.
- **The page ignores** the Timestamp column and any row without a title or date.

### Photos

The first photo link is the main photo on the card. The others appear under "More details", and clicking any photo opens it larger.

- **Most reliable:** upload the photo to the beehighways.org media library and paste its link.
- **Google Drive works too:** put the photo in the **Bee Highways Event Photos** folder, right-click it → **Share → Copy link**, and paste that. The page converts Drive links automatically. The photo must be shared as **Anyone with the link**. Photos in that folder normally are, but check here first if a photo doesn't show up.
- If a photo can't load, the card shows the meadow painting instead, so nothing ever looks broken.

## Changing the look

The colors, fonts and spacing are at the top of `styles.css` as named variables (`--road`, `--frame`, `--meadow`...), matching the Bee Highways design system. Event type tags are colored by name: anything with "mulch" is goldenrod, "care" is meadow green, "meeting" is crimson, and planting parties are road orange.

## Troubleshooting

- **The page says "The schedule didn't load."** Check that the link in `config.js` ends in `output=csv` and came from **Publish to web**, not the normal Share button. For details, open the browser console (right-click → Inspect → Console).
- **A new event isn't showing.** Wait 5 minutes and refresh. Check its date isn't in the past, and that Hide is empty.
- **It still says "sample events".** The `sheetCsvUrl` in `config.js` is empty, or GitHub hasn't finished updating yet.

## Fonts

A Love of Thunder and Architects Daughter are included from the Bee Highways brand files. Architects Daughter is open-licensed. Before going live, double-check that your A Love of Thunder license covers web embedding (some display fonts license print and web separately).
