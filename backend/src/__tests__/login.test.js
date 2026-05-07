import { describe, test, expect } from 'vitest';
import worker from '../index.js';
import { createD1Mock } from '../test-utils/d1-mock.js';

const env = { APP_PASSWORD: 'testpassword', DB: createD1Mock() };

function req(path, method = 'GET', body = null, cookies = '') {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (cookies) headers.set('Cookie', cookies);
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });
}

async function loginCookie() {
  const res = await worker.fetch(req('/api/login', 'POST', { password: 'testpassword' }), env);
  const raw = res.headers.get('Set-Cookie');
  return raw.match(/session=([^;]+)/)[1];
}

describe('POST /api/login', () => {
  test('correct password returns 200 with Set-Cookie', async () => {
    const res = await worker.fetch(req('/api/login', 'POST', { password: 'testpassword' }), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toMatch(/session=/);
  });

  test('wrong password returns 401, no cookie', async () => {
    const res = await worker.fetch(req('/api/login', 'POST', { password: 'wrong' }), env);
    expect(res.status).toBe(401);
    expect(res.headers.get('Set-Cookie')).toBeNull();
  });

  test('missing password field returns 400', async () => {
    const res = await worker.fetch(req('/api/login', 'POST', {}), env);
    expect(res.status).toBe(400);
  });

  test('invalid JSON body returns 400', async () => {
    const r = new Request('http://localhost/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await worker.fetch(r, env);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/me', () => {
  test('valid cookie returns 200', async () => {
    const cookie = await loginCookie();
    const res = await worker.fetch(req('/api/me', 'GET', null, `session=${cookie}`), env);
    expect(res.status).toBe(200);
  });

  test('no cookie returns 401', async () => {
    const res = await worker.fetch(req('/api/me'), env);
    expect(res.status).toBe(401);
  });

  test('tampered cookie returns 401', async () => {
    const cookie = await loginCookie();
    const tampered = cookie.slice(0, -4) + 'dead';
    const res = await worker.fetch(req('/api/me', 'GET', null, `session=${tampered}`), env);
    expect(res.status).toBe(401);
  });
});

describe('auth middleware', () => {
  test('GET /api/drafts without cookie returns 401', async () => {
    const res = await worker.fetch(req('/api/drafts'), env);
    expect(res.status).toBe(401);
  });

  test('GET /api/drafts with valid cookie returns 200', async () => {
    const cookie = await loginCookie();
    const res = await worker.fetch(req('/api/drafts', 'GET', null, `session=${cookie}`), env);
    expect(res.status).toBe(200);
  });
});
