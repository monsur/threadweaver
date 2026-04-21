# Threadweaver Implementation Plan

Granular step-by-step plan for upgrading Threadweaver per the PRD. Each step includes what to build, what tests to write, and how to verify before moving on.

**Rule:** Don't move to the next step until tests pass and the feature works manually in the browser.

---

## Phase 1: Project Scaffolding

### Step 1.1 — Initialize the Svelte + Vite frontend

Create a new Svelte project using Vite's scaffolding tool.

```
npm create vite@latest frontend -- --template svelte
cd frontend && npm install
```

**Files created:**
- `frontend/src/App.svelte`
- `frontend/src/main.js`
- `frontend/vite.config.js`
- `frontend/package.json`

**Verify:** `npm run dev` inside `frontend/` serves a working Svelte app at `localhost:5173`.

---

### Step 1.2 — Initialize the Cloudflare Workers backend

Create a Workers project using Wrangler.

```
npm create cloudflare@latest backend -- --type hello-world
cd backend && npm install
```

**Files created:**
- `backend/src/index.js`
- `backend/wrangler.toml`
- `backend/package.json`

**Verify:** `npx wrangler dev` inside `backend/` serves a Worker at `localhost:8787` returning a response.

---

### Step 1.3 — Create the D1 database

Create a local D1 database for development.

```
npx wrangler d1 create threadweaver-db
```

Add the D1 binding to `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "threadweaver-db"
database_id = "<id from above>"
```

**Verify:** `npx wrangler d1 execute threadweaver-db --local --command "SELECT 1"` returns a result.

---

### Step 1.4 — Set up Vitest for unit tests

Install Vitest in the frontend project (it will also test shared logic modules).

```
cd frontend && npm install -D vitest @vitest/ui
```

Add to `vite.config.js`:
```js
test: { environment: 'jsdom' }
```

Add to `frontend/package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Write a smoke test at `frontend/src/lib/__tests__/smoke.test.js`:
```js
import { expect, test } from 'vitest'
test('vitest works', () => expect(1 + 1).toBe(2))
```

**Verify:** `npm test` passes.

---

### Step 1.5 — Set up Playwright for E2E tests

Install Playwright in the root of the repo.

```
npm init playwright@latest
```

Configure `playwright.config.js` to point at `localhost:5173` (frontend dev server).

Write a smoke test at `tests/smoke.spec.js`:
```js
test('app loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Threadweaver/)
})
```

**Verify:** `npx playwright test` passes (after frontend dev server is running).

---

### Step 1.6 — Unified dev script

Add a root-level `package.json` with a `dev` script that starts both Vite and Wrangler concurrently.

```
npm install -D concurrently
```

```json
"dev": "concurrently \"npm run dev --prefix frontend\" \"npx wrangler dev --config backend/wrangler.toml\""
```

**Verify:** `npm run dev` from the repo root starts both servers.

---

## Phase 2: Port Core Editor Logic

### Step 2.1 — Extract character counting to a module

Port the character counting algorithm from `index.html` into a standalone module at `frontend/src/lib/charCount.js`. The function takes a string and returns the Bluesky character count (URLs = 20, mentions = 15).

**Tests** (`frontend/src/lib/__tests__/charCount.test.js`):
- Plain text counts each character
- A URL `https://example.com` counts as 20 regardless of length
- A mention `@user.bsky.social` counts as 15 regardless of length
- Mixed text with URL and mention counts correctly
- Empty string returns 0
- String at exactly 300 returns 300
- String over 300 returns the correct overage count

**Verify:** `npm test` passes all character count cases.

---

### Step 2.2 — Extract chunk splitting to a module

Port the chunk splitting logic into `frontend/src/lib/chunks.js`. The function takes the full editor text and returns an array of chunk strings, split on `\n\n\n`.

