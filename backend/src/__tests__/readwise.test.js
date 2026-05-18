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
    ANTHROPIC_API_KEY: 'anthropic-test-key',
    LLM_MODEL: 'claude-opus-4-7',
    LLM_MAX_TOKENS: '1024',
    LLM_TEMPERATURE: '0.7',
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
  let i = 0;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
    if (!String(url).includes('readwise.io')) {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    const r = responses[i++] ?? responses[responses.length - 1];
    return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.json };
  }));
}

// Dispatches fetch mocks by URL pattern for multi-call routes (generate)
function mockGenerateFetch({ doc, llmText = 'post one\n\n\npost two', patchOk = true } = {}) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes('api.anthropic.com')) {
      return { ok: true, json: async () => ({ content: [{ type: 'text', text: llmText }] }) };
    }
    if (u.includes('/api/v3/update')) {
      return { ok: patchOk, json: async () => ({}) };
    }
    if (u.includes('/api/v3/list')) {
      return { ok: true, json: async () => ({ results: doc ? [doc] : [] }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  }));
}

const articlePage = (results, nextPageCursor = null) => ({
  count: results.length, nextPageCursor, results,
});

const makeDoc = (id, title = `Article ${id}`) => ({
  id, title, author: 'Author', url: `https://example.com/${id}`,
  tags: { bluesky: { name: 'bluesky' } },
});

const makeHighlight = (parentId, content) => ({
  id: `hl-${parentId}`, parent_id: parentId, category: 'highlight', content,
  url: null, title: null, author: null, tags: {}, source_url: null, notes: '',
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

// ── GET /api/readwise/highlights ─────────────────────────────────────────────

describe('GET /api/readwise/highlights', () => {
  test('returns 401 with no session cookie', async () => {
    const res = await worker.fetch(req('/api/readwise/highlights'), env);
    expect(res.status).toBe(401);
  });

  test('returns empty object when no highlights exist', async () => {
    mockReadwiseFetch([{ json: articlePage([]) }]);
    const res = await worker.fetch(await authedReq('/api/readwise/highlights'), env);
    expect(res.status).toBe(200);
    const { highlights } = await res.json();
    expect(highlights).toEqual({});
  });

  test('returns highlights grouped by parent_id', async () => {
    mockReadwiseFetch([{
      json: articlePage([
        makeHighlight('doc-1', 'First point'),
        makeHighlight('doc-1', 'Second point'),
        makeHighlight('doc-2', 'Other article point'),
      ]),
    }]);
    const res = await worker.fetch(await authedReq('/api/readwise/highlights'), env);
    expect(res.status).toBe(200);
    const { highlights } = await res.json();
    expect(highlights['doc-1']).toEqual(['First point', 'Second point']);
    expect(highlights['doc-2']).toEqual(['Other article point']);
  });

  test('follows pagination cursors to collect all highlights', async () => {
    mockReadwiseFetch([
      { json: articlePage([makeHighlight('doc-1', 'Page one highlight')], 'cursor1') },
      { json: articlePage([makeHighlight('doc-1', 'Page two highlight')]) },
    ]);
    const res = await worker.fetch(await authedReq('/api/readwise/highlights'), env);
    const { highlights } = await res.json();
    expect(highlights['doc-1']).toEqual(['Page one highlight', 'Page two highlight']);
  });

  test('returns 502 when Readwise API fails', async () => {
    mockReadwiseFetch([{ ok: false, status: 500, json: {} }]);
    const res = await worker.fetch(await authedReq('/api/readwise/highlights'), env);
    expect(res.status).toBe(502);
  });
});

// ── POST /api/readwise/generate ───────────────────────────────────────────────

describe('POST /api/readwise/generate', () => {
  const doc = { id: 'doc-1', title: 'Great Article', author: 'Jane', url: 'https://example.com/1' };

  test('returns 401 with no session cookie', async () => {
    const res = await worker.fetch(req('/api/readwise/generate', 'POST', { article_id: 'doc-1' }), env);
    expect(res.status).toBe(401);
  });

  test('returns { title, content, notes } and calls PATCH to remove tag on success', async () => {
    mockGenerateFetch({ doc });
    const res = await worker.fetch(
      await authedReq('/api/readwise/generate', 'POST', { article_id: 'doc-1', highlights: ['Highlight one', 'Highlight two'] }),
      env,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('Great Article');
    expect(body.content).toBe('post one\n\n\npost two');
    expect(body.notes).toContain('https://example.com/1');

    const calls = vi.mocked(global.fetch).mock.calls.map(c => String(c[0]));
    expect(calls.some(u => u.includes('/api/v3/update'))).toBe(true);
  });

  test('notes contains source URL and formatted highlight list', async () => {
    mockGenerateFetch({ doc });
    const res = await worker.fetch(
      await authedReq('/api/readwise/generate', 'POST', { article_id: 'doc-1', highlights: ['Point A', 'Point B'] }),
      env,
    );
    const { notes } = await res.json();
    expect(notes).toBe('Source: https://example.com/1\n\nHighlights:\n- Point A\n- Point B');
  });

  test('returns 500 and does NOT call PATCH when LLM fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('api.anthropic.com')) return { ok: false, status: 500, json: async () => ({}) };
      if (u.includes('/api/v3/list'))      return { ok: true, json: async () => ({ results: [doc] }) };
      return { ok: false, json: async () => ({}) };
    }));
    const res = await worker.fetch(
      await authedReq('/api/readwise/generate', 'POST', { article_id: 'doc-1', highlights: [] }),
      env,
    );
    expect(res.status).toBe(500);
    const calls = vi.mocked(global.fetch).mock.calls.map(c => String(c[0]));
    expect(calls.some(u => u.includes('/api/v3/update'))).toBe(false);
  });

  test('still returns generated content when tag removal fails', async () => {
    mockGenerateFetch({ doc, patchOk: false });
    const res = await worker.fetch(await authedReq('/api/readwise/generate', 'POST', { article_id: 'doc-1' }), env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content).toBe('post one\n\n\npost two');
    expect(body.warning).toBeDefined();
  });
});
