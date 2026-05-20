# PRD — Translate feature

**Plugin:** Copy character count
**Author:** Emilia
**Status:** Draft
**Last updated:** 2026-05-12

## 1. Summary

Add a Translate panel to the plugin that takes the same text layers we already extract from a selected frame and produces translations into German, Arabic, or Spanish. The translation runs through a hosted translation API, results live next to each row in the existing table, and the user can copy the translated set in the same plain / Markdown / `key: value` formats already supported.

The plugin stays read-only — it does not edit the Figma document. Translations are a paste-out, not an in-place rewrite.

## 2. Problem

Designers working on multi-locale products today have to:

1. Hand-copy each text layer one at a time out of Figma.
2. Paste each string into a separate translation tool.
3. Paste each translation into a spec sheet for the localization team.

This is a flow that costs an hour or two per screen and is bug-prone — strings get missed, character counts get miscounted (German is on average 30% longer than English; Arabic and Hebrew flip RTL), and the resulting handoff doc drifts out of sync with the design as it changes.

The current plugin already solves the "list all text layers with their character counts" half of this flow. Adding translation closes the loop.

## 3. Goals

- **G1** — From a selected frame, produce translations of every text layer into German (de), Arabic (ar), and Spanish (es) with a one-click target-language switch.
- **G2** — Show translated character counts alongside originals so designers can spot length problems (truncation risk in German, line-break risk in Arabic) before sending the design to localization.
- **G3** — Let the user copy the translated set in the existing output formats (plain list / Markdown bullets / `key: value`) plus a new "Original → Translation" two-column format.
- **G4** — Keep the plugin read-only. No in-place text mutation in v1.

## 4. Non-goals

