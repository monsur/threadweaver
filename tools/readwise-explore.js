#!/usr/bin/env node
/**
 * Readwise Reader API explorer — edit the fetch call below and run to see raw output.
 *
 * Usage:
 *   READWISE_API_KEY=xxx node tools/readwise-explore.js
 */

const API_KEY = process.env.READWISE_API_KEY;
if (!API_KEY) {
  console.error('Error: READWISE_API_KEY env var is required');
  process.exit(1);
}

const url = new URL('https://readwise.io/api/v3/list');
url.searchParams.set('category', 'article');
// url.searchParams.set('location', 'new');
// url.searchParams.set('tags', 'bluesky');
// url.searchParams.set('tag', 'bluesky');
// url.searchParams.set('withTags', 'bluesky');

const res = await fetch(url.toString(), {
  headers: { Authorization: `Token ${API_KEY}` },
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));
