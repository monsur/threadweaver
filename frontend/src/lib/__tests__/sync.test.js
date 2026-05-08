import { describe, test, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { syncPending } from '../sync.js';
import { get, put, _resetDb } from '../db.js';

beforeEach(() => {
  global.indexedDB = new IDBFactory();
  _resetDb();
  vi.restoreAllMocks();
});

const draft = (id, extra = {}) => ({
  id, title: 'T', content: 'c', notes: '', created_at: 1, updated_at: 1, ...extra,
});

describe('syncPending', () => {
  test('does nothing when no pending drafts', async () => {
    await put(draft('1'));
    vi.stubGlobal('fetch', vi.fn());

    await syncPending();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('retries PUT for pending update, clears flag on success', async () => {
    const server = { ...draft('1'), updated_at: 2 };
    await put({ ...draft('1'), pendingSync: true, pendingSyncMethod: 'PUT' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => server,
    }));

    await syncPending();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/drafts/1',
      expect.objectContaining({ method: 'PUT' })
    );
    const stored = await get('1');
    expect(stored.pendingSync).toBeFalsy();
    expect(stored.updated_at).toBe(2);
  });

  test('uses POST for pending create', async () => {
    const server = draft('local-1');
    await put({ ...draft('local-1'), pendingSync: true, pendingSyncMethod: 'POST' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => server,
    }));

    await syncPending();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/drafts',
      expect.objectContaining({ method: 'POST' })
    );
    expect((await get('local-1')).pendingSync).toBeFalsy();
  });

  test('leaves pendingSync set when API returns non-ok', async () => {
    await put({ ...draft('1'), pendingSync: true, pendingSyncMethod: 'PUT' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await syncPending();

    expect((await get('1')).pendingSync).toBe(true);
  });

  test('leaves pendingSync set on network error', async () => {
    await put({ ...draft('1'), pendingSync: true, pendingSyncMethod: 'PUT' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await syncPending();

    expect((await get('1')).pendingSync).toBe(true);
  });
});
