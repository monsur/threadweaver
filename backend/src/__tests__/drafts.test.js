import { describe, test, expect, beforeEach } from 'vitest';
import worker from '../index.js';
import { createD1Mock } from '../test-utils/d1-mock.js';

let db;
let env;

beforeEach(() => {
  db = createD1Mock();
  env = { APP_PASSWORD: 'testpassword', DB: db };
});

// ── helpers ──────────────────────────────────────────────────────────────────

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

// ── GET /api/drafts ───────────────────────────────────────────────────────────

describe('GET /api/drafts', () => {
  test('returns 200 with empty array when no drafts exist', async () => {
    const res = await worker.fetch(await authedReq('/api/drafts'), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('returns drafts sorted by updated_at descending', async () => {
    // Create two drafts with different timestamps
    await worker.fetch(await authedReq('/api/drafts', 'POST', { title: 'First' }), env);
    await new Promise(r => setTimeout(r, 5)); // ensure distinct timestamps
    await worker.fetch(await authedReq('/api/drafts', 'POST', { title: 'Second' }), env);

    const res = await worker.fetch(await authedReq('/api/drafts'), env);
    const drafts = await res.json();
    expect(drafts).toHaveLength(2);
    expect(drafts[0].title).toBe('Second');
    expect(drafts[1].title).toBe('First');
  });

  test('returns 401 without a valid session cookie', async () => {
    const res = await worker.fetch(req('/api/drafts'), env);
    expect(res.status).toBe(401);
  });
});

// ── POST /api/drafts ──────────────────────────────────────────────────────────

describe('POST /api/drafts', () => {
  test('creates draft with provided fields, returns 201 with full object', async () => {
    const res = await worker.fetch(
      await authedReq('/api/drafts', 'POST', { title: 'My Draft', content: 'hello' }),
      env
    );
    expect(res.status).toBe(201);
    const draft = await res.json();
    expect(draft.id).toBeTruthy();
    expect(draft.title).toBe('My Draft');
    expect(draft.content).toBe('hello');
    expect(draft.notes).toBe('');
    expect(draft.created_at).toBeTypeOf('number');
    expect(draft.updated_at).toBeTypeOf('number');
  });

  test('creates draft with no body, returns 201 with defaults', async () => {
    const res = await worker.fetch(await authedReq('/api/drafts', 'POST'), env);
    expect(res.status).toBe(201);
    const draft = await res.json();
    expect(draft.title).toBe('Untitled');
    expect(draft.content).toBe('');
    expect(draft.notes).toBe('');
  });

  test('returns 401 without a valid session cookie', async () => {
    const res = await worker.fetch(req('/api/drafts', 'POST', { title: 'x' }), env);
    expect(res.status).toBe(401);
  });
});

// ── GET /api/drafts/:id ───────────────────────────────────────────────────────

describe('GET /api/drafts/:id', () => {
  test('returns 200 with the correct draft', async () => {
    const created = await (await worker.fetch(
      await authedReq('/api/drafts', 'POST', { title: 'Find me' }), env
    )).json();

    const res = await worker.fetch(await authedReq(`/api/drafts/${created.id}`), env);
    expect(res.status).toBe(200);
    const draft = await res.json();
    expect(draft.id).toBe(created.id);
    expect(draft.title).toBe('Find me');
  });

  test('returns 404 for an unknown id', async () => {
    const res = await worker.fetch(await authedReq('/api/drafts/no-such-id'), env);
    expect(res.status).toBe(404);
  });

  test('returns 401 without a valid session cookie', async () => {
    const res = await worker.fetch(req('/api/drafts/any-id'), env);
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/drafts/:id ───────────────────────────────────────────────────────

describe('PUT /api/drafts/:id', () => {
  test('updates content only, other fields unchanged, updated_at bumped', async () => {
    const created = await (await worker.fetch(
      await authedReq('/api/drafts', 'POST', { title: 'Original', content: 'old' }), env
    )).json();

    await new Promise(r => setTimeout(r, 5));
    const res = await worker.fetch(
      await authedReq(`/api/drafts/${created.id}`, 'PUT', { content: 'new' }),
      env
    );
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.title).toBe('Original');
    expect(updated.content).toBe('new');
    expect(updated.updated_at).toBeGreaterThan(created.updated_at);
  });

  test('updates all fields at once', async () => {
    const created = await (await worker.fetch(
      await authedReq('/api/drafts', 'POST', {}), env
    )).json();

    const res = await worker.fetch(
      await authedReq(`/api/drafts/${created.id}`, 'PUT', { title: 'New', content: 'c', notes: 'n' }),
      env
    );
    const updated = await res.json();
    expect(updated.title).toBe('New');
    expect(updated.content).toBe('c');
    expect(updated.notes).toBe('n');
  });

  test('returns 404 for unknown id', async () => {
    const res = await worker.fetch(
      await authedReq('/api/drafts/no-such-id', 'PUT', { title: 'x' }), env
    );
    expect(res.status).toBe(404);
  });

  test('returns 401 without a valid session cookie', async () => {
    const res = await worker.fetch(req('/api/drafts/any-id', 'PUT', { title: 'x' }), env);
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/drafts/:id ────────────────────────────────────────────────────

describe('DELETE /api/drafts/:id', () => {
  test('deletes the draft, subsequent GET returns 404', async () => {
    const created = await (await worker.fetch(
      await authedReq('/api/drafts', 'POST', {}), env
    )).json();

    const del = await worker.fetch(
      await authedReq(`/api/drafts/${created.id}`, 'DELETE'), env
    );
    expect(del.status).toBe(204);

    const get = await worker.fetch(await authedReq(`/api/drafts/${created.id}`), env);
    expect(get.status).toBe(404);
  });

  test('returns 404 for unknown id', async () => {
    const res = await worker.fetch(
      await authedReq('/api/drafts/no-such-id', 'DELETE'), env
    );
    expect(res.status).toBe(404);
  });

  test('returns 401 without a valid session cookie', async () => {
    const res = await worker.fetch(req('/api/drafts/any-id', 'DELETE'), env);
    expect(res.status).toBe(401);
  });
});
