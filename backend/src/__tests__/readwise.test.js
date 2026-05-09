import { describe, test, expect, beforeEach, vi } from 'vitest';
import worker from '../index.js';
import { createD1Mock } from '../test-utils/d1-mock.js';

let env;

beforeEach(() => {
  env = {
    APP_PASSWORD: 'testpassword',
    DB: createD1Mock(),
    READWISE_API_KEY: 'rw-test-key',
    READWISE_TAG: 'bluesky',
  };
  vi.restoreAllMocks();
});

// ── helpers ───────────────────────────────────────────────────────────────────

function req(path, method = 'GET', body = null, cookies = '') {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (cookies) headers.set('Cookie', cookies);
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });
}

async function getSessionCookie() {
  const res = await worker.fetch(req('/api/login', 'POST', { password: 'testpassword' }), env);
  return res.headers.get('Set-Cookie').match(/session=([^;]+)/)[1];
}

async function authedReq(path, method = 'GET', body = null) {
  const cookie = await getSessionCookie();
  return req(path, method, body, `session=${cookie}`);
}

function mockReadwiseFetch(responses) {
  // responses is an array of { ok, json } objects returned in order
  let i = 0;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
    // Pass-through internal worker requests (login etc.) that don't hit readwise.io
    if (!String(url).includes('readwise.io')) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    const r = responses[i++] ?? responses[responses.length - 1];
    return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.json };
  }));
}

const articlePage = (results, nextPageCursor = null) => ({
  count: results.length, nextPageCursor, results,
});

const makeDoc = (id, title = `Article ${id}`) => ({
  id, title, author: 'Author', url: `https://example.com/${id}`,
});

// ── GET /api/readwise/articles ────────────────────────────────────────────────

describe('GET /api/readwise/articles', () => {
  test('returns 401 with no session cookie', async () => {
    const res = await worker.fetch(req('/api/readwise/articles'), env);
    expect(res.status).toBe(401);
  });

  test('returns article list on success', async () => {
    mockReadwiseFetch([
      { json: articlePage([makeDoc('a'), makeDoc('b')]) },
    ]);
    const res = await worker.fetch(await authedReq('/api/readwise/articles'), env);
    expect(res.status).toBe(200);
    const { articles } = await res.json();
    expect(articles).toHaveLength(2);
    expect(articles[0]).toMatchObject({ id: 'a', title: 'Article a', author: 'Author', url: 'https://example.com/a' });
  });

  test('follows pagination cursors to return all articles', async () => {
    mockReadwiseFetch([
      { json: articlePage([makeDoc('a')], 'cursor1') },
      { json: articlePage([makeDoc('b')]) },
    ]);
    const res = await worker.fetch(await authedReq('/api/readwise/articles'), env);
    const { articles } = await res.json();
    expect(articles).toHaveLength(2);
    expect(articles.map(a => a.id)).toEqual(['a', 'b']);
  });

  test('returns 502 when Readwise API fails', async () => {
    mockReadwiseFetch([{ ok: false, status: 500, json: {} }]);
    const res = await worker.fetch(await authedReq('/api/readwise/articles'), env);
    expect(res.status).toBe(502);
  });
});

// ── GET /api/readwise/articles/:id/highlights ─────────────────────────────────

describe('GET /api/readwise/articles/:id/highlights', () => {
  test('returns 401 with no session cookie', async () => {
    const res = await worker.fetch(req('/api/readwise/articles/abc/highlights'), env);
    expect(res.status).toBe(401);
  });

  test('returns array of highlight text strings on success', async () => {
    mockReadwiseFetch([{
      json: {
        count: 2,
        results: [
          { id: 1, text: 'First highlight', book_id: 'abc' },
          { id: 2, text: 'Second highlight', book_id: 'abc' },
        ],
      },
    }]);
    const res = await worker.fetch(await authedReq('/api/readwise/articles/abc/highlights'), env);
    expect(res.status).toBe(200);
    const { highlights } = await res.json();
    expect(highlights).toEqual(['First highlight', 'Second highlight']);
  });

  test('returns empty array when Readwise v2 returns no results', async () => {
    mockReadwiseFetch([{ json: { count: 0, results: [] } }]);
    const res = await worker.fetch(await authedReq('/api/readwise/articles/abc/highlights'), env);
    expect(res.status).toBe(200);
    const { highlights } = await res.json();
    expect(highlights).toEqual([]);
  });

  test('returns empty array when Readwise v2 call fails', async () => {
    mockReadwiseFetch([{ ok: false, status: 404, json: {} }]);
    const res = await worker.fetch(await authedReq('/api/readwise/articles/abc/highlights'), env);
    expect(res.status).toBe(200);
    const { highlights } = await res.json();
    expect(highlights).toEqual([]);
  });
});
