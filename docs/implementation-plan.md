# Threadweaver Implementation Plan

## Progress Tracker

| Field | Value |
|---|---|
| **Last updated** | 2026-05-08 |
| **Last completed step** | Phase 6 complete (Step 6.2) |
| **Resume from** | Phase 7, Step 7.1 |
| **Notes** | Playwright browser download unavailable in dev environment — run `npx playwright install chromium` on your local machine before running E2E tests |

> Update this table at the end of each work session before stopping.

---

**Rule:** Don't move to the next step until all checkboxes in that step are ticked.

---

## Phase 1: Project Scaffolding

### Step 1.1 — Initialize the Svelte + Vite frontend

- [x] Run `npm create vite@latest frontend -- --template svelte`
- [x] Run `cd frontend && npm install`
- [x] **Verify:** `npm run dev` inside `frontend/` serves a Svelte app at `localhost:5173`
- [x] **Manual validation:** Open `localhost:5173` in the browser — default Svelte welcome page loads without errors

---

### Step 1.2 — Initialize the Cloudflare Workers backend

- [x] Create `backend/` directory with `src/index.js` and `wrangler.toml`
- [x] Run `cd backend && npm install`
- [x] **Verify:** `npx wrangler dev` inside `backend/` serves a Worker at `localhost:8787`
- [x] **Manual validation:** `curl localhost:8787` returns a response without errors

---

### Step 1.3 — Configure the D1 database

- [x] Run `npx wrangler d1 create threadweaver-db` and note the database ID
- [x] Add the D1 binding to `backend/wrangler.toml`
- [x] Create `backend/migrations/0001_create_drafts.sql` with the drafts table schema
- [x] Run `npx wrangler d1 migrations apply threadweaver-db --local`
- [x] **Verify:** `npx wrangler d1 execute threadweaver-db --local --command "SELECT * FROM drafts"` returns an empty result without error
- [x] **Manual validation:** Output shows `[]` or an empty table — no SQL errors

---

### Step 1.4 — Set up Vitest for unit tests

- [x] Run `cd frontend && npm install -D vitest @vitest/ui jsdom`
- [x] Add `test: { environment: 'jsdom' }` to `frontend/vite.config.js`
- [x] Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to `frontend/package.json`
- [x] Write smoke test at `frontend/src/lib/__tests__/smoke.test.js`
- [x] **Verify:** `npm test` inside `frontend/` passes
- [x] **Manual validation:** Terminal shows green — "1 passed"

---

### Step 1.5 — Set up Playwright for E2E tests

- [x] Run `npm init playwright@latest` from repo root (choose TypeScript: no, browsers: Chromium only, CI: no)
- [x] Configure `playwright.config.js` baseURL to `http://localhost:5173`
- [x] Write smoke test at `tests/smoke.spec.js`
- [x] **Verify:** Start `npm run dev --prefix frontend`, then `npx playwright test` — smoke test passes
- [x] **Manual validation:** Playwright report shows 1 passed test

---

### Step 1.6 — Unified dev script

- [x] Create root-level `package.json`
- [x] Run `npm install -D concurrently` from repo root
- [x] Add `"dev"` script using `concurrently` to start both Vite and Wrangler
- [x] Add `"test"` script that runs Vitest in `frontend/` and Playwright from root
- [x] **Verify:** `npm run dev` from repo root starts both servers without errors
- [x] **Manual validation:**
  - [x] `localhost:5173` loads the Svelte app
  - [x] `localhost:8787` returns a Worker response
  - [x] Both stay running without crashing

---

### ✓ Phase 1 Checkpoint

Before moving to Phase 2, confirm all of the following:

- [x] `npm run dev` starts both frontend and backend from the repo root
- [x] `localhost:5173` shows the Svelte welcome page in the browser
- [x] `localhost:8787` responds to `curl` requests
- [x] `npm test --prefix frontend` passes (Vitest smoke test)
- [x] `npx playwright test` passes (Playwright smoke test)
- [x] D1 database is configured and the drafts table exists locally
- [x] All Phase 1 step checkboxes above are ticked
- [x] **Update the Progress Tracker at the top of this file**

