# Bug-fix plan — Copy character count

**Plugin:** Copy character count
**Last updated:** 2026-05-12
**State going in:** 62 of 74 QA tests passing via sandbox-runnable checks; 12 sections still need in-Figma verification; one bug found and already fixed during the QA run.

## How this doc is structured

Three buckets. Each bucket has priority tags so you can pick fixes off the top:

- **Bucket A — Confirmed bugs.** Reproducible failures.
- **Bucket B — Anticipated issues.** Things the in-Figma walk-through is likely to surface, with the fix already worked out.
- **Bucket C — Technical debt / out-of-scope-for-v1.** Limitations we shipped on purpose; track as future work.

Priority labels: **P0** = must-fix before next Community submission, **P1** = fix in the next patch, **P2** = file for v1.1+.

---

## Bucket A — Confirmed bugs

### A1. Demo translation provider drops case on exact-phrase matches **P0 · ✅ FIXED**

**Symptom:** `demoProvider.translate("Open", "de")` returned `"offen"` instead of `"Offen"`. Affected any capitalized single-word source whose dictionary value was stored lowercase.

**Cause:** The exact-phrase match path in `src/translate/demo.ts` returned the dictionary value directly, bypassing the `restoreCase()` helper used by the word-by-word fallback path.

**Fix:** One line — wrap the phrase-hit return in `restoreCase()`. Already shipped as commit `89ea5c4`.

**Verify:** `tsx tests/qa-runner.ts` should show 47/47 passing. The pinned test cases (`QA-30.1 de open`, `QA-31.1 es open`, `QA-31.4 es more`) cover this regression going forward.

---

## Bucket B — Anticipated issues from in-Figma verification

These are the failures most likely to come out of the 12 unverified QA sections. Each has a hypothesis + fix worked out so triage is fast.

### B1. Preview thumbnail flickers on rapid frame switching **P1**

**Likely symptom:** Switching frames quickly leaves a brief flash of the previous preview before the new one resolves.

**Root cause hypothesis:** `onCountResult` hides the old preview on new-frame branch, but the export is fired *after* the count result is sent. There's a ~100–300ms gap where the panel shows "0 text layers" with no image.

**Fix sketch:** Move the `img.classList.add('hidden')` before the export, and add a CSS transition opacity:0 → 1 (~120ms) when a new preview lands. Trivial.

**Verify against:** QA-43, QA-44.

### B2. Settings (API key) panel doesn't exist yet **P0** *if real provider is wired*

**Likely symptom:** Once we replace `demoProvider` with `deeplProvider`, the user has no way to enter their API key. First Translate click would 401.

**Root cause:** PRD lists the Settings panel for v1 but only the demo provider is wired. We haven't built the gear icon, the `figma.clientStorage` round-trip, or the inline "set up your translation key" overlay.

**Fix sketch:** Implement `src/translate/settings.ts` (read/write via `figma.clientStorage`), add a gear icon to the header, and gate the first Translate click on `hasKey === true`. This is ~half a day of work.

**Verify against:** PRD §7.1, §7.2.

**Defer if:** sticking with the demo provider for v1.0. Then this becomes a v1.1 task.

### B3. Long frame names overflow the header **P2**

**Likely symptom:** Picking a frame named with 80+ characters wraps the header to two lines and pushes everything down.

**Root cause:** `.frame-title` has no truncation; it's just `h1` with `font-size: 18px; font-weight: 600`.

**Fix sketch:** Add `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;` to `.frame-title`. Two-line CSS change.

**Verify against:** QA-56.

### B4. Resize grip is hard to grab **P2**

**Likely symptom:** The 14×14 grip in the bottom-right corner is a small target.

**Root cause:** Functional grip size is 14×14 pixels — below most accessibility minimums of 24×24.

**Fix sketch:** Increase the grip to 20×20, keep the visible diagonal-lines pattern at 14×14 but extend the clickable hit area outward. Could also add a hover state that grows the visible portion. Trivial CSS change.

