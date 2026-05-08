import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { store, deleteDraftWithUndo, _reset } from '../stores/drafts.svelte.js';

const sampleDraft = {
  id: '1',
  title: 'Test Draft',
  content: 'hello',
  notes: '',
  created_at: 1000,
  updated_at: 1000,
};

beforeEach(() => {
  vi.useFakeTimers();
  _reset();
  store.drafts = [{ ...sampleDraft }];
  store.activeDraftId = '1';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
});

afterEach(() => {
  _reset(); // clears any pending timer
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('deleteDraftWithUndo', () => {
  test('optimistically removes draft and sets pendingDelete', () => {
    deleteDraftWithUndo('1');

    expect(store.drafts).toHaveLength(0);
    expect(store.activeDraftId).toBeNull();
    expect(store.pendingDelete).not.toBeNull();
    expect(store.pendingDelete.draft.id).toBe('1');
  });

  test('switches active to next draft when deleting active', () => {
    const other = { ...sampleDraft, id: '2', updated_at: 500 };
    store.drafts = [{ ...sampleDraft }, other];

    deleteDraftWithUndo('1');

    expect(store.activeDraftId).toBe('2');
  });

  test('undo within window restores draft and skips DELETE', () => {
    deleteDraftWithUndo('1');
    store.pendingDelete.undo();

    expect(store.drafts).toHaveLength(1);
    expect(store.drafts[0].id).toBe('1');
    expect(store.activeDraftId).toBe('1');
    expect(store.pendingDelete).toBeNull();

    vi.runAllTimers();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('after 30s DELETE is called exactly once', async () => {
    deleteDraftWithUndo('1');

    await vi.runAllTimersAsync();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/drafts/1',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(store.pendingDelete).toBeNull();
  });

  test('no-op for unknown id', () => {
    deleteDraftWithUndo('no-such-id');
    expect(store.drafts).toHaveLength(1);
    expect(store.pendingDelete).toBeNull();
  });
});
