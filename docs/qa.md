# QA test plan — Copy character count

**Plugin:** Copy character count
**Repo:** github.com/epokta/figma-plugin-copy-character-count
**Last updated:** 2026-05-12

This is a hand-test plan. Run it before every release that goes to Figma Community review. Severity tags: **P0** = release blocker, **P1** = ship-with-bug-but-create-issue, **P2** = polish.

## Conventions

- "Plugin" means: `Plugins → Development → Copy character count` in Figma desktop.
- Each test has a **Steps** section (what to do) and an **Expected** section (what should happen).
- Mark a test ✅ pass / ❌ fail / ⚠️ partial. Note actual behavior on a fail.
- If something fails, file an issue with the test ID (e.g. `QA-12`) in the title.

## Prerequisites

- macOS, Figma desktop installed and signed in.
- Plugin sideloaded from `manifest.json` at the repo root.
- A test file with at least:
  - One top-level frame containing 5–10 text layers of varied length and casing (call this **`FRAME-A`**).
  - One Section containing 2 nested frames (call them **`SECTION-FRAME-1`** and **`SECTION-FRAME-2`**).
  - One frame with **only** hidden text layers.
  - One frame with multi-codepoint emoji in a text layer (`👨‍👩‍👧`, `🇩🇪`).
  - One frame with 50+ text layers.

---

## 1. Smoke tests (run every time)

### QA-1 · Plugin opens **P0**

**Steps:** Run `Plugins → Development → Copy character count`.
**Expected:** Panel opens at ~720×820. Header reads "Copy character count" in the window title. No console errors in Figma's developer console.

### QA-2 · No-selection state **P0**

**Steps:** Open the plugin with nothing selected in the canvas.
**Expected:** Panel shows the "Select a frame" empty-state card. No table, no Output card.

### QA-3 · Default behavior on selection **P0**

**Steps:** Select `FRAME-A`.
**Expected:** Frame name appears as the header. Subtitle shows correct text-layer count (e.g. "8 text layers"). Preview thumbnail renders on the left. Table fills with all text layers. Output card visible with default Format = Plain list.

---

## 2. Frame selection & detection

### QA-4 · Selection auto-updates the panel **P0**

**Steps:** With the plugin open, click another frame in the canvas.
**Expected:** Within ~250ms, the panel re-renders with the new frame's name, preview, and text layers. No flicker. No stale data from the previous frame.

### QA-5 · Selecting a text layer promotes to its parent frame **P1**

**Steps:** With the plugin open, click a single text layer inside `FRAME-A`.
**Expected:** Panel still shows `FRAME-A` (the parent frame), not the text layer alone. Table contains all of `FRAME-A`'s text layers.

### QA-6 · Selecting a frame inside a Section works **P0**

**Steps:** Select `SECTION-FRAME-1` (a frame nested inside a Section).
**Expected:** Panel shows `SECTION-FRAME-1` data. Preview renders. All text layers listed.

### QA-7 · Selecting the Section itself **P2**

**Steps:** Select the Section that contains the two frames.
**Expected:** Panel shows the no-selection empty state (Sections are not promoted to frames). Verify this is intentional behavior, not a regression.

### QA-8 · Frame with 0 text layers **P1**

**Steps:** Select a frame containing only shapes / images, no text.
**Expected:** Frame name + preview render. Table area shows the empty state "This frame has no text layers." Output preview is empty. Copy now button shows a toast on click.

### QA-9 · Hidden text layers are skipped **P1**

**Steps:** Select a frame whose only text layers are hidden (visibility off).
**Expected:** Panel shows the same empty-state as QA-8. Hidden layers should not appear in the table.

### QA-10 · Deselecting reverts to the empty state **P1**

**Steps:** With a frame selected, click on the canvas background to deselect.
**Expected:** Panel transitions back to "Select a frame" empty state. Any previous preview image is cleared.

### QA-11 · Switching frames mid-translation doesn't show stale data **P1**

