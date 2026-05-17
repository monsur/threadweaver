# Status

**Status:** Active <!-- Active | Paused | Blocked | Done -->
**Updated:** 2026-05-09

## Summary

A new page inside Threadweaver that lists Readwise-tagged articles, generates Bluesky thread drafts via Claude AI, and feeds them into Threadweaver's existing editor.

## Last Session

- Implemented Phase 3: AI draft generation
  - `backend/src/prompts/generate-thread.txt` — editable system prompt
  - `backend/src/lib/llm.js` — Anthropic API wrapper, reads model config from env
  - `POST /api/readwise/generate` — fetches article + highlights, calls LLM, removes tag, returns `{ title, content, notes }`
  - `Readwise.svelte` — Post button wired: full-page overlay, creates draft, opens editor on success, per-row error + retry on failure
  - 51 backend tests, 86 frontend tests, all passing

## Next

- Phase 4: Archive — `DELETE /api/readwise/articles/:id/tag`

## Implementation Phases

1. ✅ **Navigation refactor** — `Nav.svelte`, view state in `App.svelte`
2. ✅ **Readwise article list** — `GET /api/readwise/articles`, `GET /api/readwise/articles/:id/highlights`, `Readwise.svelte`
3. ✅ **AI draft generation** — `POST /api/readwise/generate`, `backend/src/lib/llm.js`
4. **Archive** — `DELETE /api/readwise/articles/:id/tag`

Full details in PLAN.md.

## Key Technical Decisions

**Architecture**
- Built inside the Threadweaver repo (not standalone)
- All new routes go in `backend/src/routes/readwise.js`, registered in `backend/src/index.js`
- New frontend components: `Nav.svelte`, `Readwise.svelte`
- Only existing file with significant changes: `App.svelte` (view state)
- No changes to `Editor.svelte` or `Sidebar.svelte`
- No database migrations needed

**Draft handoff (critical)**
- The backend `POST /api/readwise/generate` returns `{ title, content, notes }` — text only
- The frontend creates the draft by calling `createDraft()` from `stores/drafts.svelte.js`
- Then calls `setActive(id)` and `setView('editor')`
- This routes through the existing store machinery (IndexedDB + D1 sync) exactly like a manually created draft
- Do NOT have the backend create the draft in D1 directly — that bypasses the store

**Notes field**
- When generating a draft, populate the `notes` field with the source URL and all highlight text
- This gives the user reference material while editing in the Threadweaver editor

**Tag removal timing**
- Tag is removed from Readwise AFTER successful LLM generation, not before
- A failed generation leaves the article in the list (safe default)

**Readwise API**
- Article list: Readwise Reader API v3 — `GET /api/v3/list?category=article&tags=<TAG>&sort=-created_at`
- Highlights: Readwise API v2 — `GET /api/v2/highlights/?book_id=<id>`
- ⚠️ v3 document IDs are UUIDs; v2 book_id is numeric — verify this mapping during manual testing; fallback may be filtering by `source_url`
- Highlights are fetched on demand (on first expand), not on page load

**LLM**
- Default provider: Claude API (Anthropic)
- Abstracted behind `backend/src/lib/llm.js` — exports `generateThread(article, env)`
- `LLM_PROVIDER` env var selects provider; currently only `anthropic` implemented
- Prompt lives in `backend/src/prompts/generate-thread.txt`

**Environment variables** (in `wrangler.toml` / `.dev.vars`):
- `READWISE_API_KEY`
- `READWISE_TAG`
- `ANTHROPIC_API_KEY`
- `LLM_PROVIDER` (default: `anthropic`)
- `LLM_MODEL`, `LLM_MAX_TOKENS`, `LLM_TEMPERATURE`

## Readwise Page UI (Readwise.svelte)

```
[▶] Article Title                               [Archive] [Post]
```
```
[▼] Article Title                               [Archive] [Post]
     • Highlight one
     • Highlight two
```

- Sorted: most recently saved first
- Title: link to original article, opens in new window
- Expand arrow: loads highlights on demand (cached after first fetch)
- Archive: removes tag, removes row immediately, no confirmation
- Post: full-page loading indicator → generate → remove tag → open editor
- No highlights → expand shows empty state
