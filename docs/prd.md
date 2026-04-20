# Threadweaver PRD

## Overview

Threadweaver today is a single-page tool: paste your text, chunk it to 300 characters, copy to Bluesky. It does one thing well, but it's ephemeral — one draft, one device, no memory.

The goal of this upgrade is to make Threadweaver a proper authoring environment for Bluesky threads. The workflow starts with raw notes and ends with a polished, ready-to-post thread — with AI helping at every step, and your work persisting across sessions and devices.

---

## Goals

- Let users manage multiple named thread drafts
- Persist drafts to the cloud so they're accessible from any device
- Provide a notes area per draft as raw material that never gets published
- Use AI to generate a first-draft thread from notes
- Use AI to edit and refine posts one-by-one, following the same rules as the `/bsky-edit` skill
- Keep the core chunking and character-counting experience intact

## Non-Goals

- Direct posting to Bluesky (out of scope for now — copy-paste remains the publish step)
- Mobile app (web-first)
- Support for platforms other than Bluesky

---

## Key User Scenarios

### 1. New thread from notes
The user has been collecting thoughts on a topic — rough ideas, quotes, bullet points — and wants to turn them into a thread. They open Threadweaver, create a new draft, drop their notes into the notes panel, and hit "Generate draft." The AI turns the raw notes into a coherent set of posts. The user then edits them with AI assistance until each post is tight and on-point.

### 2. Editing an existing draft
The user has a draft they've been working on across multiple sessions. They open Threadweaver, see their saved drafts, pick the one they want, and continue editing. They work through each post with the AI editor — paste a post, get a revision and character count, accept or revise, move to the next.

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

**Offline support:** Authenticated users can continue using the app with no internet connection. Drafts are cached locally (IndexedDB) so all read/write/delete operations work offline. AI features (generation, editing) require a network connection and show a clear "requires internet" message when offline. When the connection is restored, local changes sync to the server automatically in the background — no manual action needed. Since there is only one user, conflict resolution is simple: last write wins.

---

### 3. Notes Panel

Each draft has a notes area — a free-form text field that sits alongside the thread editor. Notes are:
- **Private** — never published, never sent to Bluesky
- **Persistent** — saved with the draft to the cloud
- **AI-readable** — the primary input for the "generate from notes" feature

Think of it as a scratchpad: links to research, rough ideas, quotes, bullet points, reminders to self.

Notes are plain text. The panel is collapsible. There is no character limit.

---

### 4. AI Draft Generation

The user clicks "Generate draft from notes." The backend sends the raw notes to the Claude API, which returns a structured first draft — a coherent set of posts, each within the 300-character limit, following the same Threadweaver character-counting rules (URLs = 20, mentions = 15).

The generation prompt should:
- Instruct Claude on the 300-character limit and counting rules
- Ask for a clear first sentence per post
- Favor one topic per post
- Avoid flowery language and hype words (consistent with `/bsky-edit` principles)

The generated draft populates the thread editor, where the user can continue editing manually or with the AI editor.

Generation always produces the full thread — not individual posts. Individual post refinement is handled by the AI editing mode (Feature 5).

Tone and style hints are not a separate feature — the user can include them directly in the notes (e.g. "keep it casual" or "this is for a technical audience"). Claude will pick them up naturally.

If the thread editor already has content when the user hits "Generate draft," the app shows a confirmation warning before overwriting. If the editor is empty, generation proceeds without a prompt.

---

### 5. AI Editing Mode

An interactive editing experience built on the same rules as the `/bsky-edit` Claude Code skill, but embedded directly in the Threadweaver UI.

**How it works:**
- The user selects a post (chunk) they want to refine
- The app sends the post — plus thread context (earlier posts) — to the Claude API
- Claude responds with: revised post text, character count (e.g. `247/300`), and a short note on what changed and why
- The user accepts the revision, asks for another pass, or edits manually

**Editing rules (same as `/bsky-edit`):**
- First sentence must be clear and convey the topic
- One topic per post — suggest a split if there are multiple ideas
- Direct and concise; no flowery language or hype words
- Fit within 300 characters (using Threadweaver's counting rules)
- Don't force a revision — if the post is already good, say so

**Thread context:** The AI sees all previously finalized posts in the thread so it can avoid repetition and maintain consistent voice.

**Open questions:**
- Should the AI panel be a sidebar, an inline overlay, or a modal?
- Should the user be able to send a custom instruction with each post (e.g. "make it more casual")?
- How do we surface the "suggest a split" case in the UI?
- Rate limiting / cost management for the Claude API calls?

---

## Technical Considerations

### Current stack
Single-file `index.html` — HTML, vanilla JS, Tailwind CSS (CDN). No build system, no backend, no dependencies.

### Upgrade path
A backend and auth system are required for cloud persistence. Options:

| Approach | Pros | Cons |
|---|---|---|
| Node.js + Postgres (e.g. on Railway/Render) | Familiar, flexible | Requires server management |
| Cloudflare Workers + D1 | Zero cold starts, cheap, edge | Less familiar stack |
| AT Protocol records | Native Bluesky integration | AT Protocol complexity; records are public |

The frontend will likely need to move from a single HTML file to a proper build (Vite + vanilla JS or a lightweight framework) to manage the added complexity.

### Claude API
The AI features (generate + edit) will call the Claude API directly from the backend. The backend proxies requests so the API key is never exposed to the browser. The `/bsky-edit` skill's prompt logic (character counting, revision rules, thread context) should be ported into the backend prompt templates.

**Model recommendation:** Claude Sonnet 4.6 (`claude-sonnet-4-6`) — good balance of quality and speed for interactive editing.

---

## Open Questions (Unresolved)

These cut across multiple features and need decisions before implementation begins:

1. **Auth strategy:** Bluesky OAuth vs. something simpler (email, passkeys, anonymous with a sync code)?
2. **Backend stack:** Where does Threadweaver's server live?
3. **Frontend migration:** Stay vanilla JS with a build step, or adopt a lightweight framework (e.g. Preact, Solid)?
4. **Offline mode:** Should the app work without signing in, with local-only drafts?
5. **Scope of v1:** Which of these features ship together, and which are later? Suggested minimal slice: multi-draft + cloud storage (no AI) as v1, AI features as v2.

---

## Status

**Last updated:** 2026-04-20 (rev: warn before overwriting existing thread content)
**Stage:** Idea exploration — not yet approved for implementation
