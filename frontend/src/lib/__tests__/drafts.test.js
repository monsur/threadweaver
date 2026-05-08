import { describe, test, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { store, loadDrafts, createDraft, updateDraft, setActive, _reset } from '../stores/drafts.svelte.js';
import { get as dbGet, _resetDb } from '../db.js';

beforeEach(() => {
  global.indexedDB = new IDBFactory();
  _resetDb();
  _reset();
  vi.restoreAllMocks();
});

const makeDraft = (id, extra = {}) => ({
  id, title: `Draft ${id}`, content: '', notes: '',
  created_at: 1000, updated_at: 1000, ...extra,
});

// Echo mock: returns whatever body was POSTed/PUT
function mockEcho(ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url, opts) => {
    const body = opts?.body ? JSON.parse(opts.body) : {};
    return Promise.resolve({ ok, json: async () => body });
  }));
}

function mockFetch(data, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok, json: async () => data,
  }));
}

// ── loadDrafts ────────────────────────────────────────────────────────────────

describe('loadDrafts', () => {
  test('populates store.drafts from API and sets activeDraftId to first', async () => {
    const drafts = [makeDraft('a', { updated_at: 2000 }), makeDraft('b', { updated_at: 1000 })];
    mockFetch(drafts);

    await loadDrafts();

    expect(store.drafts).toHaveLength(2);
    expect(store.drafts[0].id).toBe('a');
    expect(store.activeDraftId).toBe('a');
  });

  test('shows IDB data immediately before API responds', async () => {
    const { put } = await import('../db.js');
    await put(makeDraft('cached', { updated_at: 999 }));

    let storeSnapshotBeforeApi;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      storeSnapshotBeforeApi = [...store.drafts];
      return { ok: true, json: async () => [] };
    }));

    await loadDrafts();

    expect(storeSnapshotBeforeApi[0].id).toBe('cached');
  });

  test('does not overwrite existing activeDraftId', async () => {
    store.activeDraftId = 'b';
    mockFetch([makeDraft('a'), makeDraft('b')]);

    await loadDrafts();

    expect(store.activeDraftId).toBe('b');
  });

  test('does not update store on API error', async () => {
    mockFetch(null, false);
    await loadDrafts();
    expect(store.drafts).toHaveLength(0);
  });

  test('keeps cached data when offline', async () => {
    const { put } = await import('../db.js');
    await put(makeDraft('cached'));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await loadDrafts();

    expect(store.drafts[0].id).toBe('cached');
  });
});

// ── createDraft ───────────────────────────────────────────────────────────────

describe('createDraft', () => {
  test('adds draft to store and IDB, sets it active', async () => {
    mockEcho();
    store.drafts = [makeDraft('existing')];

    const result = await createDraft({ title: 'New' });

    expect(result.title).toBe('New');
    expect(store.drafts[0].id).toBe(result.id);
    expect(store.drafts).toHaveLength(2);
    expect(store.activeDraftId).toBe(result.id);
    expect(await dbGet(result.id)).toBeTruthy();
  });

  test('marks pendingSync when API fails', async () => {
    mockFetch(null, false);

    const result = await createDraft();

    // Draft still in store and IDB even though API failed
    expect(store.drafts[0].id).toBe(result.id);
    const stored = await dbGet(result.id);
    expect(stored.pendingSync).toBe(true);
    expect(stored.pendingSyncMethod).toBe('POST');
  });
});

// ── updateDraft ───────────────────────────────────────────────────────────────

describe('updateDraft', () => {
  test('optimistically updates store and IDB, then syncs server response', async () => {
    store.drafts = [makeDraft('1', { title: 'Old' }), makeDraft('2')];
    const server = { ...makeDraft('1', { title: 'New', updated_at: 5000 }) };
    mockFetch(server);

    await updateDraft('1', { title: 'New' });

    expect(store.drafts[0].title).toBe('New');
    expect(store.drafts[0].updated_at).toBe(5000);
    expect((await dbGet('1')).title).toBe('New');
  });

  test('marks pendingSync in IDB when API fails', async () => {
    store.drafts = [makeDraft('1')];
    const { put } = await import('../db.js');
    await put(makeDraft('1'));
    mockFetch(null, false);

    await updateDraft('1', { title: 'x' });

    expect((await dbGet('1')).pendingSync).toBe(true);
    // Store still has the optimistic update
    expect(store.drafts[0].title).toBe('x');
  });

  test('returns null when draft not in store', async () => {
    mockFetch(null, false);
    expect(await updateDraft('no-such', { title: 'x' })).toBeNull();
  });
});

// ── setActive ─────────────────────────────────────────────────────────────────

describe('setActive', () => {
  test('updates activeDraftId', () => {
    setActive('xyz');
    expect(store.activeDraftId).toBe('xyz');
  });
});
