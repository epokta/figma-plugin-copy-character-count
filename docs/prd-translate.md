# PRD — Translate feature

**Plugin:** Copy character count
**Author:** Emilia
**Status:** Draft (v2 — simplified to output-only translation)
**Last updated:** 2026-05-12

## 1. Summary

Add a **Translate** action inside the existing Output card. The user picks a target language (German, Arabic, Spanish) and hits **Translate** — the plugin sends the strings to a hosted translation API and the Output preview re-renders with translated text and **translated character counts**. The user clicks **Copy now** as usual.

The Text Layers table is untouched. It always shows the originals — those are the source of truth. The Output card is where translation happens, because that's what gets pasted into spec docs, tickets, and strings files.

The plugin stays read-only — it does not edit the Figma document.

## 2. Problem

Designers working on multi-locale products today have to:

1. Hand-copy each text layer one at a time out of Figma.
2. Paste each string into a separate translation tool.
3. Manually count translated character lengths to spot truncation risk (German is ~30% longer than English; Arabic flips RTL with its own line-break rules).
4. Paste the result into a spec sheet for the localization team.

The plugin already solves the first half — extracting the text and counting characters. Adding a Translate button to the Output card closes the loop *without* cluttering the table or changing the source-of-truth view.

## 3. Goals

- **G1** — From the current Output preview, produce a translated version in German, Arabic, or Spanish with one click.
- **G2** — Show translated character counts in the output so the designer can spot length issues (German overflow, Arabic line-break) before sending the design to localization.
- **G3** — Preserve the existing Output formats (plain list / Markdown bullets / `key: value`) when translation is on.
- **G4** — Keep the Text Layers table unchanged. Originals stay visible as the source of truth.
- **G5** — Keep the plugin read-only. No in-place text mutation in v1.

## 4. Non-goals

- **NG1** — Adding columns to the Text Layers table. Translation lives in the Output card only.
- **NG2** — In-place translation of the Figma document. Considered for v2 behind a confirmation modal.
- **NG3** — Translation quality review tooling. Plugin reports what the API returns.
- **NG4** — More than three languages in v1.
- **NG5** — Translation memory / glossary management.
- **NG6** — Offline / on-device translation.

## 5. User stories

- **US1** — *Designer at a travel app:* I have a Benefits screen with 65 strings. I want to click Translate → German, see translated lengths in the Output preview, and immediately spot which headlines overflow.
- **US2** — *Content designer:* I want a Markdown list of translated strings to drop into a Linear ticket so the localization team sees my proposed copy in Spanish, not in English.
- **US3** — *PM:* I want a `key: value` output of the translated set to paste into a strings file for the engineers to wire up.

## 6. Functional requirements

### 6.1 Translate row in the Output card

Add a single row to the Output card, between the Format selector and the preview textarea:

```
Translate to  [ German ▾ ]   [ Translate ]   [ Reset ]
```

- **Language select** — three options: `German (de)`, `Arabic (ar)`, `Spanish (es)`. Defaults to German.
- **Translate** button — secondary style (matches the existing `Copy now` visual weight but in outline form). Pressing it triggers a translation pass.
- **Reset** link — only visible when the output is currently showing a translation. Reverts the preview to the original-language output.

The Text Layers table above is **not modified** in any way by this feature.

### 6.2 What the button does

When the user clicks **Translate**:

1. The plugin collects the set of selected rows (same set the current Output preview is built from).
2. It sends each row's source string to the translation provider (batched into one or two API calls — see §8.5).
3. As translations resolve, the Output preview re-renders with the translated strings substituted for the originals.
4. **Character counts in the preview are now the translated string's grapheme count**, not the original's. The rounding mode applied to each row still applies, but to the translated count.

A status row appears in place of Reset while in flight: `Translating 65 strings…` with a tiny pulse indicator.

### 6.3 Output formats with translation on

When the preview is in translated state, the four format options render as:

- `plain`: `Willkommen bei Tripguide: 24 chars`
- `markdown`: `- Willkommen bei Tripguide: 24 chars`
- `keyvalue`: `Willkommen bei Tripguide: 24`
- *(no new format added — keeps parity with the originals view)*

### 6.4 State persistence within a session

- The user's last-picked language is remembered for the lifetime of the plugin window.
- If the user changes the row selection (un-checks rows, picks a different rounding mode, switches format) **while in translated state**, the preview re-builds in the same translated language — no need to click Translate again.
- If the user changes frames (selects a different frame in Figma), the preview resets to the original-language view. They re-click Translate to re-translate the new frame's strings.