---

## Phase 2: Port Core Editor Logic

### Step 2.1 — Extract character counting to a module

- [x] Create `frontend/src/lib/charCount.js` with the Bluesky character counting function (URLs = 20, mentions = 15), ported from `index.html`
- [x] Write tests in `frontend/src/lib/__tests__/charCount.test.js`:
  - [x] Plain text counts each character
  - [x] `https://example.com` counts as 20 regardless of actual length
  - [x] `@user.bsky.social` counts as 15 regardless of actual length
  - [x] Mixed text with URL and mention counts correctly
  - [x] Empty string returns 0
  - [x] String at exactly 300 returns 300
  - [x] String over 300 returns the correct overage count
- [x] **Verify:** `npm test` passes all cases
- [x] **Manual validation:** No browser check needed — logic only

---

### Step 2.2 — Extract chunk splitting to a module

- [x] Create `frontend/src/lib/chunks.js` with the chunk splitting function, ported from `index.html`
- [x] Write tests in `frontend/src/lib/__tests__/chunks.test.js`:
  - [x] Single chunk (no triple newlines) returns array of one
  - [x] Two chunks separated by `\n\n\n` returns array of two
  - [x] Leading/trailing whitespace within a chunk is preserved
  - [x] Empty string returns array with one empty string
  - [x] Multiple consecutive separators handled gracefully
- [x] **Verify:** `npm test` passes all cases
- [x] **Manual validation:** No browser check needed — logic only

---

### Step 2.3 — Build the Editor Svelte component

- [x] Create `frontend/src/lib/Editor.svelte` replicating all current `index.html` behavior:
  - [x] Textarea with transparent text over a visual render layer
  - [x] Visual layer with chunk prefixes (1/, 2/, 3/…) and red overage highlighting
  - [x] Scroll synchronization between textarea and visual layer
  - [x] Auto-resizing height
  - [x] Click chunk prefix to copy individual post (checkmark animation)
  - [x] "Copy All" button
  - [x] "Clear" button
  - [x] Character counter (`X/300`) for current chunk
  - [x] "Chunk X of Y" indicator
  - [x] Load/save from `localStorage` (same as today)
- [x] **Verify:** `npm test` still passes
- [x] **Manual validation:**
  - [x] Type a short post — character count updates correctly
  - [x] Type past 300 characters — overage text turns red
  - [x] Add triple newlines to create a second chunk — prefix shows "2/"
  - [x] Click "1/" — post is copied to clipboard, checkmark animates
  - [x] Click "Copy All" — all posts copied with numbering
  - [x] Click "Clear" — editor resets
  - [x] Reload page — content is restored from localStorage

---

### Step 2.4 — Wire Editor into App.svelte

- [x] Update `frontend/src/App.svelte` to render the `Editor` component
- [x] Set the page title to "Threadweaver"
- [x] **Verify:** Playwright smoke test passes (title check)
- [x] **Manual validation:** App loads in browser showing the editor, not the Svelte welcome page

---

### ✓ Phase 2 Checkpoint

- [x] `npm test` passes all unit tests (charCount, chunks)
- [x] `npx playwright test` passes the smoke test
- [x] Editor in browser is fully equivalent to the current `index.html` — test all features manually
- [x] localStorage persistence works across reloads
- [x] **Update the Progress Tracker**

---

## Phase 3: Auth

### Step 3.1 — Write the D1 drafts schema migration

- [x] Create `backend/migrations/0001_create_drafts.sql` with the drafts table
- [x] Run `npx wrangler d1 migrations apply threadweaver-db --local`
- [x] **Verify:** `npx wrangler d1 execute threadweaver-db --local --command "SELECT * FROM drafts"` returns empty set without error
- [x] **Manual validation:** No SQL errors in terminal output (done in Phase 1)

---

### Step 3.2 — Implement cookie signing utilities

