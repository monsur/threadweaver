#!/usr/bin/env node
/**
 * Readwise Reader API explorer
 *
 * Usage:
 *   READWISE_API_KEY=xxx node tools/readwise-explore.js
 *   READWISE_API_KEY=xxx node tools/readwise-explore.js --tag bluesky
 *   READWISE_API_KEY=xxx node tools/readwise-explore.js --tag bluesky --location new
 *   READWISE_API_KEY=xxx node tools/readwise-explore.js --id <doc-id>
 *   READWISE_API_KEY=xxx node tools/readwise-explore.js --raw        # dump full JSON
 *   READWISE_API_KEY=xxx node tools/readwise-explore.js --highlights <doc-id>
 */

const API_KEY = process.env.READWISE_API_KEY;
if (!API_KEY) {
  console.error('Error: READWISE_API_KEY env var is required');
  process.exit(1);
}

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : null;
};
const has = (name) => args.includes(name);

const tag      = flag('--tag');
const location = flag('--location');
const id       = flag('--id');
const rawMode  = has('--raw');
const highlightsId = flag('--highlights');

async function rw(url) {
  const res = await fetch(url, { headers: { Authorization: `Token ${API_KEY}` } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

// ── highlights (v2) ──────────────────────────────────────────────────────────

if (highlightsId) {
  console.log(`\nFetching highlights for book_id=${highlightsId} (v2 API)...\n`);
  const url = `https://readwise.io/api/v2/highlights/?book_id=${encodeURIComponent(highlightsId)}&page_size=100`;
  const data = await rw(url);
  console.log(`Count: ${data.count}`);
  if (rawMode) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    (data.results ?? []).forEach((h, i) => {
      console.log(`\n[${i + 1}] ${h.text}`);
      console.log(`    book_id=${h.book_id}  id=${h.id}`);
    });
  }
  process.exit(0);
}

// ── list (v3) ────────────────────────────────────────────────────────────────

const url = new URL('https://readwise.io/api/v3/list');
url.searchParams.set('category', 'article');
if (id)       url.searchParams.set('id', id);
if (location) url.searchParams.set('location', location);
// Uncomment to try server-side tag params if you want to experiment:
// url.searchParams.set('tags', tag);
// url.searchParams.set('tag', tag);
// url.searchParams.set('withTags', tag);

console.log(`\nGET ${url}\n`);

const data = await rw(url.toString());

console.log(`Total returned: ${data.results?.length ?? 0}  (nextPageCursor: ${data.nextPageCursor ?? 'none'})\n`);

if (rawMode) {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

const results = data.results ?? [];

// If --tag, show both filtered and unfiltered counts so we can see what works
if (tag) {
  const tagged = results.filter(d => d.tags?.[tag]);
  console.log(`With client-side filter tags["${tag}"]: ${tagged.length} / ${results.length} match\n`);

  console.log('--- Matching articles ---');
  tagged.forEach(d => printDoc(d));

  if (tagged.length < results.length) {
    console.log('\n--- Non-matching articles (first 5) ---');
    results.filter(d => !d.tags?.[tag]).slice(0, 5).forEach(d => printDoc(d));
  }
} else {
  results.forEach(d => printDoc(d));
}

function printDoc(d) {
  const tagList = Object.keys(d.tags ?? {}).join(', ') || '(none)';
  console.log(`  [${d.id}]`);
  console.log(`  Title  : ${d.title}`);
  console.log(`  URL    : ${d.url}`);
  console.log(`  Tags   : ${tagList}`);
  console.log(`  Location: ${d.location}`);
  console.log();
}
