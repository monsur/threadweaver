# Status

**Status:** Active <!-- Active | Paused | Blocked | Done -->
**Updated:** 2026-05-17

## Summary

A new page inside Threadweaver that lists Readwise-tagged articles, generates Bluesky thread drafts via Claude AI, and feeds them into Threadweaver's existing editor.

## Last Session

- Implemented highlights expand/collapse via bulk prefetch
  - `GET /api/readwise/highlights` — paginates v3 `category=highlight`, returns `{ [parent_id]: string[] }` map
  - Articles and highlights now fetch in parallel on page load; expand arrow shows spinner until highlights arrive
  - Replaced stale per-article v2 highlights approach (v3 UUIDs don't map to v2 book IDs)
  - 52 backend tests, 87 frontend tests, all passing

## Next

- Phase 4: Archive — `DELETE /api/readwise/articles/:id/tag`

## Implementation Phases

1. ✅ **Navigation refactor** — `Nav.svelte`, view state in `App.svelte`
2. ✅ **Readwise article list** — `GET /api/readwise/articles`, `GET /api/readwise/highlights` (bulk prefetch), `Readwise.svelte` with expand/collapse
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
