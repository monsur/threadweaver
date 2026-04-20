# Threadweaver — Future Ideas

Ideas that are deliberately out of scope for the current upgrade but worth revisiting later.

---

## AI Draft Generation

The user clicks "Generate draft from notes." The backend sends the raw notes to the Claude API, which returns a structured first draft — a coherent set of posts, each within the 300-character limit, following the same Threadweaver character-counting rules (URLs = 20, mentions = 15).

The generation prompt should:
- Instruct Claude on the 300-character limit and counting rules
- Ask for a clear first sentence per post
- Favor one topic per post
- Avoid flowery language and hype words (consistent with `/bsky-edit` principles)

Generation always produces the full thread — not individual posts. Individual post refinement is handled by AI Editing Mode (see below).

Tone and style hints are not a separate feature — the user can include them directly in the notes (e.g. "keep it casual" or "this is for a technical audience"). Claude will pick them up naturally.

If the thread editor already has content when the user hits "Generate draft," the app shows a confirmation warning before overwriting. If the editor is empty, generation proceeds without a prompt.

The generated draft populates the thread editor, where the user can continue editing manually or with the AI editor.

---

## AI Editing Mode

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

## Technical Notes (AI features)

The AI features would call the Claude API from the backend — the backend proxies requests so the API key is never exposed to the browser. The `/bsky-edit` skill's prompt logic (character counting, revision rules, thread context) should be ported into the backend prompt templates.

**Model recommendation:** Claude Sonnet 4.6 (`claude-sonnet-4-6`) — good balance of quality and speed for interactive editing.
