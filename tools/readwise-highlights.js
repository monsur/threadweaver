#!/usr/bin/env node
/**
 * Test Readwise highlights fetching strategies for a given document.
 *
 * Usage:
 *   READWISE_API_KEY=xxx node tools/readwise-highlights.js <v3-doc-id>
 *
 * Example:
 *   READWISE_API_KEY=xxx node tools/readwise-highlights.js 01kp35aw9x3h4de7eppger4qze
 */

const API_KEY = process.env.READWISE_API_KEY;
const DOC_ID = process.argv[2];

if (!API_KEY) { console.error('Error: READWISE_API_KEY env var is required'); process.exit(1); }
if (!DOC_ID)  { console.error('Error: pass a v3 document id as the first argument'); process.exit(1); }

async function rw(url) {
  const res = await fetch(url, { headers: { Authorization: `Token ${API_KEY}` } });
  return { status: res.status, body: await res.json() };
}

// Strategy 1: v2 highlights by book_id = v3 doc id
console.log('\n── Strategy 1: v2 highlights?book_id=<v3-id> ──────────────────');
const s1 = await rw(`https://readwise.io/api/v2/highlights/?book_id=${DOC_ID}&page_size=10`);
console.log(`Status: ${s1.status}`);
console.log(JSON.stringify(s1.body, null, 2));

// Strategy 2: v2 books filtered by source_url (need to know source_url first)
console.log('\n── Strategy 2: v3 document detail ─────────────────────────────');
const s2 = await rw(`https://readwise.io/api/v3/list?id=${DOC_ID}`);
console.log(`Status: ${s2.status}`);
console.log(JSON.stringify(s2.body, null, 2));  // full body — highlights may be extra results
const doc = s2.body.results?.[0];

if (doc?.source_url) {
  // Strategy 3: v2 highlights by source_url
  console.log('\n── Strategy 3: v2 highlights?source_url=<source_url> ──────────');
  const s3 = await rw(`https://readwise.io/api/v2/highlights/?source_url=${encodeURIComponent(doc.source_url)}&page_size=10`);
  console.log(`Status: ${s3.status}`);
  console.log(JSON.stringify(s3.body, null, 2));

  // Strategy 4: v2 books list to find numeric book_id by source url
  console.log('\n── Strategy 4: v2 books list ───────────────────────────────────');
  const s4 = await rw(`https://readwise.io/api/v2/books/?source_url=${encodeURIComponent(doc.source_url)}`);
  console.log(`Status: ${s4.status}`);
  console.log(JSON.stringify(s4.body, null, 2));
}
