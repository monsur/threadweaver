#!/usr/bin/env node
/**
 * Fetch highlights for a v3 document ID via the v2 highlights API using source_url.
 *
 * Usage:
 *   READWISE_API_KEY=xxx node tools/readwise-highlights.js <v3-doc-id>
 */

const API_KEY = process.env.READWISE_API_KEY;
const DOC_ID = process.argv[2];

if (!API_KEY) { console.error('Error: READWISE_API_KEY env var is required'); process.exit(1); }
if (!DOC_ID)  { console.error('Error: pass a v3 document id as the first argument'); process.exit(1); }

async function rw(url) {
  const res = await fetch(url, { headers: { Authorization: `Token ${API_KEY}` } });
  return { status: res.status, body: await res.json() };
}

// Step 1: get the document's source_url from v3
const detail = await rw(`https://readwise.io/api/v3/list?id=${DOC_ID}`);
const doc = detail.body.results?.[0];
const sourceUrl = doc?.source_url;
console.log(`source_url: ${sourceUrl}\n`);

// Step 2: fetch v2 highlights filtered by source_url
console.log('── v2 highlights?source_url= ───────────────────────────────────');
const bySourceUrl = await rw(`https://readwise.io/api/v2/highlights/?source_url=${encodeURIComponent(sourceUrl)}&page_size=50`);
console.log(`Status: ${bySourceUrl.status}`);
console.log(JSON.stringify(bySourceUrl.body, null, 2));

// Step 3: fetch v2 books filtered by source_url (to get numeric book_id)
console.log('\n── v2 books?source_url= ────────────────────────────────────────');
const books = await rw(`https://readwise.io/api/v2/books/?source_url=${encodeURIComponent(sourceUrl)}`);
console.log(`Status: ${books.status}`);
console.log(JSON.stringify(books.body, null, 2));
