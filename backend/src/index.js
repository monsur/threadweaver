import { signCookie, verifyPassword, getSession } from './lib/auth.js';

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (err) {
      console.log(`[error] Unhandled exception: ${request.method} ${request.url}`);
      console.log(err?.stack ?? err);
      return json({ error: 'Internal server error', detail: err?.message }, 500);
    }
  },
};

async function handle(request, env) {
  const { pathname } = new URL(request.url);

  // POST /api/login — no auth required
  if (pathname === '/api/login' && request.method === 'POST') {
    if (!env.APP_PASSWORD) {
      console.log('[auth] APP_PASSWORD is not set — add APP_PASSWORD=yourpassword to backend/.dev.vars');
      return json({ error: 'Server misconfigured: APP_PASSWORD not set' }, 500);
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
    if (!body?.password) return json({ error: 'Missing password' }, 400);

    const ok = await verifyPassword(body.password, env.APP_PASSWORD);
    if (!ok) return json({ error: 'Incorrect password' }, 401);

    const cookieValue = await signCookie(env.APP_PASSWORD);
    return json({ ok: true }, 200, {
      'Set-Cookie': `session=${cookieValue}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${30 * 24 * 60 * 60}`,
    });
  }

  // All other /api/* routes require a valid session
  if (pathname.startsWith('/api/')) {
    const session = await getSession(request, env.APP_PASSWORD ?? '');
    if (!session) return json({ error: 'Unauthorized' }, 401);

    // GET /api/me
    if (pathname === '/api/me' && request.method === 'GET') {
      return json({ ok: true });
    }

    return json({ error: 'Not found' }, 404);
  }

  return new Response('Threadweaver API', { status: 200 });
}
