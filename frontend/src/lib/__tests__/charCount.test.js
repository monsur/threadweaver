import { describe, test, expect } from 'vitest';
import { countChars, getChunkDetails } from '../charCount.js';

describe('countChars', () => {
  test('plain text counts each character', () => {
    expect(countChars('hello')).toBe(5);
  });

  test('empty string returns 0', () => {
    expect(countChars('')).toBe(0);
  });

  test('URL counts as 20 regardless of actual length', () => {
    expect(countChars('https://example.com')).toBe(20);
    expect(countChars('https://a-very-long-url-that-is-way-more-than-twenty-characters.com/path')).toBe(20);
  });

  test('mention counts as 15 regardless of actual length', () => {
    expect(countChars('@a')).toBe(15);
    expect(countChars('@user.bsky.social')).toBe(15);
  });

  test('mixed text with URL and mention counts correctly', () => {
    // "Check " (6) + URL (20) + " and " (5) + mention (15) = 46
    expect(countChars('Check https://example.com and @user.bsky.social')).toBe(46);
  });

  test('string at exactly 300 returns 300', () => {
    expect(countChars('a'.repeat(300))).toBe(300);
  });

  test('string over 300 returns correct count', () => {
    expect(countChars('a'.repeat(305))).toBe(305);
  });

  test('newlines count as characters', () => {
    expect(countChars('a\nb')).toBe(3);
  });
});

describe('getChunkDetails', () => {
  test('safe text and no overage for short content', () => {
    const { isOverage, safeText, overageText } = getChunkDetails('hello');
    expect(isOverage).toBe(false);
    expect(safeText).toBe('hello');
    expect(overageText).toBe('');
  });

  test('splits safe and overage text at the 300-char boundary', () => {
    const text = 'a'.repeat(305);
    const { isOverage, safeText, overageText } = getChunkDetails(text);
    expect(isOverage).toBe(true);
    expect(safeText).toBe('a'.repeat(300));
    expect(overageText).toBe('a'.repeat(5));
  });

  test('URL in safe zone keeps full URL text in safeText', () => {
    const { safeText, overageText } = getChunkDetails('https://example.com');
    expect(safeText).toBe('https://example.com');
    expect(overageText).toBe('');
  });

  test('mention in safe zone keeps full mention text in safeText', () => {
    const { safeText, overageText } = getChunkDetails('@user.bsky.social');
    expect(safeText).toBe('@user.bsky.social');
    expect(overageText).toBe('');
  });
});
