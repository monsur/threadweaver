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
- List: `GET https://readwise.io/api/v3/list?category=article&tags=<TAG>&sort=-created_at&pageCursor=<cursor>`
- Auth: `Authorization: Token <READWISE_API_KEY>`
- Pagination: cursor-based via `nextPageCursor` in response
- ⚠️ Does NOT include highlight text — highlights require a separate v2 call

### Readwise API (v2) — highlights
- List: `GET https://readwise.io/api/v2/highlights/?book_id=<id>&page_size=100`
- Auth: `Authorization: Token <READWISE_API_KEY>`
- ⚠️ `book_id` is a v2 concept — verify that v3 document IDs map to v2 `book_id` during implementation; fallback may be filtering by `source_url`

### Readwise tag removal
- `PATCH https://readwise.io/api/v3/update/<id>/` with body `{ "tags": { "<TAG>": null } }`
- Removes the named tag from the document; other tags are unaffected
- ⚠️ Confirm exact payload format against API docs during implementation

---

## Environment Variables

Add to `wrangler.toml` before starting:

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

## Phase 1: Navigation Refactor

**Goal:** Add a persistent top nav for switching between Editor and Readwise; editor stays the default.

### Checklist

- [ ] **`App.svelte`**: add `let view = $state('editor')` — type: `'editor' | 'readwise'`
- [ ] **`App.svelte`**: replace direct `<Editor>` render with conditional:
  ```svelte
  {#if view === 'editor'}
    <Editor ... />
  {:else if view === 'readwise'}
    <Readwise setView={(v) => view = v} />
  {/if}
  ```
- [ ] **`App.svelte`**: render `<Nav currentView={view} setView={(v) => view = v} />` above the conditional, inside the authenticated block only
- [ ] **Create `frontend/src/lib/Nav.svelte`**:
  - Props: `currentView: string`, `setView: (view: string) => void`
  - Render two links: "Editor" and "Readwise"
  - Apply an active style to the link matching `currentView`
  - Each link calls `setView('editor')` or `setView('readwise')` on click

#### Tests — `frontend/src/lib/__tests__/Nav.test.js`
- [ ] Renders "Editor" and "Readwise" links
- [ ] Active class applied to link matching `currentView`; other link does not have active class
- [ ] Clicking a link calls `setView` with the correct argument

### Verification
- [ ] App still defaults to editor on login
- [ ] Clicking "Readwise" in nav switches view; clicking "Editor" switches back
- [ ] Active link is visually distinct

---

## Phase 2: Readwise Article List

**Goal:** Show a paginated list of articles carrying the configured tag.

### Checklist

#### Backend

- [ ] **Create `backend/src/routes/readwise.js`** with a `handleReadwise(request, env)` router function
- [ ] **`GET /api/readwise/articles`**:
  - Verify session via `getSession()` (same as existing routes)
  - Fetch from Readwise v3: `GET /api/v3/list?category=article&tags=${env.READWISE_TAG}&sort=-created_at`
  - Handle cursor-based pagination — fetch all pages before returning (or accept a `?cursor=` query param and paginate lazily; decide during implementation)
  - Return: `{ articles: [{ id, title, author, url }] }`
  - Return 401 if session invalid, 502 if Readwise API fails
- [ ] **`GET /api/readwise/articles/:id/highlights`**:
  - Verify session
  - ⚠️ First verify v3 ID → v2 `book_id` mapping; adjust if needed
  - Fetch from Readwise v2: `GET /api/v2/highlights/?book_id=${id}&page_size=100`
  - Return: `{ highlights: string[] }` — array of highlight text only
  - Return empty array `{ highlights: [] }` if none found (not an error)
- [ ] **`backend/src/index.js`**: import and register new routes, e.g.:
  ```js
  import { handleReadwise } from './routes/readwise.js'
  // inside the fetch handler, before the 404 fallback:
  if (pathname.startsWith('/api/readwise')) return handleReadwise(request, env)
  ```

#### Backend Tests — `backend/src/__tests__/readwise.test.js`

Follow the existing pattern: use `worker.fetch()` + `req()` helper; stub global `fetch` with `vi.stubGlobal('fetch', ...)` to mock Readwise API calls.

**`GET /api/readwise/articles`**
- [ ] Returns 401 with no session cookie
- [ ] Returns mocked article list on success (stub Readwise v3 API response)
- [ ] Returns 502 when Readwise API fetch fails

**`GET /api/readwise/articles/:id/highlights`**
- [ ] Returns 401 with no session cookie
- [ ] Returns `{ highlights: [] }` when Readwise v2 returns no results
- [ ] Returns array of highlight text strings on success

