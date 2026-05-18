#!/usr/bin/env node
/**
 * Readwise Reader list API explorer — pass query params as CLI flags.
 *
 * Usage:
 *   READWISE_API_KEY=xxx node tools/readwise-list.js [--param=value ...]
 *
 * Supported flags (all optional):
 *   --id=<id>
 *   --updatedAfter=<ISO8601>       e.g. 2024-01-01T00:00:00Z
 *   --location=<new|later|archive|feed>
 *   --category=<article|email|rss|highlight|note|pdf|epub|tweet|video>
 *   --tag=<tag>
 *   --limit=<1-100>
 *   --pageCursor=<cursor>
 *   --withHtmlContent=<true|false>
 *   --withRawSourceUrl=<true|false>
 */

const API_KEY = process.env.READWISE_API_KEY;

if (!API_KEY) {
  console.error('Error: READWISE_API_KEY env var is required');
  process.exit(1);
}

const args = {};
for (const arg of process.argv.slice(2)) {
  const match = arg.match(/^--([^=]+)=(.*)$/);
  if (match) {
    args[match[1]] = match[2];
  } else {
    console.error(`Unknown argument: ${arg}`);
    process.exit(1);
  }
}

const url = new URL('https://readwise.io/api/v3/list/');
for (const [key, value] of Object.entries(args)) {
  url.searchParams.set(key, value);
}

console.error(`GET ${url.toString()}\n`);

const res = await fetch(url.toString(), {
  headers: { Authorization: `Token ${API_KEY}` },
});

const data = await res.json();
console.log(JSON.stringify(data, null, 2));