**Steps:** Select `FRAME-A`, click Translate (in any language), and *while it's still loading* click `SECTION-FRAME-1`.
**Expected:** When the in-flight translation resolves, it does not replace `SECTION-FRAME-1`'s preview. New frame's data is correct and clean.

---

## 3. Text layers table

### QA-12 · Character counts are correct **P0**

**Steps:** Select `FRAME-A`. For 3 known strings, compare the Raw column to the actual string length (counting by grapheme clusters).
**Expected:** Counts match. ASCII strings count by visible characters. Multi-codepoint emoji (e.g. `👨‍👩‍👧`) count as 1 grapheme.

### QA-13 · Text column shows actual text content, not layer name **P1**

**Steps:** Look at the Text column.
**Expected:** Each row shows the text inside the layer, not the layer's Figma name. Truncated with ellipsis if too long. Hovering shows the full text + layer name in a tooltip.

### QA-14 · Mode dropdown is fully readable **P0**

**Steps:** Look at the Mode column.
**Expected:** Dropdowns are at least 32px tall, show full labels ("None", "Down 5", "Up 5") without truncation, have ≥8px of breathing room around the chevron. Hover state changes background.

### QA-15 · Per-row rounding updates Round column **P0**

**Steps:** On a row with Raw = 23, set Mode to "Down 5". Then "Up 5". Then "None".
**Expected:** Round column shows 20 / 25 / 23 respectively.

### QA-16 · Bulk "Set all rows to" applies to every row **P0**

**Steps:** Change "Set all rows to" to "Down 5".
**Expected:** All rows' Mode dropdowns change to "Down 5" and Round column updates accordingly.

### QA-17 · Select all / deselect all toggle **P0**

**Steps:** Click the "Select all" checkbox in the table header.
**Expected:** All row checkboxes toggle (off then on). The bulk checkbox state syncs to per-row state if you toggle individual rows.

### QA-18 · Table scrolls vertically with many rows **P0**

**Steps:** Select the frame with 50+ text layers.
**Expected:** Table area scrolls vertically. Output card stays pinned at the bottom of the right column — never falls off-screen.

### QA-19 · Table never scrolls horizontally **P0**

**Steps:** Resize plugin to its narrowest side-by-side width (~720). Visually inspect.
**Expected:** All five columns (check / Text / Raw / Round / Mode) fully visible. No horizontal scrollbar. Only Text column truncates with ellipsis if needed.

### QA-20 · Per-row + bulk Mode independence **P1**

**Steps:** Set bulk to "Down 5". Change one row to "Up 5".
**Expected:** Bulk dropdown still shows "Down 5". The one row stays at "Up 5". Other rows still "Down 5".

---

## 4. Output formats

### QA-21 · Plain list format **P0**

**Steps:** With several rows selected, Format = Plain list.
**Expected:** Preview shows lines like `Welcome to Tripguide: 20 chars` (text colon space count chars). Same as Copy now output.

### QA-22 · Markdown bullets format **P0**

**Steps:** Switch Format to Markdown bullets.
**Expected:** Preview shows lines like `- Welcome to Tripguide: 20 chars`. Each line starts with `- `.

### QA-23 · `key: value` format **P0**

**Steps:** Switch Format to `key: value`.
**Expected:** Preview shows lines like `Welcome to Tripguide: 20`. No "chars" suffix.

### QA-24 · Format swap is instant **P1**

**Steps:** Click rapidly between formats.
**Expected:** Preview updates immediately each time. No flicker or stale state.

### QA-25 · Selecting rows updates the preview **P0**

**Steps:** Uncheck 2 rows.
**Expected:** Preview no longer includes those rows. Total lines decreases by 2.

### QA-26 · Translated character counts in preview when translation is on **P0**

**Steps:** Click Translate (German). Format = Plain list.
**Expected:** Preview lines now show **translated** strings AND **translated character counts**. For example, "Welcome to Tripguide" (20 chars) → "Willkommen bei Tripguide" (24 chars).

---

## 5. Copy now