**Verify against:** QA-46, QA-74.

### B5. Frame deletion not actively detected **P1**

**Likely symptom:** If the user deletes the selected frame in Figma, the panel stays on the deleted frame's data until they click elsewhere.

**Root cause hypothesis:** `figma.on('selectionchange', ...)` fires when selection changes, but deleting a node may not always fire it (depends on whether the deletion changed selection too). Documents emit `documentchange` events that are more reliable for this.

**Fix sketch:** Add a `documentchange` listener in `main.ts` that re-runs `refreshFromSelection()` when nodes are deleted or restructured. Cost: ~10 lines + careful debouncing (use the same 150ms debounce as selectionchange).

**Verify against:** QA-57.

### B6. Hidden layers checkbox not exposed in UI **P2**

**Likely symptom:** `collect()` already supports `includeHidden = true`, but there's no UI toggle for it. The PRD mentioned a checkbox in the header.

**Root cause:** UI affordance never built.

**Fix sketch:** Add a small checkbox-inline element to the frame header: `<label class="checkbox-inline"><input type="checkbox" id="include-hidden" /><span>Include hidden layers</span></label>`. Wire up to a new state field + post `'refresh'` message on toggle. ~15 lines.

**Verify against:** QA-9.

### B7. Translate badge doesn't show length delta **P2** (open question Q4 in PRD)

**Likely symptom:** Designers spotting German overflow have to mentally compare totals. Badge currently just says `Translated to German · Reset`.

**Fix sketch:** Compute `(totalTranslatedChars / totalOriginalChars - 1) * 100` and append `+18%` to the badge when positive (or `-12%` when shorter). Localize "+/-" as `+`/`−`. Five lines.

**Verify against:** PRD open question Q4.

### B8. RTL paste verification needed **P0** *if Arabic is a launch target*

**Likely symptom:** Pasting Arabic-translated output into a doc may render LTR depending on receiving app.

**Root cause:** Clipboard is plain text — we don't write RTL markers (U+200F / U+202B). Most receiving apps detect Arabic and flip automatically; some don't.

**Fix sketch:** Prefix each Arabic line in the preview with U+200F (RTL marker) when `activeTranslation === 'ar'`. Optional; test with the targets we care about first.

**Verify against:** QA-29.

### B9. Section semantics may need a UX call **P1**

**Likely symptom:** When the user clicks a Section itself (not a frame inside it), the panel goes to empty state. Users may expect the section's frames to be listed.

**Root cause:** Design decision — we removed the frame picker, so selecting a section reasonably means "nothing specific is selected".

**Fix sketch:** Two options. (a) Leave as-is and document. (b) When selection is a Section, surface "This section contains N frames — click one" in the empty state, optionally with quick-pick chips. Option (b) is ~20 lines but reintroduces some picker-style complexity we deliberately removed.

**Verify against:** QA-7.

### B10. No way to know whether Output card is full or scrollable **P2**

**Likely symptom:** With 100+ text layers, the table area scrolls internally but there's no scrollbar visual cue until the user starts scrolling.

**Root cause:** Default browser scrollbars are auto-hide on macOS.

**Fix sketch:** Add a subtle fade-out gradient at the bottom of `.table-wrap` to hint "more below". CSS-only:
```css
.table-wrap { mask-image: linear-gradient(180deg, black 92%, transparent); }
```
Or accept that designers know table = scrollable.

**Verify against:** QA-18.

---

## Bucket C — Technical debt / known v1 limitations

Track these as v1.1+ work. Not regressions, just things we intentionally deferred.

### C1. Real translation provider (DeepL / Google / OpenAI) **P1 for v1.1**

Demo provider is shipping for v1.0 because the manifest network-access change requires a fresh Figma Community review. Real provider work involves:
- `src/translate/deepl.ts` (~80 lines including auth header + JSON batching)
- `src/translate/google.ts` (~80 lines)
- `src/translate/openai.ts` (~120 lines including the system prompt)
- Settings panel (B2)
- Updating manifest `networkAccess.allowedDomains` to the three provider hostnames
- Drafting the `reasoning` string for Figma's review

