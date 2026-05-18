# Implementation Plan: Readwise → Bluesky Post Generator

All changes land in the **Threadweaver** repo.

---

## Scope

The Readwise page is a **text generator** that feeds into Threadweaver's existing editor. It:
- Shows articles saved under the configured Readwise tag
- Generates Bluesky post text on demand (via Claude API)
- Saves generated text as a Threadweaver draft and opens it in the editor
- Lets the user archive articles they've posted or no longer want to share (removes the tag in Readwise)

**Out of scope:** Bluesky publishing, AT Protocol integration, changes to `Editor.svelte`.

---

## API Reference

### Readwise Reader API (v3) — documents
- List: `GET https://readwise.io/api/v3/list?tag=<TAG>&sort=-created_at&pageCursor=<cursor>`
- Auth: `Authorization: Token <READWISE_API_KEY>`
- Pagination: cursor-based via `nextPageCursor` in response
- ⚠️ Does NOT include highlight text — highlights are separate documents with `category=highlight`

### Readwise Reader API (v3) — highlights
- List: `GET https://readwise.io/api/v3/list?category=highlight&pageCursor=<cursor>`
- Highlights are documents with `parent_id` set to the article's v3 UUID
- Highlight text is in the `content` field
- ⚠️ v2 `book_id` is numeric and does NOT map to v3 UUIDs — use v3 with `category=highlight` + `parent_id` filtering instead

### Readwise tag removal
- `PATCH https://readwise.io/api/v3/update/<id>/` with body `{ "tags": { "<TAG>": null } }`
- Removes the named tag from the document; other tags are unaffected

---

## Environment Variables

```toml
[vars]
READWISE_API_KEY = ""      # Readwise API token
READWISE_TAG = ""          # Tag that marks articles for sharing
ANTHROPIC_API_KEY = ""     # Claude API key
LLM_PROVIDER = "anthropic" # anthropic | cloudflare
LLM_MODEL = "claude-opus-4-7"
LLM_MAX_TOKENS = "1024"
LLM_TEMPERATURE = "0.7"

[[rules]]
type = "Text"
globs = ["**/*.txt"]       # allows importing .txt files as text modules in Workers
```

---

## Phase 1: Navigation Refactor ✅

**Goal:** Add a persistent top nav for switching between Editor and Readwise; editor stays the default.

### Checklist

- [x] **`App.svelte`**: add `let view = $state('editor')`
- [x] **`App.svelte`**: conditional rendering of `<Editor>` vs `<Readwise>`
- [x] **`App.svelte`**: render `<Nav>` inside the authenticated block
- [x] **Create `frontend/src/lib/Nav.svelte`** with Editor/Readwise links and active state

#### Tests — `frontend/src/lib/__tests__/Nav.test.js`
- [x] Renders "Editor" and "Readwise" links
- [x] Active class applied to link matching `currentView`
- [x] Clicking a link calls `setView` with the correct argument

---

## Phase 2: Readwise Article List ✅

**Goal:** Show a list of articles carrying the configured tag, with expand/collapse highlights.

> **Note:** Highlights implementation diverged from original plan. Instead of per-article
> `GET /api/readwise/articles/:id/highlights` using the v2 API, highlights are prefetched
> in bulk via `GET /api/readwise/highlights` using v3 `category=highlight` + `parent_id`
> filtering. This avoids rate limiting from per-expand API calls and the v2/v3 ID mismatch.

### Checklist

#### Backend

- [x] **Create `backend/src/routes/readwise.js`** with `handleReadwise(request, env)`
- [x] **`GET /api/readwise/articles`** — fetches all pages from Readwise v3, returns `{ articles: [{ id, title, author, url }] }`
- [x] **`GET /api/readwise/highlights`** — fetches all v3 highlights (`category=highlight`), returns `{ highlights: { [parent_id]: string[] } }`
- [x] **`backend/src/index.js`** — routes `/api/readwise` to `handleReadwise`

#### Backend Tests
- [x] `GET /api/readwise/articles`: 401, success, pagination, 502
- [x] `GET /api/readwise/highlights`: 401, empty, grouped by parent_id, pagination, 502

#### Frontend

