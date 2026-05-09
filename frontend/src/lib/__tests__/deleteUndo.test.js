import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { store, deleteDraftWithUndo, _reset } from '../stores/drafts.svelte.js';
import { put as dbPut, _resetDb } from '../db.js';

const sampleDraft = {
  id: '1', title: 'Test Draft', content: 'hello',
  notes: '', created_at: 1000, updated_at: 1000,
};

beforeEach(async () => {
  global.indexedDB = new IDBFactory();
  _resetDb();
  _reset();
  store.drafts = [{ ...sampleDraft }];
  store.activeDraftId = '1';
  await dbPut({ ...sampleDraft }); // IDB setup must finish before fake timers start
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
});

afterEach(() => {
  _reset();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('deleteDraftWithUndo', () => {
  test('optimistically removes from store and sets pendingDelete', () => {
    deleteDraftWithUndo('1');

    expect(store.drafts).toHaveLength(0);
    expect(store.activeDraftId).toBeNull();
    expect(store.pendingDelete).not.toBeNull();
    expect(store.pendingDelete.draft.id).toBe('1');
  });

  test('switches active to next draft when deleting the active one', () => {
    const other = { ...sampleDraft, id: '2', updated_at: 500 };
    store.drafts = [{ ...sampleDraft }, other];

    deleteDraftWithUndo('1');

    expect(store.activeDraftId).toBe('2');
  });

  test('undo restores draft to store, cancels DELETE', () => {
    deleteDraftWithUndo('1');
    store.pendingDelete.undo();

    expect(store.drafts).toHaveLength(1);
    expect(store.drafts[0].id).toBe('1');
    expect(store.activeDraftId).toBe('1');
    expect(store.pendingDelete).toBeNull();

    vi.runAllTimers();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('after 30s DELETE is called then a blank draft is auto-created', async () => {
    const newDraft = {
      id: 'auto', title: 'Untitled', content: '', notes: '', created_at: 2000, updated_at: 2000,
    };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true })                             // DELETE
      .mockResolvedValueOnce({ ok: true, json: async () => newDraft }) // POST auto-create
    );

    deleteDraftWithUndo('1');
    await vi.runAllTimersAsync();

    const calls = global.fetch.mock.calls;
    expect(calls[0][0]).toBe('/api/drafts/1');
    expect(calls[0][1]).toMatchObject({ method: 'DELETE' });
    expect(calls[1][1]).toMatchObject({ method: 'POST' });
    expect(store.pendingDelete).toBeNull();
    expect(store.drafts[0].id).toBe('auto');
  });

  test('no-op for unknown id', () => {
    deleteDraftWithUndo('no-such-id');
    expect(store.drafts).toHaveLength(1);
    expect(store.pendingDelete).toBeNull();
  });
});