### QA-27 · Copy now writes to clipboard **P0**

**Steps:** Click Copy now. Paste into a text editor.
**Expected:** Pasted content matches the preview textarea exactly. Button briefly flips to "Copied ✓" with a toast.

### QA-28 · Empty preview shows toast **P1**

**Steps:** Uncheck all rows so preview is empty. Click Copy now.
**Expected:** Toast appears: "Nothing to copy — select at least one row." Button does not change.

### QA-29 · Copy with translated content **P0**

**Steps:** Translate to Arabic. Click Copy now. Paste into a text editor that supports RTL (Notes, TextEdit, Slack).
**Expected:** Pasted content has Arabic strings (right-to-left rendering). Counts are translated counts.

---

## 6. Translate feature

### QA-30 · Translate to German **P0**

**Steps:** Select `FRAME-A`. Click Translate (German).
**Expected:** Button shows "Translating…" for ~250ms then "Translate" again. Badge appears: "Translated to **German** · Reset". Preview re-renders with German strings and translated counts.

### QA-31 · Translate to Spanish **P0**

**Steps:** Click Reset. Choose Spanish from the dropdown. Click Translate.
**Expected:** Badge updates to "Translated to **Spanish**". Preview shows Spanish.

### QA-32 · Translate to Arabic **P0**

**Steps:** Click Reset. Choose Arabic. Click Translate.
**Expected:** Badge updates. Preview shows Arabic strings rendered right-to-left in the textarea.

### QA-33 · Reset reverts to originals **P0**

**Steps:** While in any translated state, click Reset.
**Expected:** Badge disappears. Preview shows English originals again. Cache is preserved — re-clicking Translate with the same language is near-instant.

### QA-34 · Translation cache works **P1**

**Steps:** Translate to German. Click Reset. Click Translate (German) again immediately.
**Expected:** Second translation completes faster than the first (cache hit). If using DeepL/Google later, would manifest as no second API call.

### QA-35 · Frame switch clears translation **P1**

**Steps:** Translate to German. Click `SECTION-FRAME-1` in the canvas.
**Expected:** Badge disappears. Preview shows `SECTION-FRAME-1` in English.

### QA-36 · Unknown strings pass through **P1**

