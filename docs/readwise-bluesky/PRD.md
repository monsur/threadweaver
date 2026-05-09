# PRD: Readwise → Bluesky Post Generator

## Problem

Sharing an article on Bluesky requires manually writing a post — summarizing the piece, picking the best quote, deciding on framing. The friction is high enough that most saved articles never get shared, even when you genuinely want to.

## Goal

Given a saved Readwise article (with its highlights), draft a ready-to-publish Bluesky thread. The user reviews, lightly edits if needed, and posts — without starting from a blank screen.

---

## Architecture Decision

**Built as a page inside Threadweaver** (not a standalone app).

Rationale:
- Auth is free — same session cookie, same domain, no cross-origin issues
- Generated drafts flow through the existing draft store and appear in the editor and sidebar automatically
- Single deployment and codebase to maintain
- Aligns with the direction of expanding Threadweaver into a full Bluesky workflow hub

---

## Navigation Change

Threadweaver keeps the editor as the default landing page. A small persistent nav menu is added at the top of the app (visible when logged in) with links to switch between:
- **Editor** — the existing threaded post editor
- **Readwise** — the new Readwise page

No separate home/menu page.

---

## Core User Flow

**Browsing:**
1. Open Threadweaver → land on the editor (unchanged default)
2. Click "Readwise" in the top nav → see a collapsed list of article titles
3. Click a title → opens the original article in a new window
4. Click the expand arrow → reveals highlights inline; click again to collapse

**Archiving (no post):**
5. Click the Archive button → removes the tag in Readwise, removes the article from the list immediately

**Posting:**
5. Click the Post button → AI generates a Bluesky thread draft, removes the tag in Readwise, then redirects to the editor with the draft open
6. The draft's notes field is pre-populated with the source URL and all highlights for reference while editing
7. Copy posts to Bluesky manually using Threadweaver's existing copy-to-clipboard flow

---

## Readwise Page UI

Each article is displayed as a row:

```
[▶] Article Title                               [Archive] [Post]
```

Expanded:

```
[▼] Article Title                               [Archive] [Post]
     • Highlight one
     • Highlight two
     • Highlight three
```

- **Expand/collapse arrow** (left of title): toggles highlight visibility; fetches highlights on demand when first expanded
- **Title** (clickable): opens original article URL in a new window
- **Archive button** (right, always visible): removes tag, removes row from list
- **Post button** (right, always visible): generates draft, removes tag, redirects to editor; shows a full-page loading indicator while generating
- Both buttons are visible regardless of collapsed/expanded state
- Articles sorted by most recently saved first
- If an article has no highlights, the expand arrow is still shown but the expanded state is empty

---

## Features

### Must Have
- Persistent top nav with links to Editor and Readwise (visible when logged in); editor remains the default landing page
- Fetch saved articles by configured tag from the Readwise API (title, URL, highlights, author)
- Article list shows only articles still carrying the configured tag
- Articles sorted by most recently saved first
- Collapsed view by default — shows title only
- Title is a link to the original article (opens in new window)
- Expand/collapse toggle reveals highlights for an article; highlights fetched on demand (separate API call on first expand, not on page load)
- Archive button: removes tag in Readwise, removes article from list immediately with no confirmation
- Post button: shows full-page loading indicator, generates Bluesky thread draft, removes tag in Readwise, redirects to editor
- Tag removed after successful generation (not before — a failed generation leaves the article in the list)
- Generated draft's notes field pre-populated with source URL and full highlight text
- Thread is variable length; each post conveys a single distinct idea
- AI input: highlights + title/URL/author always included; "quote + link" is a valid and often ideal output
- Neutral voice/tone (no persona mimicry)
- Articles with no highlights show an empty expanded state

### Nice to Have
- Multiple tone presets (analytical, casual, hot take)
- Regenerate individual posts within a thread

### Out of Scope
- Scheduling posts
- Fetching full article body text
- Multi-platform publishing (Twitter/X, Mastodon, etc.)
- Metrics on post performance
- Editable voice/persona settings in the UI

---

## Configuration

All configuration is set via Wrangler environment variables at deploy time — not editable through the UI.

- **`READWISE_TAG`**: the tag that marks articles for sharing
- **`READWISE_API_KEY`**: Readwise API key
- **`ANTHROPIC_API_KEY`**: Claude API key
- **`LLM_PROVIDER`**: selects the LLM backend (`anthropic` default; swappable without code changes)
- **`LLM_MODEL`**: model name (e.g. `claude-opus-4-7`)
- **`LLM_MAX_TOKENS`**: max tokens for the LLM response
- **`LLM_TEMPERATURE`**: sampling temperature

The system prompt lives in `backend/src/prompts/generate-thread.txt` and can be edited directly without touching code. It is imported as a text module at build time.