### 6.5 Reset

Clicking **Reset** swaps the preview back to original-language output. The translation cache is preserved — clicking Translate again with the same language is instant (cache hit).

### 6.6 Per-row rounding still applies

Rounding modes the user sets in the table are applied to the translated character count. So a row with `Round up to nearest 5` shows `25` for a translated string of 22 chars in the preview, just like it would for a 22-char original.

### 6.7 RTL handling (Arabic)

- Arabic strings in the preview textarea render right-to-left automatically because the textarea is `dir="auto"`.
- Character counts use the existing grapheme-cluster method — combining marks count as one character.
- Clipboard output is plain text; the receiving app handles RTL rendering.

### 6.8 Error states

- **No API key configured** → first click of Translate opens the Settings panel inline with the API key input. No API call happens until a key is saved.
- **API error on individual strings** → that row appears in the preview as the original source string with a trailing `(translation failed)` note. Other rows render normally. A toast surfaces the underlying provider error.
- **All translations fail** (e.g. invalid key, network down) → preview stays in original-language state; a banner across the top of the Output card says `Translation failed: <message>`.
- **Empty source string** → translation column shows the same empty marker the originals view uses (`(empty)`).

## 7. UX

### 7.1 Settings entry

Add a gear icon in the plugin header (top right of the frame title row) opening a Settings panel. Settings contain:

- **Translation provider** — select (DeepL recommended; Google Cloud Translation; OpenAI). See §9.
- **API key** — password-style input. Stored via `figma.clientStorage` (per-plugin, per-user, never written to the manifest).
- **Reset key** — clears the stored key.
- **About** — one line: "Translations run on your API key. The plugin sends each text layer to the provider's API. The provider does not retain the strings beyond what its TOS states."

The gear icon is hidden until at least one Translate click has happened, to avoid cluttering the header for users who never use translation.

### 7.2 First-run flow

1. User clicks **Translate**.
2. If no API key is configured, an inline panel slides over the Output card with: "To translate, set up your translation key. (link to DeepL signup)"
3. User pastes a key, picks a provider, clicks Save.
4. The Translate button re-fires automatically; the preview populates as each batch returns.

### 7.3 Translated-state badge

While the preview is in translated state, a small pill appears just above the preview textarea: `Translated to German · Reset`. Click Reset to revert.

### 7.4 Loading state

While the request is in flight, the Translate button shows `Translating…` and is disabled. The preview textarea content goes faintly dimmed (50% opacity) to signal it's about to change. Per-string failures don't fail the whole batch.

## 8. Technical requirements

### 8.1 Manifest changes

`manifest.json` currently has:

```json
"networkAccess": { "allowedDomains": ["none"] }
```

Update to allow the chosen provider's hostnames:

```json
"networkAccess": {
  "allowedDomains": [
    "https://api-free.deepl.com",
    "https://api.deepl.com",
    "https://translation.googleapis.com",
    "https://api.openai.com"
  ],
  "reasoning": "Plugin sends text-layer strings to a user-configured translation provider on behalf of the user when they click Translate."
}
```

Figma Community review will scrutinize this. The `reasoning` string is required and shown to users at install time.

### 8.2 New modules

```
src/translate/
  provider.ts        Provider-agnostic interface { translate(strings, target) → translations }
  deepl.ts           DeepL implementation
  google.ts          Google Cloud Translation implementation
  openai.ts          OpenAI implementation (gpt-4o-mini with explicit prompt)
  cache.ts           In-memory cache keyed by (text, lang, provider)
  settings.ts        Read/write API key + provider via figma.clientStorage
```

### 8.3 New message types

```ts
// UI → main
{ type: 'translate', strings: string[], targetLang: 'de' | 'ar' | 'es' }
{ type: 'save-settings', provider: 'deepl' | 'google' | 'openai', apiKey: string }
{ type: 'load-settings' }

// Main → main → UI
{ type: 'translations', translations: { source: string; translation: string }[] }
{ type: 'translation-error', source: string, message: string }
{ type: 'translation-batch-error', message: string }
{ type: 'settings', provider: string | null, hasKey: boolean }
```

### 8.4 Where translation runs

Inside `main.ts` (the sandbox). The sandbox owns network access; the UI iframe can't make external requests under Figma's plugin model. UI posts the request, sandbox fetches, sandbox posts results back.

### 8.5 Batching

Send translations in batches of 50 strings per API call where the provider supports it (DeepL and Google both do). For OpenAI we send strings as a JSON array in a single prompt with a round-trip schema. A 65-layer frame batched cleanly → one or two API calls.

