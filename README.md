# Stud.IP Course Tags & Studienablaufplan

A small, local Chrome extension for Stud.IP (`elearning.uni-oldenburg.de`) that helps you plan your semester:

- **Tags** next to your courses (department, "Pflicht", "Übung", …), with colours, filtering and renaming
- A **Studienablaufplan** (Master Informatik layout) at the top of "Meine Veranstaltungen", with drag-and-drop
- The same **tags, plan markers and filters in the Planer** (timetable)
- **Export / import** of everything as a JSON backup

Everything runs in your browser. Nothing is sent anywhere.

---

## 1. Installation

Works in Chrome and other Chromium browsers (Edge, Brave, …).

1. Put these five files together in one folder, e.g. `studip-tags`:
   - `manifest.json`
   - `content.js`
   - `plan.js`
   - `planer.js`
   - `style.css`
2. Open `chrome://extensions`.
3. Switch on **Developer mode** (top right).
4. Click **Load unpacked** and select the folder.
5. Open Stud.IP. The extension only runs on `https://elearning.uni-oldenburg.de/*`.

### Updating

1. Overwrite the files in the folder with the new versions.
2. In `chrome://extensions`, click the **reload** icon on the extension's card.
3. **Refresh your Stud.IP tabs** (F5).

### Permissions and privacy

The extension asks only for the `storage` permission. Your tags, colours, plan and filter settings are stored locally in `chrome.storage.local` in your browser profile. They are not synced between computers (use export/import for that) and are deleted if you remove the extension, so export a backup first.

---

## 2. First steps

1. Open **Meine Veranstaltungen** (My courses). You should see a filter bar above the course table and a **"+ tag"** button next to each course name.
2. Tag a few courses.
3. Open the **Planer**. Tags and a filter bar appear there too.

> **Important:** visit "Meine Veranstaltungen" at least once (and again for other semesters). The extension remembers each course's number and name there. The Planer needs this to show automatic tags and to match Übungen with their main course.

---

## 3. Tags (Meine Veranstaltungen)

| Action | How |
| --- | --- |
| Add tags | Click **+ tag**, type one or several names separated by commas (`Informatik, Pflicht`) |
| Remove a tag from a course | Click the **×** on the tag |
| Change a tag's colour | Click the tag's text and pick a swatch or **custom** colour. **reset** returns to the automatic colour |
| Rename a tag | Click the tag's text, edit the name in the popup, press Enter or **rename** |

Notes:

- Colours and renames apply to the tag **everywhere**, not just on one course.
- Renaming a tag to a name that already exists asks whether to **merge** them.
- **Automatic tags** (grey-looking, no ×) come from the course number prefix, e.g. `2.01.…` becomes "Informatik". They can't be edited in the popup; change them in `PREFIX_TAGS` (see section 8).

### Filter bar

- Click tag chips to filter the course table. Courses without a match are hidden.
- **match: ANY / ALL** switches between "has at least one selected tag" and "has every selected tag".
- **clear** resets the filter. A counter shows how many courses are visible.
- **export** / **import**: see section 7.

---

## 4. Studienablaufplan

The plan sits above the filter bar and follows the Master Informatik layout: four semesters with Freie Akzentwahl, Akzentwahl (Angewandte / Praktische / Theoretische / Technische Informatik), NI-Wahl, Projektgruppe (24 KP) and Abschlussmodul (30 KP). The header shows a progress bar of planned credits against 120 KP and a ▾ button to collapse the plan.

### Tags the plan understands