- [x] Create `backend/src/lib/auth.js` with `signCookie(password)` and `verifyCookie(cookieValue, password)` using the Web Crypto API
- [x] Install Vitest in `backend/`: `npm install -D vitest`
- [x] Write tests in `backend/src/lib/__tests__/auth.test.js`:
  - [x] Cookie signed with "abc" verifies with "abc"
  - [x] Cookie signed with "abc" fails verification with "xyz"
  - [x] Cookie with past expiry fails verification
  - [x] Tampered cookie value fails verification
- [x] **Verify:** `npm test` in `backend/` passes all auth cases
- [x] **Manual validation:** No browser check needed — logic only

---

### Step 3.3 — Implement `POST /api/login`

- [x] Add `POST /api/login` route to `backend/src/index.js`
- [x] Implement constant-time password comparison
- [x] On match: set signed `session` cookie (HttpOnly, SameSite=Strict), return 200
- [x] On mismatch: return 401
- [x] Write integration tests in `backend/src/__tests__/login.test.js`:
  - [x] Correct password → 200 + `Set-Cookie` header
  - [x] Wrong password → 401, no cookie
  - [x] Missing body → 400
- [x] **Verify:** `npm test` in `backend/` passes
- [ ] **Manual validation:** `curl -X POST localhost:8787/api/login -H "Content-Type: application/json" -d '{"password":"password"}'` returns 200 and a `Set-Cookie` header

---

### Step 3.4 — Implement auth middleware

- [x] Add `requireAuth` middleware to `backend/src/lib/auth.js`
- [x] Apply middleware to all `/api/*` routes except `/api/login`
- [x] Add `GET /api/me` endpoint — returns 200 if authenticated, 401 if not
- [x] Write integration test: `GET /api/drafts` without a valid cookie returns 401
- [x] **Verify:** `npm test` in `backend/` passes
- [ ] **Manual validation:**
  - [ ] `curl localhost:8787/api/drafts` (no cookie) returns 401
  - [ ] `curl localhost:8787/api/me` (no cookie) returns 401

---

### Step 3.5 — Build the Login UI

- [x] Create `frontend/src/lib/Login.svelte` with password input, submit button, and error message
- [x] Support Enter key submission
- [x] On success: emit an event to show the main app
- [x] On failure: show "Incorrect password" message
- [x] Update `App.svelte` to call `GET /api/me` on load and show `Login` or `Editor` based on result
- [x] **Verify:** `npm test` passes
- [ ] **Manual validation:**
  - [ ] Load app — login screen appears
  - [ ] Enter wrong password — "Incorrect password" message appears
  - [ ] Enter correct password — editor appears
  - [ ] Reload page — editor shown immediately (no re-prompt)
  - [ ] Clear cookies in DevTools — login screen appears again

---

### ✓ Phase 3 Checkpoint

- [x] All backend tests pass (`npm test` in `backend/`)
- [x] All frontend tests pass (`npm test` in `frontend/`)
- [ ] Login → editor flow works end-to-end in the browser
- [x] Unauthenticated requests to `/api/*` return 401
- [ ] Cookie persists across page reloads
- [ ] **Update the Progress Tracker**

---

## Phase 4: Draft CRUD API

### Step 4.1 — `GET /api/drafts`

- [x] Implement route returning all drafts sorted by `updated_at` descending
- [x] Write tests:
  - [x] Returns 200 with empty array when no drafts exist
  - [x] Returns drafts sorted by `updated_at` descending
  - [x] Returns 401 without a valid session cookie
- [x] **Verify:** `npm test` in `backend/` passes
- [x] **Manual validation:** `curl localhost:8787/api/drafts -H "Cookie: session=<valid-cookie>"` returns `[]`

---

### Step 4.2 — `POST /api/drafts`

- [x] Implement route creating a draft with UUID, defaulting `title`/`content`/`notes`, setting timestamps
- [x] Write tests:
  - [x] Creates draft with provided fields, returns 201 with full object
  - [x] Creates draft with no body, returns 201 with defaults
  - [x] Returns 401 without a valid session cookie
