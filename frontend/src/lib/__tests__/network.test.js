import { describe, test, expect, beforeEach } from 'vitest';
import { network } from '../stores/network.svelte.js';

beforeEach(() => {
  // Reset to online state between tests
  window.dispatchEvent(new Event('online'));
});

describe('network store', () => {
  test('initializes from navigator.onLine (true in jsdom)', () => {
    expect(network.online).toBe(true);
  });

  test('sets online to false on offline event', () => {
    window.dispatchEvent(new Event('offline'));
    expect(network.online).toBe(false);
  });

  test('sets online to true on online event after going offline', () => {
    window.dispatchEvent(new Event('offline'));
    window.dispatchEvent(new Event('online'));
    expect(network.online).toBe(true);
  });
});
