#!/usr/bin/env node
/**
 * Fetch full v3 document detail (including child highlights) for a given doc ID.
 *
 * Usage:
 *   READWISE_API_KEY=xxx node tools/readwise-highlights.js <v3-doc-id>
 */

const API_KEY = process.env.READWISE_API_KEY;
const DOC_ID = process.argv[2];

if (!API_KEY) { console.error('Error: READWISE_API_KEY env var is required'); process.exit(1); }
if (!DOC_ID)  { console.error('Error: pass a v3 document id as the first argument'); process.exit(1); }

const res = await fetch(`https://readwise.io/api/v3/list?id=${DOC_ID}`, {
  headers: { Authorization: `Token ${API_KEY}` },
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));