### 8.6 Substitution into the existing preview pipeline

The existing `buildPreview` function in `src/count/format.ts` takes `PreviewRow[]` and builds the clipboard string. To support translated output, we add an optional `translatedText` field on each PreviewRow:

```ts
interface PreviewRow {
  item: TextBoxCount;
  rounding: RoundingMode;
  selected: boolean;
  translatedText?: string;  // when present, used instead of item.text
}
```

`buildPreview` uses `translatedText ?? item.text` for the visible string, and computes its character count via the existing `graphemeCount` helper. Rounding still applies to that count.

Net effect: translation flows through the same preview pipeline. No second code path for the formatting.

## 9. Provider tradeoffs

| Provider | Quality | Pricing | Languages | Notes |
|----------|---------|---------|-----------|-------|
| DeepL | Highest for de/es | Free tier 500k chars/month; paid from $7/mo | 31 languages including AR | Recommended default for v1. |
| Google Cloud Translation | Good. Marginally weaker than DeepL on idioms but broader coverage. | $20 per 1M chars after 500k free | 130+ | Best fit if we add more languages later. |
| OpenAI (gpt-4o-mini) | Variable but context-aware. Can be prompted with brand/style guidelines. | $0.15 / 1M input tokens; $0.60 / 1M output | All major languages | Upgrade path for tone/glossary features. |

**v1 recommendation:** DeepL as default. Google and OpenAI as alternate providers.

## 10. Edge cases

- **Mixed-content layers** (`"Welcome to NYC"`) — translate as one unit; don't try to detect partial English.
- **Numbers, dates, prices** — pass through unchanged. DeepL and Google handle this; OpenAI needs an explicit "preserve numbers and proper nouns" instruction in the prompt.
- **Emoji-only or punctuation-only layers** — skip the API call; preview shows original (no change).
- **Very long layers (>500 chars)** — still send. Warn if a layer exceeds 1000 chars (rare for UI copy).
- **Hidden text layers** — same rule as today: skipped by default.
- **Duplicate strings within the frame** — one API call per unique string per session (cache).
- **User changes selection mid-flight** — the in-flight request continues, but only rows that are still selected appear in the preview when it finishes.
- **User changes frame mid-flight** — the response for the old frame is discarded; preview resets to originals for the new frame.
- **API key rotation** — on Settings save, clear the in-memory cache so stale translations don't appear under the new key.

## 11. Performance

- A 65-layer frame batched in one DeepL call is ~1 second round-trip. The button-disabled state during the wait is fine UX.
- Cache hit rate is high: after the first Translate on a frame, Reset → Translate again is instant.

## 12. Privacy & security

- API key stored only in `figma.clientStorage`, never in the manifest, never committed.
- API calls go directly from the sandbox to the provider — Anthropic and Figma servers are not in the path.
- The README explicitly states which provider's TOS applies and links to each provider's data-handling docs.

## 13. Success metrics

- **Activation:** 30% of installs configure an API key within 7 days.
- **Engagement:** 40% of users who configure a key click Translate more than once a week.
- **Quality:** zero P0 Figma Community review flags about network behavior on submission.

## 14. Open questions

- **Q1** — Anthropic-hosted proxy so users don't need their own API key (Anthropic eats the bill)? Lower friction but recurring cost. Default: no for v1, revisit if installs > 5k.
- **Q2** — Per-row glossary overrides ("Sign up" → "Registrarse" not "Inscribirse")? Default: no for v1; collect feedback first.
- **Q3** — Allow the user to add a custom 4th language slot? Default: no for v1.
- **Q4** — Should we also show the translated total character delta in the Translated-state badge ("+18% vs original")? Cheap to add, useful signal. Default: yes if it doesn't bloat the badge.

## 15. Phasing

- **v1.0** — DeepL only, three languages, Translate button in Output card (this PRD).
- **v1.1** — Google + OpenAI provider options.
- **v1.2** — Reset → undo stack so the user can switch between translated and original output without re-translating.
- **v2.0** — In-place translation: button on each table row to swap the original Figma text with the translation. Behind a confirmation modal because it mutates the document.
- **v2.1** — Glossary / brand-term overrides. Persistent across frames.

## 16. Out of scope (v1)

- Auto-detection of source language (always assume English).
- Bidirectional translation.
- "Compare three languages side by side" view.
- Translation history / undo across sessions.
- Translated character counts shown in the Text Layers table (intentionally left there to keep the table as the source-of-truth originals view).