**Tests** (`frontend/src/lib/__tests__/chunks.test.js`):
- Single chunk (no triple newlines) returns an array of one
- Two chunks separated by `\n\n\n` returns an array of two
- Leading/trailing whitespace within a chunk is preserved
- Empty string returns an array with one empty string
- Multiple consecutive separators are handled gracefully

**Verify:** `npm test` passes all chunk splitting cases.

---

### Step 2.3 — Build the Editor Svelte component

Create `frontend/src/lib/Editor.svelte` that replicates the full current `index.html` behavior using the extracted modules from Steps 2.1 and 2.2:

- Textarea with transparent text over a visual render layer
- Visual layer renders chunk prefixes (1/, 2/, 3/…), character counts, and red overage highlighting
- Scroll synchronization between textarea and visual layer
- Auto-resizing height
- Click chunk prefix to copy individual post (with checkmark animation)
- "Copy All" button
- "Clear" button
- Character counter (`X/300`) for the current chunk
- "Chunk X of Y" indicator

For now, load/save from `localStorage` (same as today) — cloud sync comes later.

**Verify manually:** Open the app, type a long post, verify chunking, character counting, copy, and clear all work identically to the current `index.html`.

---

### Step 2.4 — Replace index.html with the Svelte app

Update `frontend/src/App.svelte` to render the `Editor` component. Confirm the app title is "Threadweaver" (for the Playwright smoke test).

**Verify:** Playwright smoke test passes. Manual check confirms full editor parity with current app.

---

## Phase 3: Auth

### Step 3.1 — Write the D1 drafts schema migration

Create `backend/migrations/0001_create_drafts.sql`:

```sql
CREATE TABLE drafts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

Apply locally:
```
npx wrangler d1 migrations apply threadweaver-db --local
```

**Verify:** `npx wrangler d1 execute threadweaver-db --local --command "SELECT * FROM drafts"` returns an empty result set without error.

---

### Step 3.2 — Implement cookie signing utilities

Create `backend/src/lib/auth.js` with two functions:
- `signCookie(password)` — derives a signing secret from a SHA-256 hash of `APP_PASSWORD`, creates a signed cookie value with an expiry timestamp
- `verifyCookie(cookieValue, password)` — verifies the signature and expiry, returns `true` or `false`

Use the Web Crypto API (available in Workers runtime — no Node.js `crypto` needed).

**Tests** (`backend/src/lib/__tests__/auth.test.js`) — run with Vitest:
- A cookie signed with password "abc" verifies correctly with "abc"
- A cookie signed with password "abc" fails verification with "xyz"
- A cookie with a past expiry fails verification
- A tampered cookie value fails verification

**Verify:** `npm test` in `backend/` passes all auth cases.

---

### Step 3.3 — Implement `POST /api/login`

In `backend/src/index.js`, add a route handler for `POST /api/login`:
- Read `APP_PASSWORD` from environment
- Compare submitted password (constant-time comparison to prevent timing attacks)
- On match: set a signed `session` cookie (HttpOnly, SameSite=Strict), return 200
- On mismatch: return 401

**Integration test** (`backend/src/__tests__/login.test.js`) using Wrangler's `unstable_dev`:
- Correct password returns 200 and sets a `Set-Cookie` header
- Wrong password returns 401 and sets no cookie
- Missing password body returns 400

**Verify:** `npm test` passes. Manual test: `curl -X POST localhost:8787/api/login -d '{"password":"test"}'` returns 200.

---

### Step 3.4 — Implement auth middleware

Add a `requireAuth` middleware function in `backend/src/lib/auth.js` that:
- Reads the `session` cookie from the request
- Calls `verifyCookie` against `APP_PASSWORD`
- Returns a 401 response if invalid
- Calls through to the next handler if valid

Apply this middleware to all `/api/*` routes except `/api/login`.

**Integration test:** A request to `GET /api/drafts` without a valid cookie returns 401.

**Verify:** `npm test` passes.

---

### Step 3.5 — Build the Login UI

Create `frontend/src/lib/Login.svelte`:
- Single password input + submit button
- On submit: `POST /api/login` with the password
- On success: hide the login screen and show the main app
- On failure: show an "incorrect password" message
- Input should have `type="password"` and support Enter key submission

Update `App.svelte` to show `Login` or `Editor` based on auth state (check for a valid session cookie on load by calling a `GET /api/me` endpoint that returns 200 if authenticated, 401 if not).

**Verify manually:** Load the app, enter wrong password (error shown), enter correct password (editor shown). Reload — editor shown without re-prompting (cookie persists).

---

## Phase 4: Draft CRUD API

### Step 4.1 — `GET /api/drafts`

Returns all drafts as a JSON array, sorted by `updated_at` descending.

```json
[{ "id": "…", "title": "…", "content": "…", "notes": "…", "created_at": 0, "updated_at": 0 }]
```

**Tests:**
- Returns 200 with an empty array when no drafts exist
- Returns 200 with drafts sorted by `updated_at` descending
- Returns 401 without a valid session cookie

---

### Step 4.2 — `POST /api/drafts`

Creates a new draft. Accepts a JSON body with optional `title`, `content`, `notes`. Generates a UUID for the `id`. Sets `created_at` and `updated_at` to `Date.now()`. Returns the created draft as JSON with a 201 status.

**Tests:**
- Creates a draft with provided fields, returns 201 with full draft object
- Creates a draft with no body, returns 201 with default values
- Returns 401 without a valid session cookie

---

### Step 4.3 — `GET /api/drafts/:id`

Returns a single draft by ID. Returns 404 if not found.

**Tests:**
- Returns 200 with the correct draft
- Returns 404 for an unknown ID
- Returns 401 without a valid session cookie

---

### Step 4.4 — `PUT /api/drafts/:id`

Updates an existing draft. Accepts a JSON body with any combination of `title`, `content`, `notes`. Updates `updated_at` to `Date.now()`. Returns the updated draft.

**Tests:**
- Updates `content` only, other fields unchanged, `updated_at` bumped
- Updates all fields at once
- Returns 404 for an unknown ID
- Returns 401 without a valid session cookie

---

### Step 4.5 — `DELETE /api/drafts/:id`

Deletes a draft by ID. Returns 204 on success, 404 if not found.

**Tests:**
- Deletes the draft, subsequent GET returns 404
- Returns 404 for an unknown ID
- Returns 401 without a valid session cookie

**Verify all API tests:** `npm test` in `backend/` passes.

---

## Phase 5: Draft Management UI

### Step 5.1 — Draft store

Create `frontend/src/lib/stores/drafts.js` — a Svelte writable store that holds the full list of drafts in memory. Expose functions:
- `loadDrafts()` — fetches from `GET /api/drafts` and populates the store
- `createDraft()` — calls `POST /api/drafts`, adds to store
- `updateDraft(id, fields)` — calls `PUT /api/drafts/:id`, updates store
- `deleteDraft(id)` — calls `DELETE /api/drafts/:id`, removes from store

**Tests** (`frontend/src/lib/__tests__/drafts.test.js`) — mock fetch, verify store state after each operation.

---

### Step 5.2 — Hamburger menu + sidebar shell

Create `frontend/src/lib/Sidebar.svelte`:
- A hamburger button fixed to the top-right of the screen
- Clicking toggles a sidebar panel sliding in from the right
- Sidebar overlays the editor (does not push it)
- Clicking outside the sidebar closes it
- Keyboard: `Escape` closes it

**Verify manually:** Hamburger opens/closes sidebar smoothly.

---

### Step 5.3 — Draft list

Inside the sidebar, render the list of drafts from the store (sorted by `updated_at`, most recent first). Each list item shows the draft title and last-modified date. Clicking a draft item:
- Loads that draft into the editor
- Closes the sidebar

**Verify manually:** Create two drafts via the API directly, open the sidebar, see both listed in order, click one to load it.

---

### Step 5.4 — Search

At the top of the sidebar, add a text input. As the user types, filter the displayed draft list client-side. Match against `title`, `content`, and `notes` fields (case-insensitive substring match).

**Tests** (`frontend/src/lib/__tests__/draftSearch.test.js`):
- Empty query returns all drafts
- Query matching title returns correct drafts
- Query matching content returns correct drafts
- Query matching notes returns correct drafts
- Query matching nothing returns empty list
- Search is case-insensitive

**Verify:** `npm test` passes. Manual check: type in search box, list filters in real time.

---

### Step 5.5 — Create draft

Add a "New draft" button at the top of the sidebar. Clicking it:
- Calls `createDraft()` from the store
- Switches the editor to the new (empty) draft
- Closes the sidebar

**Verify manually:** Click "New draft," a blank editor appears, the draft appears in the sidebar list.

---

### Step 5.6 — Rename draft

Clicking the draft title in the editor makes it editable inline (a plain text input replacing the title display). On blur or Enter, calls `updateDraft(id, { title })`.

**Verify manually:** Click title, type a new name, press Enter, reopen sidebar — new name appears.

---

### Step 5.7 — Delete draft with undo

Add a delete button (trash icon) on each draft list item. On click:
- Remove draft from the local store immediately (optimistic)
- Show a toast: "Draft deleted. Undo" with a 30-second countdown
- If Undo is clicked within 30 seconds: restore the draft to the store and skip the API call
- If the timer expires without Undo: call `DELETE /api/drafts/:id`
- If the deleted draft was the active one: switch to the next most-recent draft (or create a blank one if none remain)

**Tests** (`frontend/src/lib/__tests__/deleteUndo.test.js`):
- Undo within window restores draft, no DELETE call made
- Undo after window has expired is not possible
- DELETE is called exactly once after the window expires

**Verify manually:** Delete a draft, click Undo — it returns. Delete again, wait 30 seconds — it's gone.

---

## Phase 6: Notes Panel

### Step 6.1 — Add notes to editor layout

Update the editor layout in `Editor.svelte` to show a notes panel alongside the thread editor. The panel contains a plain text `<textarea>` labelled "Notes." It sits to the right of (or below, depending on screen width) the main editor.

The panel has a collapse/expand toggle. When collapsed, only the toggle button is visible.

**Verify manually:** Notes panel visible, collapsible, does not interfere with the editor.

---

### Step 6.2 — Wire notes to draft store

When the active draft changes, populate the notes textarea with `draft.notes`. On each keystroke in the notes textarea, debounce (500ms) and call `updateDraft(id, { notes })`.

**Verify manually:** Type in notes, reload the page — notes persist. Switch drafts — notes update correctly.

---

## Phase 7: IndexedDB + Offline Support

### Step 7.1 — IndexedDB service

Create `frontend/src/lib/db.js` — a thin wrapper around IndexedDB with functions mirroring the API:
- `getAll()` — returns all drafts
- `get(id)` — returns one draft
- `put(draft)` — upserts a draft
- `remove(id)` — deletes a draft
- `getUpdatedAfter(timestamp)` — returns drafts modified after a given timestamp (used for sync)

**Tests** (`frontend/src/lib/__tests__/db.test.js`) using `fake-indexeddb`:
- `put` then `get` returns the same draft
- `put` twice updates the record
- `remove` then `get` returns undefined
- `getAll` returns all stored drafts
- `getUpdatedAfter` returns only drafts modified after the given timestamp

**Verify:** `npm test` passes.

---

### Step 7.2 — Write-through caching

Update the draft store functions (Step 5.1) so every operation writes to IndexedDB first, then to the API:
- `loadDrafts()` — reads from IndexedDB immediately (fast), then fetches from API and merges (last write wins by `updated_at`)
- `createDraft()` — writes to IndexedDB, then API
- `updateDraft()` — writes to IndexedDB, then API
- `deleteDraft()` — removes from IndexedDB, then API

This ensures the UI is always fast (reads from local cache) and changes are durable even if the API call fails.

**Tests:** Mock the API to fail; verify IndexedDB still has the correct state after each operation.

---

### Step 7.3 — Online/offline detection

Create `frontend/src/lib/stores/network.js` — a Svelte readable store that tracks `navigator.onLine`, updating on `window` `online`/`offline` events.

Expose this store to the UI so components can react to connectivity changes.

**Tests:**
- Store initializes to `navigator.onLine`
- Store updates when `online`/`offline` events fire

---

### Step 7.4 — Sync queue

Create `frontend/src/lib/sync.js` with a `syncPending()` function that:
- Reads all drafts from IndexedDB that have a `pendingSync: true` flag
- For each: attempts the corresponding API call (create, update, or delete)
- On success: clears the `pendingSync` flag in IndexedDB
- On failure: leaves `pendingSync` set for the next sync attempt

Update the draft store to set `pendingSync: true` on any write that fails due to network unavailability.

---

### Step 7.5 — Background sync on reconnect

In `App.svelte`, watch the network store. When it transitions from `false` to `true` (offline → online), call `syncPending()` automatically.

**Verify manually:**
1. Log in, create a draft
2. Disconnect from the network (browser DevTools → offline mode)
3. Edit the draft — changes save locally
4. Reconnect — sync runs in the background
5. Open the app in a second browser tab — changes are there

---

## Phase 8: Deployment

### Step 8.1 — Cloudflare account setup

1. Create a Cloudflare account (if not already done)
2. Install Wrangler globally: `npm install -g wrangler`
3. Log in: `npx wrangler login`
4. Create the production D1 database: `npx wrangler d1 create threadweaver-db`
5. Update `wrangler.toml` with the production database ID

---

### Step 8.2 — Set production environment variables

In the Cloudflare dashboard (or via Wrangler), set:
```
APP_PASSWORD = <your chosen password>
```

This is the only secret the app needs.

---

### Step 8.3 — Apply D1 migrations to production

```
npx wrangler d1 migrations apply threadweaver-db
```

**Verify:** `npx wrangler d1 execute threadweaver-db --command "SELECT * FROM drafts"` succeeds.

---

### Step 8.4 — Deploy the Worker

```
cd backend && npx wrangler deploy
```

**Verify:** `curl https://<worker-url>/api/me` returns 401 (auth middleware working).

---

### Step 8.5 — Deploy the frontend to Cloudflare Pages

Build the frontend:
```
cd frontend && npm run build
```

Deploy to Pages:
```
npx wrangler pages deploy dist --project-name threadweaver
```

Configure the Pages project to proxy `/api/*` requests to the Worker (via a `_routes.json` or Pages Functions proxy).

**Verify:** Visit the Pages URL, log in, create a draft.

---

### Step 8.6 — Run E2E tests against production

Update `playwright.config.js` to point at the production URL and run the full Playwright suite.

**Golden path tests to verify:**
- [ ] Load app → login screen appears
- [ ] Enter wrong password → error shown
- [ ] Enter correct password → editor shown
- [ ] Create a draft, type content → draft appears in sidebar
- [ ] Reload page → draft still there
- [ ] Open in a second browser → draft visible (multi-device sync)
- [ ] Delete a draft → undo toast appears → undo works
- [ ] Delete a draft → wait 30s → draft gone
- [ ] Go offline → edit draft → go online → changes synced

---

## Summary

| Phase | Deliverable |
|---|---|
| 1 | Project scaffolded, dev environment running |
| 2 | Core editor logic ported to Svelte, unit tested |
| 3 | Auth working end-to-end |
| 4 | Full draft CRUD API with tests |
| 5 | Draft sidebar: list, search, create, rename, delete+undo |
| 6 | Notes panel wired to drafts |
| 7 | IndexedDB cache + offline editing + background sync |
| 8 | Deployed to Cloudflare, E2E tests passing |