Estimated effort: ~2–3 days end-to-end including review-prep.

### C2. Translation cache survives frame switch **P2 for v1.2**

PRD said cache resets on frame switch — that's what's shipped. But many users iterate on the same frame repeatedly; a session-lifetime cache would feel faster. Risk: stale entries when the user edits text mid-session. Worth a small redesign call.

### C3. Glossary / brand-term overrides **P2 for v2.1**

User-provided dictionary for terms like `"Sign up" → "Registrarse"`. Out of scope for v1; deferred to v2.1.

### C4. In-place text mutation **P2 for v2.0**

Replace canvas text with translation. Requires read-write mode and confirmation modal. Big UX call.

### C5. Translation column in the Text Layers table **P2 for v1.2**

Some users will want translations alongside originals in the table (not just the Output). Adding three columns. Reintroduces width pressure; need a column-show toggle.

### C6. Translated counts in table **P2 for v1.2**

Same as C5 but counts only. Less invasive than full translation column.

### C7. Translation history / undo across sessions **P2 for v1.2**

Persist last-translated state to `figma.clientStorage` so reopening the plugin resumes where the user left off.

### C8. More than 3 target languages **P2 for v1.1**

Add French, Japanese, Korean. Mechanical once real provider is wired (just update the dropdown options).

### C9. Auto-detect source language **P2 for v2.0**

Currently assume English. Detect would let users translate non-English source frames.

### C10. Performance instrumentation **P2**

No telemetry on selection-change latency, translation API latency, etc. Worth adding minimal `performance.mark()` calls before v1.1 ships so we can monitor regressions.

---

## Suggested fix order

If you want a concrete order of operations:

**Sprint 1 (pre-Community-submission patch, 1 day)**
1. ✅ A1 — case restoration (done, commit `89ea5c4`).
2. B3 — frame title truncation (CSS).
3. B4 — bigger resize grip hit area (CSS).
4. B6 — Include hidden layers checkbox (small UI).
5. Run the full in-Figma QA pass to confirm no surprises.
6. Submit a v1.0.1 patch release to Figma Community.

**Sprint 2 (v1.1, ~3 days)**
7. B5 — `documentchange` listener for frame-deletion detection.
8. B2 + C1 — real provider integration (DeepL first) + Settings panel.
9. C8 — additional languages (French, Japanese, Korean).
10. B7 — length-delta in translated badge (open Q4).
11. B1 — preview cross-fade.
12. Submit v1.1.

**Sprint 3 (v1.2, ~2 days)**
13. C5 / C6 — optional translation columns in the table behind a toggle.
14. C7 — session persistence.
15. C2 — cross-frame translation cache.
16. B10 — scroll affordance.

**Sprint 4+ (v2.0, ~1 week)**
17. C4 — in-place mutation with confirmation modal.
18. C3 — glossary support.
19. C9 — auto-detect source language.

## Out-of-scope for this plan

- Marketing copy, screenshots, video for the Community listing (handled by Emilia).
- Pricing strategy for DeepL/Google API costs.
- Localizing the plugin's own UI into target languages (meta-translation).

## How to verify the plan

After each sprint:

1. Run `tsx tests/qa-runner.ts` — must show 0 failures.
2. Run the full in-Figma walk-through from `docs/qa.md` regression suite (§14).
3. For any new feature, add a new QA section to `docs/qa.md` so it's regression-tested next time.
4. Update `README.md` if behavior changes user-facing.

## Sign-off

Plan owner: Emilia
Estimated total effort to clear Bucket A + Bucket B P0s: ~1 day.
Estimated total effort to clear Bucket A + Bucket B (all): ~3 days.
Estimated total effort to clear all three buckets through v2.0: ~3 sprints (≈3 weeks).
