const COOKIE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ENC = new TextEncoder();

async function deriveKey(password, usages) {
  const keyMaterial = await crypto.subtle.digest('SHA-256', ENC.encode(password));
  return crypto.subtle.importKey(
    'raw', keyMaterial,
    { name: 'HMAC', hash: 'SHA-256' },
    false, usages
  );
}

function toHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  return new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)));
}

export async function signCookie(password) {
  const timestamp = Date.now().toString();
  const key = await deriveKey(password, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, ENC.encode(timestamp));
  return `${timestamp}.${toHex(sig)}`;
}

export async function verifyCookie(cookieValue, password) {
  const dot = cookieValue.indexOf('.');
  if (dot === -1) return false;

  const timestamp = cookieValue.slice(0, dot);
  const sigHex = cookieValue.slice(dot + 1);

  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Date.now() - ts > COOKIE_TTL_MS) return false;

  try {
    const key = await deriveKey(password, ['verify']);
    return await crypto.subtle.verify('HMAC', key, fromHex(sigHex), ENC.encode(timestamp));
  } catch {
    return false;
  }
}

// Constant-time password comparison via HMAC cross-verification.
export async function verifyPassword(submitted, expected) {
  const nonce = ENC.encode('threadweaver-auth-v1');
  const [submittedKey, expectedKey] = await Promise.all([
    deriveKey(submitted, ['sign', 'verify']),
    deriveKey(expected, ['sign']),
  ]);
  const mac = await crypto.subtle.sign('HMAC', expectedKey, nonce);
  return crypto.subtle.verify('HMAC', submittedKey, mac, nonce);
}

// Returns the raw cookie value string if the session is valid, null otherwise.
export async function getSession(request, password) {
  const cookieHeader = request.headers.get('Cookie') ?? '';
  const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  if (!match) return null;
  const valid = await verifyCookie(match[1], password);
  return valid ? match[1] : null;
}
