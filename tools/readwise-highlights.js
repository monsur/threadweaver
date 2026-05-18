#!/usr/bin/env node
/**
 * Fetch highlights for a Readwise Reader document by filtering the v3 list
 * endpoint for documents whose parent_id matches the given doc ID.
 *
 * Usage:
 *   node tools/readwise-highlights.js --id=<v3-doc-id>
 */

const API_KEY = process.env.READWISE_API_KEY;
if (!API_KEY) { console.error('Error: READWISE_API_KEY env var is required'); process.exit(1); }

const idArg = process.argv.slice(2).find(a => a.startsWith('--id='));
if (!idArg) { console.error('Error: --id=<doc-id> is required'); process.exit(1); }
const DOC_ID = idArg.slice('--id='.length);

async function fetchPage(cursor, retries = 3) {
  const url = new URL('https://readwise.io/api/v3/list');
  url.searchParams.set('category', 'highlight');
  if (cursor) url.searchParams.set('pageCursor', cursor);
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url.toString(), { headers: { Authorization: `Token ${API_KEY}` } });
    if (res.status === 429) {
      if (attempt === retries) { console.error('Rate limited, giving up'); process.exit(1); }
      const wait = parseInt(res.headers.get('Retry-After') ?? '5', 10);
      console.error(`Rate limited, retrying in ${wait}s...`);
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) { console.error(`API error: ${res.status}`); process.exit(1); }
    return res.json();
  }
}

const highlights = [];
let cursor = null;

do {
  const page = await fetchPage(cursor);
  for (const doc of (page.results ?? [])) {
    if (doc.parent_id === DOC_ID) {
      highlights.push(doc);
    }
  }
  cursor = page.nextPageCursor ?? null;
} while (cursor);

console.log(JSON.stringify(highlights, null, 2));
