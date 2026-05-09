# Threadweaver

I like to think of [my Bluesky](https://bsky.app/profile/monsur.hossa.in) as blog posts split into bite-sized chunks. Threadweaver helps compose these posts by giving visual feedback on chunk sizes.

Threadweaver is a web app with a text editor. As you type, an indicator on the left numbers each Bluesky post. Clicking the indicator copies the post to the clipboard. The text turns red if it goes over the character limit. Use three blank lines to create a new post chunk.

Drafts are saved to the cloud so you can access them from any device, and edits work offline and sync when you reconnect.

**Live app:** https://threadweaver.pages.dev

![Screenshot of Threadweaver](https://monsur.hossa.in/images/posts/threadweaver01.png "Screenshot of Threadweaver")

---

Threadweaver was vibecoded, of course. Gemini built the first version and it worked well out of the box.

Things got complicated when adding new features. Claude didn't fare much better initially — while Claude had some neat ideas, complex features didn't always work end-to-end.

So I tried a different approach: breaking the problem into pieces and building up to the solution. Claude fared much better on small iterative prompts in succession. This approach reduced the problem space to small simple chunks, each with clear scope. Better problem framing guided AI to a better solution.

The current version was built with [Claude Code](https://claude.ai/code) following a structured implementation plan in `docs/implementation-plan.md`.

---

## Features

- Split text into Bluesky post chunks using triple newlines as separators
- Character counter per chunk (300-char limit, URLs = 20, mentions = 15)
- Click a chunk prefix to copy that post; "Copy All" copies the full thread
- Multiple named drafts with sidebar search
- Notes panel per draft (scratch space, not published)
- Offline support — edits save to IndexedDB and sync when you reconnect
- Installable as a PWA

## Stack

| Layer | Technology |
|---|---|
| Frontend | Svelte 5, Vite, Tailwind CSS |
| Backend | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Hosting | Cloudflare Pages (frontend) + Workers (backend) |
| Auth | Password-based, signed HttpOnly cookie |
| Offline | IndexedDB write-through cache + service worker (vite-plugin-pwa) |

---

## Local Development

### Prerequisites

- Node.js 18+
- A Cloudflare account (for `wrangler`)

### Setup

```bash
# Install dependencies
npm install
npm install --prefix frontend
npm install --prefix backend

# Create a local password file for the backend
echo 'APP_PASSWORD=yourpassword' > backend/.dev.vars

# Apply the database schema locally
cd backend && npx wrangler d1 migrations apply threadweaver-db --local
```

### Run

```bash
# From the repo root — starts frontend (port 5173) and backend (port 8787) together
npm run dev
```

Open http://localhost:5173. The frontend proxies `/api/*` to the backend automatically.

### Tests

```bash
# Frontend unit tests
npm test --prefix frontend

# Backend unit tests
npm test --prefix backend
```

---

## Deployment

The backend (Worker) and frontend (Pages) are deployed separately. The frontend proxies `/api/*` to the Worker via a Cloudflare Service Binding.

### First-time setup

**1. Login to Cloudflare**
```bash
cd backend && npx wrangler login
```

**2. Create the production D1 database**
```bash
npx wrangler d1 create threadweaver-db
```
Copy the `database_id` from the output and update `backend/wrangler.toml`.

**3. Apply the schema**
```bash
npx wrangler d1 execute threadweaver-db --remote --command "CREATE TABLE IF NOT EXISTS drafts (id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT 'Untitled', content TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);"
```

**4. Set the app password**
```bash
npx wrangler secret put APP_PASSWORD
```

**5. Deploy the backend Worker**
```bash
npx wrangler deploy
```

**6. Build and deploy the frontend**
```bash
cd ../frontend && npm run build
npx wrangler pages deploy dist --project-name threadweaver
```

**7. Wire the Service Binding (one-time, in the Cloudflare dashboard)**

Pages needs to know how to reach the Worker:

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. **Workers & Pages** → click your Pages project
3. **Settings** → **Functions** → **Service bindings**
4. Add binding: Variable name = `BACKEND`, Service = `threadweaver-backend`
5. Save, then redeploy: `npx wrangler pages deploy dist --project-name threadweaver`

### Subsequent deploys

```bash
# Backend
cd backend && npx wrangler deploy

# Frontend
cd frontend && npm run build && npx wrangler pages deploy dist --project-name threadweaver
```

---

## Project Structure

```
threadweaver/
├── frontend/               # Svelte + Vite app
│   ├── src/
│   │   ├── App.svelte
│   │   ├── lib/
│   │   │   ├── Editor.svelte
│   │   │   ├── Sidebar.svelte
│   │   │   ├── Login.svelte
│   │   │   ├── db.js               # IndexedDB service
│   │   │   ├── sync.js             # Offline sync queue
│   │   │   ├── chunks.js           # Thread splitting logic
│   │   │   ├── charCount.js        # Bluesky character counting
│   │   │   ├── filterDrafts.js     # Sidebar search
│   │   │   └── stores/
│   │   │       ├── drafts.svelte.js
│   │   │       └── network.svelte.js
│   │   └── __tests__/
│   └── functions/
│       └── api/[[path]].js         # Pages Function: proxies /api/* to Worker
├── backend/                # Cloudflare Worker
│   ├── src/
│   │   ├── index.js
│   │   ├── routes/
│   │   │   └── drafts.js
│   │   └── lib/
│   │       └── auth.js
│   ├── migrations/
│   │   └── 0001_create_drafts.sql
│   └── wrangler.toml
└── docs/
    ├── prd.md
    └── implementation-plan.md
```
