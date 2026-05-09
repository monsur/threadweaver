import { describe, test, expect } from 'vitest';
import { signCookie, verifyCookie, verifyPassword } from '../auth.js';

describe('signCookie / verifyCookie', () => {
  test('cookie signed with password verifies with same password', async () => {
    const cookie = await signCookie('mysecret');
    expect(await verifyCookie(cookie, 'mysecret')).toBe(true);
  });

  test('cookie signed with "abc" fails verification with "xyz"', async () => {
    const cookie = await signCookie('abc');
    expect(await verifyCookie(cookie, 'xyz')).toBe(false);
  });

  test('tampered cookie value fails verification', async () => {
    const cookie = await signCookie('mysecret');
    const tampered = cookie.slice(0, -4) + 'dead';
    expect(await verifyCookie(tampered, 'mysecret')).toBe(false);
  });

  test('cookie with past expiry fails verification', async () => {
    // Craft a valid cookie but with a timestamp 31 days in the past
    const password = 'mysecret';
    const oldTs = (Date.now() - 31 * 24 * 60 * 60 * 1000).toString();
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.digest('SHA-256', enc.encode(password));
    const key = await crypto.subtle.importKey(
      'raw', keyMaterial, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(oldTs));
    const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    const expiredCookie = `${oldTs}.${sigHex}`;
    expect(await verifyCookie(expiredCookie, password)).toBe(false);
  });

  test('malformed cookie with no dot returns false', async () => {
    expect(await verifyCookie('notavalidcookie', 'password')).toBe(false);
  });
});

describe('verifyPassword', () => {
  test('same password returns true', async () => {
    expect(await verifyPassword('correct', 'correct')).toBe(true);
  });

  test('wrong password returns false', async () => {
    expect(await verifyPassword('wrong', 'correct')).toBe(false);
  });
});