#### Frontend

- [ ] **Create `frontend/src/lib/Readwise.svelte`**:
  - Props: `setView: (view: string) => void`
  - On mount: fetch `/api/readwise/articles`
  - Loading state: spinner or skeleton while fetching
  - Empty state: message if no articles returned
  - Error state: message + retry button if fetch fails
- [ ] **Article list rendering**:
  - Each row: `[▶] Title  [Archive] [Post]`
  - Title is an `<a href={url} target="_blank">` link
  - Archive and Post buttons always visible (collapsed and expanded)
- [ ] **Expand/collapse**:
  - Arrow toggles a local `expanded` boolean per article
  - On first expand: fetch `/api/readwise/articles/:id/highlights`
  - Cache highlights in local component state (don't re-fetch on subsequent expands)
  - Show highlight list, or "No highlights" if empty array returned
  - Show inline loading indicator while highlights are fetching

#### Frontend Tests — `frontend/src/lib/__tests__/Readwise.test.js`

Use `vi.stubGlobal('fetch', ...)` to mock API calls. Use `fake-indexeddb` if drafts store is exercised.

- [ ] Shows loading state while `/api/readwise/articles` is in flight
- [ ] Shows empty state when API returns an empty articles array
- [ ] Shows error state + retry button when API call fails
- [ ] Renders article title, Archive button, and Post button for each article
- [ ] Article title renders as a link with `target="_blank"`
- [ ] Clicking expand arrow fetches highlights and displays them
- [ ] Highlights are not re-fetched on subsequent expands (fetch called only once)
- [ ] Shows "No highlights" (or empty state) when highlights array is empty

### Verification
- [ ] Article list loads and displays titles
- [ ] Title links open in a new window
- [ ] Expand arrow shows/hides highlights
- [ ] Highlights load on demand (network tab shows request only on first expand)
- [ ] No highlights → empty state shown, no error
- [ ] API failure → error state with retry shown

---

## Phase 3: AI Draft Generation

**Goal:** Post button generates a Bluesky thread, removes the tag, saves a draft, and opens the editor.

### Checklist

#### `backend/src/prompts/generate-thread.txt` (new file)

- [ ] Create the system prompt as a plain text file:
  ```
  You generate threaded Bluesky posts from article metadata and highlights.
  Output format: posts separated by triple newlines (\n\n\n).
  Rules:
  - Each post must convey exactly one distinct idea
  - Each post must be ≤300 characters
  - Variable number of posts — use as many as the content warrants
  - A single "quote + link" post is a valid and often ideal output
  - Do not pad with filler posts
  - Do not include hashtags unless they add genuine value
  ```
- [ ] Edit freely without touching any code — changes take effect on next deploy

#### `backend/src/lib/llm.js` (new file)

- [ ] Import prompt at the top: `import systemPrompt from '../prompts/generate-thread.txt'`
- [ ] Export `generateThread(article, env)` where `article` is `{ title, url, author, highlights: string[] }`
- [ ] Read model config from `env`: `LLM_PROVIDER`, `LLM_MODEL`, `LLM_MAX_TOKENS`, `LLM_TEMPERATURE`
- [ ] **Anthropic implementation**:
  - Model: `env.LLM_MODEL`
  - Max tokens: `parseInt(env.LLM_MAX_TOKENS)`
  - Temperature: `parseFloat(env.LLM_TEMPERATURE)`
  - System prompt: `systemPrompt` (imported from text file)
  - User message: article title, author, URL, and numbered list of highlights (omit highlights section if none)
  - Return the raw text response (the thread content)
- [ ] Export the function; the route imports and calls it passing `env`

#### Tests — `backend/src/__tests__/llm.test.js`

Stub global `fetch` to mock the Anthropic API.

- [ ] Calls Anthropic API with model, max tokens, and temperature from `env`
- [ ] System prompt sent to Anthropic matches the contents of `generate-thread.txt`
- [ ] User message includes article title, author, URL, and highlight list when highlights are present
- [ ] User message omits the highlights section when highlights array is empty
- [ ] Returns the raw text content from the API response

#### Backend route

- [ ] **`POST /api/readwise/generate`** (add to `readwise.js`):
  - Verify session
  - Parse `{ article_id }` from request body
  - Fetch article details from Readwise v3: `GET /api/v3/list?id=${article_id}` (or detail endpoint if available)
  - Fetch highlights from Readwise v2 (same as highlights route above)
  - Call `generateThread({ title, url, author, highlights })`
  - **On LLM success**: call Readwise v3 PATCH to remove the tag (see API Reference above)
  - **On LLM failure**: return 500 — do NOT remove the tag; article stays in the list
  - **On tag removal failure**: still return the generated content with a warning flag (content was generated successfully)
  - Return: `{ title, content, notes }` where:
    - `title` = article title (used as the Threadweaver draft title)
    - `content` = LLM-generated thread text (triple-newline separated posts)
    - `notes` = formatted string: `Source: <url>\n\nHighlights:\n- highlight 1\n- highlight 2...`

#### Backend Tests — `backend/src/__tests__/readwise.test.js` (continued)

**`POST /api/readwise/generate`**
- [ ] Returns 401 with no session cookie
- [ ] On LLM success: calls Readwise PATCH to remove the tag and returns `{ title, content, notes }`
- [ ] `notes` contains the source URL and formatted highlight list
- [ ] On LLM failure: returns 500 and does NOT call Readwise PATCH (tag preserved)
- [ ] On tag removal failure: still returns generated `{ title, content, notes }` (content not lost)

#### Frontend (`Readwise.svelte`)

- [ ] Post button click:
  - Disable Archive and Post buttons on the clicked row
  - Show full-page loading overlay ("Generating...")
  - Call `POST /api/readwise/generate` with `{ article_id }`
- [ ] On success:
  - Call `createDraft({ title, content, notes })` from `stores/drafts.svelte.js`
  - Call `setActive(draft.id)` from the same store
  - Call `setView('editor')`
  - Remove the article from local list state (tag was removed server-side)
- [ ] On error:
  - Hide loading overlay
  - Re-enable buttons
  - Show inline error message on the article row with a retry option

#### Frontend Tests — `frontend/src/lib/__tests__/Readwise.test.js` (continued)

- [ ] Post button click shows full-page loading overlay and disables buttons
- [ ] On success: calls `createDraft` with `{ title, content, notes }`, calls `setActive`, calls `setView('editor')`, removes article from list
- [ ] On error: hides overlay, re-enables buttons, shows error message on the row

### Verification
- [ ] Post button shows full-page loading indicator
- [ ] After generation, editor opens with draft pre-populated
- [ ] Draft title = article title
- [ ] Draft content = generated thread, splits correctly into chunks in editor
- [ ] Draft notes = source URL + highlights
- [ ] Article is gone from Readwise list after success
- [ ] On LLM failure: article stays in list, error shown, retry works
- [ ] Generated draft appears in Threadweaver sidebar

---

## Phase 4: Archive

**Goal:** Remove an article from the list without generating a post.

### Checklist

#### Backend

- [ ] **`DELETE /api/readwise/articles/:id/tag`** (add to `readwise.js`):
  - Verify session
  - Call Readwise v3 PATCH to remove the configured tag (same call as Phase 3)
  - Return `{ ok: true }` on success
  - Return 502 on Readwise API failure

#### Backend Tests — `backend/src/__tests__/readwise.test.js` (continued)

**`DELETE /api/readwise/articles/:id/tag`**
- [ ] Returns 401 with no session cookie
- [ ] Calls Readwise v3 PATCH with the correct tag removal payload
- [ ] Returns `{ ok: true }` on success
- [ ] Returns 502 when Readwise API fails

#### Frontend (`Readwise.svelte`)

- [ ] Archive button click:
  - Optimistically remove the article row from local state immediately
  - Call `DELETE /api/readwise/articles/:id/tag` in the background
  - On API failure: re-add the article row, show inline error

#### Frontend Tests — `frontend/src/lib/__tests__/Readwise.test.js` (continued)

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
| `frontend/src/App.svelte` | Add `view` state (default: `'editor'`), conditional rendering, render `<Nav>` when logged in |
| `frontend/src/lib/Nav.svelte` | New — persistent top nav with Editor/Readwise links, active state |
| `frontend/src/lib/Readwise.svelte` | New — article list, expand/collapse, archive, post/generate |
| `backend/src/index.js` | Register `/api/readwise` routes |
| `backend/src/routes/readwise.js` | New — articles, highlights, generate, archive |
| `backend/src/lib/llm.js` | New — LLM provider abstraction, reads model config from env |
| `backend/src/prompts/generate-thread.txt` | New — system prompt, edit directly to tune output |
| `frontend/src/lib/stores/drafts.svelte.js` | Not modified — `createDraft` and `setActive` reused as-is |
| `wrangler.toml` | Add seven env vars + `[[rules]]` block for `.txt` imports |

No database migrations required. No changes to `Editor.svelte` or `Sidebar.svelte`.

Drafts created from the Readwise page flow through the existing store machinery (`createDraft` → IndexedDB → D1 sync) and appear in the sidebar automatically.