- [x] **`frontend/src/lib/Readwise.svelte`** — articles and highlights fetch in parallel on mount
- [x] Article list: loading / empty / error states, retry button
- [x] Each row: expand arrow, title link (`target="_blank"`), Archive button, Post button
- [x] Expand/collapse: spinner while highlights prefetch is in flight, highlights from in-memory map on resolve, "No highlights" for articles with none

#### Frontend Tests
- [x] Loading, empty, error, retry states
- [x] Article rendering (title, link, buttons)
- [x] Spinner shown when expanded before highlights arrive
- [x] Highlights shown once prefetch resolves
- [x] "No highlights" for articles with empty highlight list
- [x] Highlights not re-fetched on subsequent expands

---

## Phase 3: AI Draft Generation ✅

**Goal:** Post button generates a Bluesky thread, removes the tag, saves a draft, and opens the editor.

### Checklist

#### Backend
- [x] **`backend/src/prompts/generate-thread.txt`** — editable system prompt
- [x] **`backend/src/lib/llm.js`** — `generateThread(article, env)`, Anthropic implementation, reads model config from env
- [x] **`POST /api/readwise/generate`**:
  - Fetches article from v3, highlights from v2 (best-effort)
  - Calls `generateThread`
  - On LLM success: removes tag via PATCH, returns `{ title, content, notes }`
  - On LLM failure: returns 500, tag preserved
  - On tag removal failure: returns content with `warning` flag

#### Backend Tests
- [x] `llm.js`: model/temp/tokens from env, prompt content, user message with/without highlights, returns text
- [x] `POST /api/readwise/generate`: 401, success + PATCH called, notes format, LLM failure preserves tag, tag removal failure still returns content

#### Frontend
- [x] Post button: full-page overlay, disables buttons
- [x] On success: `createDraft` → `setActive` → `setView('editor')`, removes article from list
- [x] On error: hides overlay, re-enables buttons, inline error + retry

---

## Phase 4: Archive

**Goal:** Remove an article from the list without generating a post.

### Checklist

#### Backend

- [ ] **`DELETE /api/readwise/articles/:id/tag`** (add to `readwise.js`):
  - Verify session
  - Call Readwise v3 PATCH to remove the configured tag
  - Return `{ ok: true }` on success
  - Return 502 on Readwise API failure

#### Backend Tests — `backend/src/__tests__/readwise.test.js`

- [ ] Returns 401 with no session cookie
- [ ] Calls Readwise v3 PATCH with the correct tag removal payload
- [ ] Returns `{ ok: true }` on success
- [ ] Returns 502 when Readwise API fails

#### Frontend (`Readwise.svelte`)

- [ ] Archive button click:
  - Optimistically remove the article row from local state immediately
  - Call `DELETE /api/readwise/articles/:id/tag` in the background
  - On API failure: re-add the article row, show inline error

#### Frontend Tests — `frontend/src/lib/__tests__/Readwise.test.js`

- [ ] Archive button removes article row from UI immediately
- [ ] On API failure: row is restored and inline error is shown

### Verification
- [ ] Article disappears immediately on Archive click
- [ ] Article is gone from Readwise after page reload (tag removed in Readwise)
- [ ] API failure restores the row and shows error

---

## File Change Summary

| File | Change |
|------|--------|
| `frontend/src/App.svelte` | Added `view` state, conditional rendering, `<Nav>` |
| `frontend/src/lib/Nav.svelte` | New — persistent top nav with Editor/Readwise links |
| `frontend/src/lib/Readwise.svelte` | New — article list, expand/collapse, post/generate, archive stub |
| `backend/src/index.js` | Registered `/api/readwise` routes |
| `backend/src/routes/readwise.js` | New — articles, highlights (bulk prefetch), generate, archive (pending) |
| `backend/src/lib/llm.js` | New — LLM abstraction, reads model config from env |
| `backend/src/prompts/generate-thread.txt` | New — system prompt |
| `frontend/src/lib/stores/drafts.svelte.js` | Not modified — `createDraft` and `setActive` reused as-is |
| `wrangler.toml` | Added env vars + `[[rules]]` for `.txt` imports |