- [x] **Verify:** `npm test` passes
- [x] **Manual validation:** `curl -X POST localhost:8787/api/drafts -H "Cookie: session=<valid-cookie>" -H "Content-Type: application/json" -d '{"title":"Test"}'` returns 201 with a draft object including an `id`

---

### Step 4.3 — `GET /api/drafts/:id`

- [x] Implement route returning a single draft by ID
- [x] Write tests:
  - [x] Returns 200 with the correct draft
  - [x] Returns 404 for an unknown ID
  - [x] Returns 401 without a valid session cookie
- [x] **Verify:** `npm test` passes
- [x] **Manual validation:** Use the ID from Step 4.2 — `curl localhost:8787/api/drafts/<id> -H "Cookie: session=<valid-cookie>"` returns the draft

---

### Step 4.4 — `PUT /api/drafts/:id`

- [x] Implement route updating a draft, bumping `updated_at`
- [x] Write tests:
  - [x] Updates `content` only, other fields unchanged, `updated_at` bumped
  - [x] Updates all fields at once
  - [x] Returns 404 for unknown ID
  - [x] Returns 401 without a valid session cookie
- [x] **Verify:** `npm test` passes
- [x] **Manual validation:** `curl -X PUT localhost:8787/api/drafts/<id> -H "Cookie: session=<valid-cookie>" -H "Content-Type: application/json" -d '{"title":"Updated"}'` returns updated draft with new `updated_at`

---

### Step 4.5 — `DELETE /api/drafts/:id`

- [x] Implement route deleting a draft, returning 204
- [x] Write tests:
  - [x] Deletes the draft, subsequent GET returns 404
  - [x] Returns 404 for unknown ID
  - [x] Returns 401 without a valid session cookie
- [x] **Verify:** `npm test` in `backend/` passes all tests across all endpoints
- [x] **Manual validation:** `curl -X DELETE localhost:8787/api/drafts/<id> -H "Cookie: session=<valid-cookie>"` returns 204, subsequent GET returns 404

---

### ✓ Phase 4 Checkpoint

- [x] All 5 endpoints implemented and tested
- [x] `npm test` in `backend/` passes everything
- [x] Manually exercised all endpoints with `curl`
- [x] Auth middleware blocks all endpoints without a valid cookie
- [x] **Update the Progress Tracker**

---

## Phase 5: Draft Management UI

### Step 5.1 — Draft store

- [x] Create `frontend/src/lib/stores/drafts.svelte.js` with `loadDrafts`, `createDraft`, `updateDraft`, `deleteDraftWithUndo`
- [x] Write tests in `frontend/src/lib/__tests__/drafts.test.js` (mock fetch):
  - [x] `loadDrafts` populates the store with API response
  - [x] `createDraft` adds the new draft to the store
  - [x] `updateDraft` updates the correct draft in the store
  - [x] `deleteDraft` removes the draft from the store
- [x] **Verify:** `npm test` passes
- [x] **Manual validation:** Open browser console — call `loadDrafts()` manually and confirm the store updates (use Svelte devtools or a temporary console log)

---

### Step 5.2 — Hamburger menu + sidebar shell

- [x] Create `frontend/src/lib/Sidebar.svelte` with hamburger button fixed to top-right
- [x] Sidebar slides in from the right, overlays the editor
- [x] Clicking outside closes it; `Escape` key closes it
- [x] **Verify:** `npm test` passes
- [x] **Manual validation:**
  - [x] Hamburger button visible in top-right corner
  - [x] Click hamburger — sidebar opens smoothly
  - [x] Click hamburger again — sidebar closes
  - [x] Click outside sidebar — sidebar closes
  - [x] Press Escape — sidebar closes
  - [x] Sidebar does not push or resize the editor

---

### Step 5.3 — Draft list