Slots match courses by these tag names (upper/lower case doesn't matter):

| Tag | Used by |
| --- | --- |
| `Informatik` | Freie Akzentwahl slots (together with the four tags below) |
| `Angewandte Inf.` | Akzentwahl Angewandte Inf. (and Freie Akzentwahl) |
| `Praktische Inf.` | Akzentwahl Praktische Inf. (and Freie Akzentwahl) |
| `Theoretische Inf.` | Akzentwahl Theoretische Inf. (and Freie Akzentwahl) |
| `Technische Inf.` | Akzentwahl Technische Inf. (and Freie Akzentwahl) |
| `NI` | NI-Wahl slots |
| `Projektgruppe` | Projektgruppe |
| `Abschlussmodul` | Abschlussmodul |
| `Übung` | Groups an exercise course with its main course (see below) |

If you rename one of these tags with the rename popup, the plan follows the new name automatically.

### Placing courses

- Click **▦ plan** next to a course. Matching slots get a green outline, the others fade out. Click a green slot to place the course. Esc or **cancel** aborts.
- Clicking a faded slot asks whether to place the course there anyway (useful if a tag is missing).
- Click an **empty slot** to filter the course table to courses that fit it.
- Click a **course name inside the plan** to move it to another slot; click the **×** to remove it.
- The **✎** in an empty slot lets you type a course name by hand (handy for the Projektgruppe or Abschlussmodul).
- A course sits in one slot only. Placing it again moves it. Once placed, its button reads e.g. **▦ 2. Sem**.
- **clear plan** empties the plan but keeps your tags.

### Rearranging blocks (drag and drop)

Drag a block onto another block to **swap their positions**. For example, drag "Akzentwahl Theoretische Inf." from semester 2 onto "Akzentwahl Angewandte Inf." in semester 1 to switch them. The course inside a block moves with it, and the semester shown everywhere updates.

- The Projektgruppe and Abschlussmodul are fixed.
- Blocks only swap; they can't move into gaps.
- **reset layout** (appears after you move something) restores the original arrangement.

### Übung grouping

A course tagged `Übung` is treated as part of the plan if a course with the **same name** is placed in a slot. Names are compared ignoring case, extra spaces and a trailing "(fällt aus)". Such an Übung gets the same ▦ semester marker (with a dotted border on its button) and stays visible in the Planer's "Only my plan" filter. Names must match exactly otherwise ("Regelungstechnik" and "Regelungstechnik – Übung" are not grouped).

---

## 5. Planer (timetable)

On the Planer page (weekly calendar view) the extension adds:

- **Tag chips** after each course title, in your colours, plus a dark **▦ n. Sem** marker for courses in your plan
- A **filter bar** above the calendar:
  - tag chips with **match: ANY / ALL**
  - **▦ Only my plan**: show only courses placed in the plan (including their Übungen)
  - **1. Sem … 4. Sem** chips (visible once "Only my plan" is on): limit to courses planned for those semesters. The Projektgruppe counts for semesters 2 and 3. None selected means all.
  - **clear** and a counter of visible events this week

Tag and plan filters combine. Your filter choice is saved and survives reloads and semester changes.

Things to know:

- Calendar entries that aren't courses (e.g. private dates) are hidden while a filter is active.
- Hidden courses leave a gap; overlapping courses keep their half width because the calendar lays out columns itself.
- The **"Stundenplan"** view has not been tested; only the "Wochenkalender" view was.

---

## 6. Multiple tabs

Changes sync across open Stud.IP tabs automatically.

---

## 7. Export and import (backup)

Use the **export** and **import** buttons at the right end of the filter bar on "Meine Veranstaltungen".

- **Export** downloads `studip-tags-YYYY-MM-DD.json` with tags, colours, the plan, the block layout and plan-tag renames. Course numbers and names are included for readability only.
- **Import** loads such a file and **merges** it into your current data. Tags are added, imported colours overwrite colours for the same tag name, imported plan slots overwrite the same slots, and nothing is deleted. A layout is only applied if it is a valid arrangement of the movable blocks.
- Use it to back up before removing the extension, to move to another computer, or to share your tags with someone taking the same courses (course IDs are the same for everyone).

Not included in the export: the Planer filter selection, and the remembered course numbers and names (rebuilt when you visit "Meine Veranstaltungen").

---

## 8. Customising

**Automatic tags from course numbers** – top of `content.js`:

```js
const PREFIX_TAGS = {
  "2.01": "Informatik",
  // "2.02": "Physik",
};
```

**Tag names the plan looks for** – `PLAN_TAG` at the top of `plan.js`. Change the values if you prefer different names.

**Plan layout** – `PLAN_SLOTS` in `plan.js` is plain data (semester, column, size, credit points, accepted tags per block). Edit it if your programme differs.

After any change: reload the extension and refresh Stud.IP.

---

## 9. Troubleshooting

| Problem | What to try |
| --- | --- |
| Nothing appears | Check the extension is enabled in `chrome://extensions`, refresh the Stud.IP tab, and make sure you are on `elearning.uni-oldenburg.de` |
| `Extension context invalidated` in the console | You reloaded the extension while a Stud.IP tab was open. Refresh the tab. This is harmless; your data is untouched |
| No automatic tags in the Planer | Visit "Meine Veranstaltungen" once so the extension can remember course numbers |
| Übung not grouped | Check it has the `Übung` tag and the exact same name as a course that is in the plan; open "Meine Veranstaltungen" to refresh remembered names |
| A tag shows nowhere in the plan | Check the tag spelling against the table in section 4 (or your renamed version) |
| Layout or tags vanished after updating | Re-import your last export |
| Something broke after a Stud.IP update | The extension relies on Stud.IP's page structure; send an updated saved copy of the page and the selectors can be adjusted |

---

## 10. Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension definition (Manifest V3, storage permission, runs on `elearning.uni-oldenburg.de`) |
| `plan.js` | Studienablaufplan: layout, placing, drag and drop, Übung grouping |
| `planer.js` | Planer integration: tags on events, filter bar |
| `content.js` | Tags, colours, rename, filter bar, export/import, storage |
| `style.css` | Styling for everything |
