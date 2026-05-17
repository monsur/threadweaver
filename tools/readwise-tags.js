#!/usr/bin/env node
/**
 * Lists all tags from Readwise Reader via GET /api/v3/tags/
 *
 * Usage:
 *   READWISE_API_KEY=xxx node tools/readwise-tags.js
 */

const API_KEY = process.env.READWISE_API_KEY;
if (!API_KEY) {
  console.error('Error: READWISE_API_KEY env var is required');
  process.exit(1);
}

const res = await fetch('https://readwise.io/api/v3/tags/', {
  headers: { Authorization: `Token ${API_KEY}` },
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));