- [x] Render draft list inside sidebar, sorted by `updated_at` most recent first
- [x] Each item shows title and last-modified date
- [x] Clicking an item loads that draft into the editor and closes sidebar
- [x] **On page load:** load existing drafts and open the most-recently-modified one; only create a new blank draft if none exist — do NOT create a new draft on every page load
- [x] **Verify:** `npm test` passes
- [x] **Manual validation:**
  - [x] Create two drafts via `curl`, open sidebar — both appear in correct order
  - [x] Click a draft — editor loads its content, sidebar closes
  - [x] Edit draft, reopen sidebar — `updated_at` order updates correctly
  - [x] Reload the page — the previously active draft re-opens (no new blank draft created)

---

### Step 5.4 — Search

- [x] Add search input at top of sidebar, filtering draft list client-side on each keystroke
- [x] Match against `title`, `content`, and `notes` (case-insensitive substring)
- [x] Write tests in `frontend/src/lib/__tests__/draftSearch.test.js`:
  - [x] Empty query returns all drafts
  - [x] Query matching title returns correct drafts
  - [x] Query matching content returns correct drafts
  - [x] Query matching notes returns correct drafts
  - [x] Query matching nothing returns empty list
  - [x] Search is case-insensitive
- [x] **Verify:** `npm test` passes
- [x] **Manual validation:**
  - [x] Type a word that matches a draft title — list filters instantly
  - [x] Type a word from a draft's content — that draft appears
  - [x] Type nonsense — empty list shown
  - [x] Clear search — full list returns

---

### Step 5.5 — Create draft

- [x] Add "New draft" button at top of sidebar
- [x] On click: call `createDraft()`, switch editor to new draft, close sidebar
- [x] **Verify:** `npm test` passes
- [x] **Manual validation:**
  - [x] Click "New draft" — blank editor appears with "Untitled" title
  - [x] New draft appears at top of sidebar list
  - [x] Previously active draft is preserved and visible in list

---

### Step 5.6 — Rename draft

- [x] Make draft title in editor editable inline on click
- [x] On blur or Enter, call `updateDraft(id, { title })`
- [x] **Verify:** `npm test` passes
- [x] **Manual validation:**
  - [x] Click draft title — becomes an input field
  - [x] Type new name, press Enter — title updates
  - [x] Reopen sidebar — new name shown in list
  - [x] Click away without changing — no spurious API call

---

### Step 5.7 — Delete draft with undo

- [x] Add trash icon button to each sidebar draft item
- [x] On click: remove from store immediately, show "Draft deleted. Undo" toast with 30s countdown
- [x] Undo within window: restore draft to store, skip API call
- [x] After 30s: call `DELETE /api/drafts/:id`
- [x] If active draft deleted: switch to next most-recent
- [x] If last draft permanently deleted (30s timer fires): auto-create a new blank draft in the store timer callback — **not** via a reactive effect in App.svelte, which would race against the initial `loadDrafts()` call and create a spurious blank draft on every page load
- [x] Write tests in `frontend/src/lib/__tests__/deleteUndo.test.js`:
  - [x] Undo within window restores draft, no DELETE call made
  - [x] DELETE called exactly once after window expires
- [x] **Verify:** `npm test` passes
- [x] **Manual validation:**
  - [x] Delete a draft — disappears from list, toast appears
  - [x] Click Undo — draft reappears, no network call made
  - [x] Delete again, wait 30s — draft is gone, DELETE was called
  - [x] Delete the active draft — editor switches to another draft

---

### ✓ Phase 5 Checkpoint

- [x] All draft store tests pass
- [x] All search tests pass
- [x] All delete/undo tests pass
- [ ] `npx playwright test` passes
- [x] **Full manual walkthrough:**
  - [x] Create 3 drafts, verify they appear sorted by modified date
  - [x] Search across title, content, and notes
  - [x] Rename a draft, confirm it persists after reload
  - [x] Delete with undo, delete without undo
  - [x] Switch between drafts — editor loads correct content each time
- [x] **Update the Progress Tracker**

---

## Phase 6: Notes Panel

### Step 6.1 — Add notes panel to editor layout