**Steps:** Select a frame containing a brand name like "Tripguide" or proper noun.
**Expected:** Such strings appear unchanged in the translation (the demo provider doesn't have entries for proper nouns).

### QA-37 · Rounding still applies to translated counts **P0**

**Steps:** Set bulk rounding to "Up 5". Translate to German.
**Expected:** Round column-style outputs in the preview reflect the translated count rounded up to the nearest 5. So a German string of 22 chars renders as 25 in the preview.

### QA-38 · Empty source string handled in translation **P2**

**Steps:** Select a frame with an empty text layer. Translate.
**Expected:** Row's preview line shows `(empty): N chars` or is gracefully skipped. No crash.

### QA-39 · Translating with no rows selected **P1**

**Steps:** Uncheck all rows. Click Translate.
**Expected:** Toast: "Select at least one row to translate." No API call. Badge does not appear.

### QA-40 · Translate button disabled state during request **P1**

**Steps:** Click Translate. Immediately click Translate again.
**Expected:** First click triggers the request. Subsequent clicks while in-flight are no-ops. Button shows "Translating…" and is grayed out.

---

## 7. Preview & frame thumbnail

### QA-41 · Preview thumbnail renders for selected frame **P0**

**Steps:** Select any frame.
**Expected:** Preview image renders in the left column within ~500ms. Aspect ratio preserved.

### QA-42 · Preview clears on no-selection **P1**

**Steps:** Deselect everything.
**Expected:** Empty state shown. No leftover image from previous frame.

### QA-43 · Preview updates on frame change **P0**

**Steps:** Select `FRAME-A`, then `SECTION-FRAME-1`.
**Expected:** Preview swaps to the new frame's screenshot.

### QA-44 · Preview hides while loading new frame **P1**

**Steps:** Click between frames quickly.
**Expected:** Old preview hides immediately when a new frame is selected, then new preview fades in. No stale image lingers.

---

## 8. Window sizing & responsive layout

### QA-45 · Default size opens at 720×820 **P0**

**Steps:** Open plugin freshly.
**Expected:** Window opens close to 720×820. Preview on left ~50%, controls on right ~50%.

### QA-46 · Resize via corner grip works **P0**

**Steps:** Drag the resize grip in the bottom-right corner.
**Expected:** Window resizes smoothly. Min ~320×400, max ~1200×1400. Layout reflows.

### QA-47 · Side-by-side layout at wide widths **P0**

**Steps:** Resize wider than 540 px.
**Expected:** Preview on left, controls on right. 50/50 ratio (preserved unless right column hits min-width).

### QA-48 · Stacks at narrow widths **P0**

**Steps:** Resize narrower than 540 px.
**Expected:** Layout flips to stacked: preview on top, controls below. Page becomes scrollable.

### QA-49 · 5+ text-layer rows visible at default size **P1**

**Steps:** Open plugin at default size. Select a frame with 8+ text layers.
**Expected:** At least 5 rows of the table are visible without scrolling. Output card still fully visible below.

### QA-50 · Output card never falls off-screen **P0**

**Steps:** Select a frame with 50+ text layers.
**Expected:** Table area scrolls internally. Output card and Copy now button always pinned at the bottom of the right column.

---

## 9. Visual / UI polish

### QA-51 · All dropdowns have same height **P1**

**Steps:** Visually compare "Set all rows to", "Format", "Translate to", and per-row Mode dropdowns.
**Expected:** All four types of dropdowns are 32px tall and use the same border, radius, font size, and padding pattern.

### QA-52 · Dropdown chevron has 8px padding on all sides **P1**

**Steps:** Inspect any dropdown.
**Expected:** ≥8px of clear space above, below, left, and right of the native chevron.

### QA-53 · Cream page background, white cards **P2**

**Steps:** Visually inspect the panel background and card backgrounds.
**Expected:** Page background slightly off-white / cream. Cards are pure white. Subtle 1px borders, no heavy shadows.

### QA-54 · Dark mode looks correct **P0**

**Steps:** Switch macOS or Figma to dark mode. Reopen the plugin.
**Expected:** Backgrounds darken cleanly. Borders are subtle. Text is readable. No black-on-black or white-on-white surfaces.

### QA-55 · Translated-state badge styling **P2**

**Steps:** Trigger translation. Inspect the badge above the preview textarea.
**Expected:** Badge is a small pill with `Translated to **German** · Reset`. Reset is a link, not a button. Badge disappears on Reset.

### QA-56 · Frame header truncates long names **P2**

**Steps:** Select a frame named with a 100+ character title.
**Expected:** Title truncates with ellipsis. Doesn't wrap to multiple lines or break the header layout.

---

## 10. Edge cases & robustness

### QA-57 · Frame deleted mid-use **P1**

**Steps:** Open the plugin with a frame selected. In Figma, delete that frame.
**Expected:** Plugin reverts to no-selection state. No crash. No stale preview.

### QA-58 · Frame renamed mid-use **P2**

**Steps:** Rename the selected frame in Figma's layers panel.
**Expected:** Plugin's frame header updates within ~500ms.

### QA-59 · Text edited mid-use **P1**

**Steps:** Edit one of the text layers in Figma while plugin is open.
**Expected:** Re-clicking the frame in the canvas (or selectionchange firing) updates the table to reflect the new text + character count.

### QA-60 · 100+ text layer frame **P1**

**Steps:** Construct a frame with 100+ text layers. Select it.
**Expected:** Table populates within ~1 second. Smooth scroll. Translate is reasonably fast (<3s for the demo provider).

### QA-61 · Special characters in text **P1**

**Steps:** Include text layers with quotes, colons, backslashes, newlines, tabs.
**Expected:** All render correctly in the Text column (truncated, whitespace collapsed to single spaces). Output preview escapes nothing — but newlines inside a single text layer are replaced with spaces in the preview line.

### QA-62 · RTL Arabic source text **P1**

**Steps:** Add a text layer with native Arabic content in the design. Select that frame.
**Expected:** Arabic text renders right-to-left in the Text column. Character count is correct (grapheme clusters).

### QA-63 · Locked layers **P2**

**Steps:** Lock some text layers in the frame.
**Expected:** They still appear in the table with correct counts. Plugin is read-only, so lock state doesn't affect anything.

### QA-64 · Component instances **P1**

**Steps:** Select a frame that contains an instance of a component with text overrides.
**Expected:** Override text appears in the table (not the master text). Counts are correct.

---

## 11. Performance

### QA-65 · Selection change latency **P1**

**Steps:** Click rapidly between three different frames.
**Expected:** Panel updates within ~300ms of each click. No queue / lag buildup. No console errors.

### QA-66 · Translation speed (demo provider) **P2**

**Steps:** Translate a 50-row frame.
**Expected:** Translation completes in <1 second (demo provider has a 250ms artificial delay; the rest is render).

### QA-67 · Preview export speed **P2**

**Steps:** Select a large frame (e.g. 4000×4000 px artboard).
**Expected:** Preview thumbnail loads within ~1.5 seconds. No blocking of the main UI.

---

## 12. Manifest & publishing

### QA-68 · `networkAccess` matches actual usage **P0**

**Steps:** Inspect `manifest.json`.
**Expected (current):** `allowedDomains: ["none"]`. Plugin makes zero outbound network calls. (Will change to allowlist DeepL/Google/OpenAI once real translation API is wired up — track separately.)

### QA-69 · `documentAccess: "dynamic-page"` **P1**

**Steps:** Inspect `manifest.json`.
**Expected:** `documentAccess` is `"dynamic-page"`. Plugin works on multi-page files.

### QA-70 · Plugin ID is set **P0**

**Steps:** Inspect `manifest.json`.
**Expected:** `id` field is the Figma-issued numeric ID for the published plugin (currently `1636096176010231203`).

---

## 13. Accessibility

### QA-71 · Keyboard navigation **P1**

**Steps:** Tab through the panel from the top.
**Expected:** Focus moves through bulk select-all → Set all rows to → row checkboxes → row Mode selects → Format → Translate to → Translate button → Reset (if visible) → Copy now → resize grip. All in a logical order.

### QA-72 · Focus rings are visible **P1**

**Steps:** Tab to any interactive element.
**Expected:** A 2px brand-colored outline is visible around the focused element. Outline-offset is `-1px` so it sits inside the element.

### QA-73 · Screen reader basics **P2**

**Steps:** Turn on VoiceOver. Navigate the panel.
**Expected:** Frame name, text-layer count, table column headers, each Mode select, and the Copy now button all have readable labels. The Translate button announces its state ("Translating…").

### QA-74 · Touch target sizes **P2**

**Steps:** Inspect interactive elements.
**Expected:** All buttons and selects are at least 28px tall (32px for selects, 36px for primary button). Checkboxes are 14×14 — small but acceptable for a desktop plugin.

---

## 14. Regression suite (run on every release)

This is the must-pass subset. If any of these fail, do not release.

- QA-1, QA-2, QA-3 (smoke)
- QA-4, QA-6 (selection + section detection)
- QA-12, QA-14 (counts + dropdown readability)
- QA-15, QA-16 (rounding modes)
- QA-19 (no horizontal scroll)
- QA-21, QA-22, QA-23 (output formats)
- QA-27 (copy now)
- QA-30, QA-31, QA-32, QA-33 (translation flows)
- QA-45, QA-46, QA-48 (window sizing)
- QA-50 (output card pinned)
- QA-54 (dark mode)
- QA-68 (manifest network access)

## 15. Sign-off

Tested by: _______________
Date: _______________
Plugin version: _______________
Pass count: _____ / 74
Open issues: _______________