- **NG1** — In-place translation of the Figma document (replacing the canvas text). Considered for v2.
- **NG2** — Translation quality review tooling (the plugin reports what the API returns; it doesn't flag awkward translations).
- **NG3** — More than the three languages above for v1. Adding more is mechanical but each adds review and testing surface.
- **NG4** — Translation memory / glossary management. Out of scope for v1; future work.
- **NG5** — Offline / on-device translation. Requires bundling a model; cost/size tradeoff not worth it for v1.

## 5. User stories

- **US1** — *Designer at a travel app:* I'm shipping a Benefits screen in EN, DE, AR, ES. I want to see all 65 text strings on screen with their translations and rounded character counts so I can flag the headlines that will overflow in German.
- **US2** — *Content designer:* I want to paste a Markdown list of `English → Spanish` strings into a Linear ticket so the localization team can review my proposed copy alongside the source.
- **US3** — *PM / reviewer:* I want a "key: value" output of `key → translated` to drop into a strings file for the engineers to wire up.

## 6. Functional requirements

### 6.1 Language switcher

A new control row at the top of the Text Layers card, between the existing "Set all rows to" row and the table.

- A select labeled **Translate to** with four options:
  - `Off` (default, current behavior — no translation columns)
  - `German (de)`
  - `Arabic (ar)`
  - `Spanish (es)`
- When the user picks a non-Off option, the plugin requests translations for every text layer in the current frame and re-renders the table with two extra columns (see 6.2).

### 6.2 Table columns

When translation is on, the table grows to:

| ☐ | Text (original) | Raw | Round | Translation | T. Raw | T. Round | Mode |

- **Translation** — translated string, truncates with ellipsis like the original Text column. Hovering reveals the full string.
- **T. Raw** — grapheme-cluster character count of the translation.
- **T. Round** — the translation's count after applying the row's existing rounding mode.

The original four columns keep their current behavior. Hovering a translated cell shows a tooltip with the full original + full translation so the designer can spot-check.

### 6.3 Output formats

Format dropdown gains a new option **"Original → Translation"**:

```
Welcome to Tripguide → Willkommen bei Tripguide  (20 → 22 chars)
Lounges → Lounges  (7 → 7 chars)
```

The three existing formats (plain, markdown, keyvalue) also render translations when translation is on:

- `plain`: `Welcome to Tripguide → Willkommen bei Tripguide: 22 chars`
- `markdown`: `- Welcome to Tripguide → Willkommen bei Tripguide: 22 chars`
- `keyvalue`: `Welcome to Tripguide: Willkommen bei Tripguide`

### 6.4 RTL handling (Arabic)

- Translated text in the table is rendered with `dir="auto"` so Arabic strings display right-to-left in the cell.
- Character counts use the same grapheme-cluster method we use today — combining marks count as one character.
- The clipboard output is plain text; the receiving app handles RTL rendering. No special escaping.

### 6.5 Caching

Translations are cached in plugin memory keyed by `(source_text + target_lang)`. Re-selecting the same frame or switching the rounding mode does not re-trigger an API call. Cache is cleared when the panel is closed.

### 6.6 Error states

- **No API key configured** → empty state in the Translate column saying "Set your translation key in Settings to enable translation."
- **API error (rate limit, network failure, invalid key)** → the affected row shows "—" in the Translation column with a tooltip describing the error. Other rows continue to render. A toast surfaces the underlying error message once.
- **Empty source string** → translation column shows "—".

## 7. UX

### 7.1 Settings entry

Add a small gear icon in the plugin header (top right of the frame title row) opening a Settings panel. Settings contain:

- **Translation provider** — select (DeepL, Google Cloud Translation, OpenAI) — see §9 for tradeoffs.
- **API key** — password-style input. Stored via `figma.clientStorage` (encrypted, per-plugin, per-user). Cleared with a "Reset" button.
- **About** — one line: "Translations run on your API key. The plugin sends each text layer to the provider's API. The provider does not retain the strings beyond what its TOS state."

The gear is hidden when no API key is set, replaced by a "Set up translation" link in the empty Translate column.

### 7.2 First-run flow

1. User picks a language from the Translate dropdown.
2. If no API key is configured, the plugin opens the Settings panel inline with a 2-line explainer and the API key input.
3. User pastes a key, picks a provider, clicks Save.
4. Translation begins; rows populate as each call returns.

### 7.3 Loading state

Each row's Translation cell shows a thin animated bar (a pulse, not a spinner) while waiting for that string's API response. The user can interact with rows that have already resolved.

## 8. Technical requirements

### 8.1 Manifest changes

`manifest.json` currently has:

```json
"networkAccess": { "allowedDomains": ["none"] }
```

Update to allow the chosen provider's API hostnames:

```json
"networkAccess": {
  "allowedDomains": [
    "https://api-free.deepl.com",
    "https://api.deepl.com",
    "https://translation.googleapis.com",
    "https://api.openai.com"
  ],
  "reasoning": "Plugin sends text layer strings to a user-configured translation provider on behalf of the user."
}
```

The Community review will scrutinize this change. The `reasoning` string is required by Figma and shown to users when they install.

### 8.2 New modules

```
src/translate/
  provider.ts        Provider-agnostic interface { translate(strings, target) → translations }
  deepl.ts           DeepL implementation
  google.ts          Google Cloud Translation implementation
  openai.ts          OpenAI implementation (gpt-4o-mini with explicit prompt)
  cache.ts           In-memory cache keyed by (text, lang, provider)
  settings.ts        Read/write API key via figma.clientStorage
```

### 8.3 New message types

```ts
// UI → main
{ type: 'translate', frameId: string, targetLang: 'de' | 'ar' | 'es' }
{ type: 'save-settings', provider: 'deepl' | 'google' | 'openai', apiKey: string }
{ type: 'load-settings' }

// Main → UI
{ type: 'translations', frameId: string, translations: { nodeId: string; translation: string }[] }
{ type: 'translation-error', nodeId: string, message: string }
{ type: 'settings', provider: string | null, hasKey: boolean }
```

### 8.4 Where translation runs

Inside `main.ts` (the sandbox). The sandbox owns network access; the UI iframe can't make external requests under Figma's plugin model. UI sends the request, sandbox fetches, sandbox posts results back.

### 8.5 Batching

Send translations in batches of 50 strings per API call where the provider supports it (DeepL and Google both do). For OpenAI we send strings in a single prompt with a JSON array round-trip. This keeps a 65-layer frame to one or two API calls.

## 9. Provider tradeoffs

| Provider | Quality | Pricing | Languages | Notes |
|----------|---------|---------|-----------|-------|
| DeepL | Highest for de/es (native quality often indistinguishable from human) | Free tier 500k chars/month; paid from $7/mo | 31 languages including AR | Recommended default. Free tier is plenty for personal use. |
| Google Cloud Translation | Good. Marginally weaker than DeepL on idioms but covers more languages. | $20 per 1M chars after first 500k free | 130+ | Best for breadth if we add more languages later. |
| OpenAI (gpt-4o-mini) | Variable but context-aware. Can be prompted with brand/style guidelines. | $0.15 per 1M input tokens, $0.60 per 1M output | All major languages | Future fit if/when we add tone/glossary features. |

**Recommendation for v1:** DeepL as the default. Google as the second option for users who need broader language coverage. OpenAI as a third option intended for users who want a tone/glossary upgrade path later.

## 10. Edge cases

- **Mixed text in a single layer** (e.g. `"Welcome to NYC"`) — translate as one unit; don't try to detect partial English.
- **Numbers, dates, prices** — pass through unchanged (DeepL and Google both handle this; OpenAI needs the prompt to specify "preserve numbers and proper nouns").
- **Emoji-only or punctuation-only layers** — skip the API call; show original as the translation.
- **Very long layers (>500 chars)** — still send, but warn in the UI if a single layer exceeds 1000 chars (rare for UI copy, common for legal text).
- **Hidden text layers** — same rule as today: skipped by default.
- **Duplicate strings within the frame** — only one API call per unique string per session (cache).
- **User switches frames while a translation is mid-flight** — discard the stale response (frameId mismatch).
- **API key rotation** — on Settings save, clear the in-memory cache so stale translations don't appear under the new key.

## 11. Performance

- A 65-layer frame batched into one DeepL call is ~1 second round-trip. Per-row pulse during the wait keeps it from feeling stuck.
- Cache hit rate is high in practice (designers tend to translate the same screen many times during iteration). After the first run on a frame, subsequent language switches that revisit cached pairs are near-instant.

## 12. Privacy & security

- API key stored only in `figma.clientStorage`, never in the manifest, never in any committed file.
- All API calls go directly from the sandbox to the provider — Anthropic/Figma servers are not in the path.
- The README will explicitly state which provider's TOS applies to the user's data and link to each provider's data handling docs.

## 13. Success metrics

If we publish a v2 with this feature, the success bar is:

- **Activation:** 30% of installs configure an API key within 7 days.
- **Retention:** 40% of users who configure an API key use the translate dropdown more than once a week.
- **Quality:** zero P0 Figma Community review flags about network behavior on submission.

## 14. Open questions

- **Q1** — Should we ship with a single Anthropic-hosted proxy so users don't need their own API key (Anthropic eats the bill)? Lower friction but recurring cost. Default answer: no for v1, revisit if installs > 5k.
- **Q2** — Do we need glossary support (force `"Sign up"` → `"Registrarse"` not `"Inscribirse"`)? Default answer: no for v1; collect feedback first.
- **Q3** — Should the user be able to add a 4th custom language slot? Default answer: no for v1; the three covered are the most-requested in design org surveys.
- **Q4** — Does the translation table need to fit in the 50/50 layout we have now, or do we expand the right column when translation is on? Probably we widen the right column to ~60% when translation is on, since two extra columns need ~150px more.

## 15. Phasing

- **v1.0 — DeepL only, three languages, copy-out** (this PRD).
- **v1.1** — Google + OpenAI provider options. Per-row "Copy translation only" action.
- **v2.0** — In-place translation: button to swap the original Figma text with the translation. Behind a confirmation modal because it mutates the document.
- **v2.1** — Glossary / brand-term overrides. Persistent across frames.

## 16. Out of scope (v1)

- Auto-detection of source language (always assume English for v1).
- Bidirectional translation (translate from a non-English source back to English).
- A "compare three languages side by side" view (would need a wider table).
- Translation history / undo across sessions.