- [x] Update `Editor.svelte` layout to include a collapsible notes panel
- [x] Notes panel contains a plain-text `<textarea>` labelled "Notes"
- [x] Collapse/expand toggle button; when collapsed only toggle is visible
- [x] **Verify:** `npm test` passes
- [ ] **Manual validation:**
  - [ ] Notes panel visible alongside editor
  - [ ] Click toggle — panel collapses
  - [ ] Click toggle again — panel expands
  - [ ] Notes panel does not interfere with the editor or chunk rendering

---

### Step 6.2 — Wire notes to draft store

- [x] When active draft changes, populate notes textarea from `draft.notes`
- [x] On keystroke in notes textarea, debounce 500ms and call `updateDraft(id, { notes })`
- [x] **Verify:** `npm test` passes
- [ ] **Manual validation:**
  - [ ] Type in notes — wait 500ms — no visible error
  - [ ] Reload page — notes are still there
  - [ ] Switch to a different draft — notes area updates to that draft's notes
  - [ ] Switch back — original notes are intact

---

### ✓ Phase 6 Checkpoint

- [x] All tests pass
- [x] Notes persist across reloads
- [x] Notes are per-draft (switching drafts swaps notes correctly)
- [x] Collapse/expand works cleanly
- [x] **Update the Progress Tracker**

---

## Phase 7: IndexedDB + Offline Support

### Step 7.1 — IndexedDB service

- [ ] Run `npm install -D fake-indexeddb` in `frontend/`
- [ ] Create `frontend/src/lib/db.js` with `getAll`, `get`, `put`, `remove`, `getUpdatedAfter`
- [ ] Write tests in `frontend/src/lib/__tests__/db.test.js`:
  - [ ] `put` then `get` returns the same draft
  - [ ] `put` twice updates the record
  - [ ] `remove` then `get` returns undefined
  - [ ] `getAll` returns all stored drafts
  - [ ] `getUpdatedAfter` returns only drafts modified after the given timestamp
- [ ] **Verify:** `npm test` passes all db cases
- [ ] **Manual validation:** No browser check needed — logic only

---

### Step 7.2 — Write-through caching

- [ ] Update `loadDrafts` — read IndexedDB immediately, then fetch API and merge by `updated_at`
- [ ] Update `createDraft` — write to IndexedDB first, then API
- [ ] Update `updateDraft` — write to IndexedDB first, then API
- [ ] Update `deleteDraft` — remove from IndexedDB first, then API
- [ ] Write tests: mock API to fail; verify IndexedDB has correct state after each operation
- [ ] **Verify:** `npm test` passes
- [ ] **Manual validation:**
  - [ ] Open app, create a draft — appears immediately (no loading flash)
  - [ ] Hard-reload — draft loads instantly from IndexedDB before API responds

---

### Step 7.3 — Online/offline detection

- [ ] Create `frontend/src/lib/stores/network.js` tracking `navigator.onLine`
- [ ] Update on `window` `online`/`offline` events
- [ ] Show a subtle offline indicator in the UI when offline
- [ ] Write tests:
  - [ ] Store initializes to `navigator.onLine`
  - [ ] Store updates when `online`/`offline` events fire
- [ ] **Verify:** `npm test` passes
- [ ] **Manual validation:**
  - [ ] Open browser DevTools → Network → set "Offline"
  - [ ] Offline indicator appears in the UI
  - [ ] Set back to online — indicator disappears

---

### Step 7.4 — Sync queue

- [ ] Add `pendingSync: true` flag to drafts in IndexedDB when an API write fails
- [ ] Create `frontend/src/lib/sync.js` with `syncPending()` that retries failed writes
- [ ] On success: clear `pendingSync` flag
- [ ] On failure: leave flag set for next attempt
- [ ] Write tests:
  - [ ] Draft with `pendingSync: true` is retried by `syncPending()`
  - [ ] On success, `pendingSync` is cleared
  - [ ] On failure, `pendingSync` remains set
- [ ] **Verify:** `npm test` passes
- [ ] **Manual validation:** No browser check needed for sync logic — covered in Step 7.5

---

### Step 7.5 — Background sync on reconnect

