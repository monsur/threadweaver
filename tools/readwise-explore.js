#!/usr/bin/env node
/**
 * Readwise Reader API explorer — edit the fetch call below and run to see raw output.
 *
 * Usage:
 *   READWISE_API_KEY=xxx READWISE_TAG=bluesky node tools/readwise-explore.js
 */

const API_KEY = process.env.READWISE_API_KEY;
const TAG = process.env.READWISE_TAG;

if (!API_KEY) {
  console.error('Error: READWISE_API_KEY env var is required');
  process.exit(1);
}

const url = new URL('https://readwise.io/api/v3/list');
// url.searchParams.set('category', 'article');  // remove to see all types
// url.searchParams.set('tag', TAG);   // server-side filter — unreliable

const res = await fetch(url.toString(), {
  headers: { Authorization: `Token ${API_KEY}` },
});

const data = await res.json();

// Client-side filter: keep only docs where tags[TAG] exists
if (TAG) {
  data.results = data.results.filter(doc => doc.tags?.[TAG]);
  console.error(`Client-side filtered to ${data.results.length} docs with tag "${TAG}"\n`);
}

console.log(JSON.stringify(data, null, 2));
