# Threadweaver PRD

## Overview

Threadweaver today is a single-page tool: paste your text, chunk it to 300 characters, copy to Bluesky. It does one thing well, but it's ephemeral — one draft, one device, no memory.

The goal of this upgrade is to make Threadweaver a proper authoring environment for Bluesky threads — with persistent multi-draft management, a notes panel for raw material, and access from any device.

---

## Goals

- Let users manage multiple named thread drafts
- Persist drafts to the cloud so they're accessible from any device
- Provide a notes area per draft as raw material that never gets published
- Keep the core chunking and character-counting experience intact

## Non-Goals

- Direct posting to Bluesky (out of scope for now — copy-paste remains the publish step)
- AI features (see `future-ideas.md`)
- Mobile app (web-first)
- Support for platforms other than Bluesky

---

## Key User Scenarios

### 1. New thread from notes
The user has been collecting thoughts on a topic — rough ideas, quotes, bullet points — and wants to turn them into a thread. They open Threadweaver, create a new draft, jot their notes into the notes panel, and start writing posts in the editor. The notes stay visible alongside the editor as a reference.

### 2. Editing an existing draft
The user has a draft they've been working on across multiple sessions. They open Threadweaver, see their saved drafts, pick the one they want, and continue editing where they left off.

### 3. Multi-device workflow
The user starts a draft on their laptop, steps away, and continues on a tablet. Because drafts are stored in the cloud (not just localStorage), the draft is there when they log in from the second device.

---

## Feature Areas

### 1. Multi-Draft Management

Users can create, name, and switch between multiple drafts. Each draft contains:
- A title (user-defined)
- The thread content (the chunked post text, same as today)
- A notes area (see below)
- Created and last-modified timestamps

**UI:** A hamburger menu on the right side of the screen. Clicking it expands a sidebar panel listing saved drafts; clicking again collapses it. The sidebar contains controls to create, rename, and delete drafts.

**Sorting:** Drafts are sorted by last modified date, most recent first.

**Search:** A search input at the top of the sidebar filters the draft list in real time as the user types. Search matches against all fields — title, thread content, and notes. Search runs entirely client-side against the locally cached draft list, so there is no server round trip and results update instantly on each keystroke.

**Deletion:** Deletes are immediate — no trash or soft delete. However, a toast notification with an "Undo" button appears for ~30 seconds after deletion, allowing the user to recover the draft. After the window expires the delete is permanent.

There is no limit on the number of drafts.

---

### 2. Cloud Persistence & Auth

Today, drafts live in `localStorage` — single-device, single-browser. The upgrade requires a backend so drafts survive across devices.

**Auth mechanism:** A single password stored as an environment variable (`APP_PASSWORD`). The first visit on any device shows a minimal password screen; on success the server sets a signed cookie and all subsequent visits are seamless.

**Sessions:** Stateless signed cookies — no session table needed. The server signs the cookie with a secret derived from the `APP_PASSWORD` hash. This means:
- Server restarts don't log you out (no in-memory or DB state to lose)
- Changing `APP_PASSWORD` automatically invalidates all existing cookies (since the signing secret changes)
- Forgotten password: update the env var in your hosting platform and redeploy — you can never be permanently locked out as long as you can access the hosting dashboard

**New device onboarding:** Visit the URL, enter the password, done.

**Offline support:** Authenticated users can continue using the app with no internet connection. Drafts are cached locally (IndexedDB) so all read/write/delete operations work offline. When the connection is restored, local changes sync to the server automatically in the background — no manual action needed. Since there is only one user, conflict resolution is simple: last write wins.

---

### 3. Notes Panel

Each draft has a notes area — a free-form text field that sits alongside the thread editor. Notes are:
- **Private** — never published, never sent to Bluesky
- **Persistent** — saved with the draft to the cloud

Think of it as a scratchpad: rough ideas, quotes, bullet points, links, reminders to self.

Notes are plain text. The panel is collapsible. There is no character limit.

---

## Technical Considerations

### Current stack
Single-file `index.html` — HTML, vanilla JS, Tailwind CSS (CDN). No build system, no backend, no dependencies.

### Target stack

| Layer | Technology |
|---|---|
| Frontend | Svelte + Vite |
| Backend | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Hosting | Cloudflare Pages (frontend) + Workers (backend) |

**Why Cloudflare:** Free tier covers all personal use. No cold starts. Frontend, backend, and database all under one account. Workers + D1 is a natural pairing.

**Workers runtime note:** Cloudflare Workers runs on the V8 isolate runtime, not Node.js. Most standard Web APIs are available, but Node.js-specific APIs are not. This is a minor constraint for a CRUD app — worth keeping in mind when choosing libraries.

**Frontend migration:** The frontend moves from a single HTML file to a Svelte + Vite project. Svelte's reactivity is a natural fit for the new UI — live search, offline sync state, collapsible panels, and draft switching all involve non-trivial state management that is awkward in vanilla JS.

---

## Testing

### Local development
The full stack runs locally via Wrangler (Cloudflare's CLI), which emulates Workers and D1 on your machine. A single `npm run dev` starts both the Vite frontend (with hot reload) and the Wrangler backend (with a local SQLite database). No internet connection required during development.

### Test layers

**Unit tests** — core logic: character counting, chunk splitting, client-side search filtering, cookie signing. Run with Vitest (pairs naturally with Vite). These are the highest-value tests since the character counting algorithm is well-defined and already battle-tested.

**Component tests** — Svelte components in isolation: draft list, search input, notes panel, delete undo toast. Vitest + `@testing-library/svelte`.

**Integration tests** — Workers API endpoints: auth, draft CRUD, offline sync. Wrangler's `unstable_dev` helper spins up a local Worker for testing without a browser.

**End-to-end tests** — full app in a real browser via Playwright, running against the local dev server. Cover the golden paths: log in, create draft, edit, save, retrieve after reload, offline editing, sync on reconnect.

### Recommended minimum
For a personal tool, the highest-leverage investment is:
1. Unit tests for character counting and chunk splitting
2. A handful of Playwright tests for the golden path (login → create → edit → persist → retrieve)

Component and integration tests are useful but not essential.

---

## Open Questions (Unresolved)

None at this time.

---

## Status

**Last updated:** 2026-04-20 (rev: add testing section)
**Stage:** Idea exploration — not yet approved for implementation