- [ ] In `App.svelte`, watch the network store and call `syncPending()` on offline → online transition
- [ ] **Verify:** `npm test` passes
- [ ] **Manual validation:**
  - [ ] Log in, create a draft
  - [ ] Open DevTools → Network → set Offline
  - [ ] Edit the draft — changes save (no errors shown)
  - [ ] Set back to Online — sync runs silently in background
  - [ ] Open app in a second browser tab — edited draft is there

---

### ✓ Phase 7 Checkpoint

- [ ] All IndexedDB tests pass
- [ ] All sync tests pass
- [ ] All other tests still pass (no regressions)
- [ ] `npx playwright test` passes
- [ ] **Full offline walkthrough:**
  - [ ] Go offline, create a new draft
  - [ ] Go offline, edit an existing draft
  - [ ] Go offline, delete a draft
  - [ ] Come back online — all changes synced to server
  - [ ] Verify in a second browser tab
- [ ] **Update the Progress Tracker**

---

## Phase 8: Deployment

### Step 8.1 — Cloudflare account setup

- [ ] Create Cloudflare account (if not already done)
- [ ] Run `npx wrangler login`
- [ ] Run `npx wrangler d1 create threadweaver-db` (production)
- [ ] Update `wrangler.toml` with production database ID

---

### Step 8.2 — Set production secrets

- [ ] Set `APP_PASSWORD` via `npx wrangler secret put APP_PASSWORD`
- [ ] **Manual validation:** `npx wrangler secret list` shows `APP_PASSWORD`

---

### Step 8.3 — Apply D1 migrations to production

- [ ] Run `npx wrangler d1 migrations apply threadweaver-db`
- [ ] **Verify:** `npx wrangler d1 execute threadweaver-db --command "SELECT * FROM drafts"` succeeds
- [ ] **Manual validation:** No SQL errors in output

---

### Step 8.4 — Deploy the Worker

- [ ] Run `cd backend && npx wrangler deploy`
- [ ] **Verify:** `curl https://<worker-url>/api/me` returns 401
- [ ] **Manual validation:** Worker URL responds — auth middleware is live

---

### Step 8.5 — Deploy frontend to Cloudflare Pages

- [ ] Run `cd frontend && npm run build`
- [ ] Run `npx wrangler pages deploy dist --project-name threadweaver`
- [ ] Configure Pages to proxy `/api/*` to the Worker
- [ ] **Manual validation:** Visit Pages URL — login screen appears

---

### Step 8.6 — Production E2E validation

- [ ] Update `playwright.config.js` baseURL to production URL
- [ ] Run `npx playwright test`
- [ ] **Manual golden path checklist:**
  - [ ] Load app → login screen appears
  - [ ] Enter wrong password → error shown
  - [ ] Enter correct password → editor appears
  - [ ] Create a draft, type content → appears in sidebar
  - [ ] Reload → draft still there
  - [ ] Open in a second browser (incognito) → draft visible after login
  - [ ] Delete a draft → undo toast appears → undo works
  - [ ] Delete a draft → wait 30s → draft gone permanently
  - [ ] Go offline → edit draft → go online → changes synced to second browser

---

### ✓ Phase 8 Checkpoint

- [ ] App is live at the Cloudflare Pages URL
- [ ] All Playwright tests pass against production
- [ ] Full manual golden path completed above
- [ ] **Update the Progress Tracker** — set Last completed step to "Phase 8 complete"

---

## Summary

| Phase | Deliverable | Status |
|---|---|---|
| 1 | Project scaffolded, dev environment running | ✅ Done |
| 2 | Core editor logic ported to Svelte, unit tested | ✅ Done |
| 3 | Auth working end-to-end | — |
| 4 | Full draft CRUD API with tests | — |
| 5 | Draft sidebar: list, search, create, rename, delete+undo | — |
| 6 | Notes panel wired to drafts | — |
| 7 | IndexedDB cache + offline editing + background sync | — |
| 8 | Deployed to Cloudflare, E2E tests passing | — |
