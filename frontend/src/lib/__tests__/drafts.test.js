import { describe, test, expect, beforeEach, vi } from 'vitest';
import { store, loadDrafts, createDraft, updateDraft, setActive, _reset } from '../stores/drafts.svelte.js';

beforeEach(() => {
  _reset();
  vi.restoreAllMocks();
});

const makeDraft = (id, extra = {}) => ({
  id,
  title: `Draft ${id}`,
  content: '',
  notes: '',
  created_at: 1000,
  updated_at: 1000,
  ...extra,
});

function mockFetch(data, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: async () => data,
  }));
}

describe('loadDrafts', () => {
  test('populates store.drafts and sets activeDraftId to first draft', async () => {
    const drafts = [makeDraft('a', { updated_at: 2000 }), makeDraft('b', { updated_at: 1000 })];
    mockFetch(drafts);

    await loadDrafts();

    expect(store.drafts).toHaveLength(2);
    expect(store.drafts[0].id).toBe('a');
    expect(store.activeDraftId).toBe('a');
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
});

describe('createDraft', () => {
  test('adds new draft to front of drafts and sets it active', async () => {
    store.drafts = [makeDraft('existing')];
    const newDraft = makeDraft('new', { updated_at: 9999 });
    mockFetch(newDraft);

    const result = await createDraft({ title: 'New' });

    expect(result).toEqual(newDraft);
    expect(store.drafts[0].id).toBe('new');
    expect(store.drafts).toHaveLength(2);
    expect(store.activeDraftId).toBe('new');
  });

  test('returns null and does not update store on API error', async () => {
    mockFetch(null, false);
    const result = await createDraft();
    expect(result).toBeNull();
    expect(store.drafts).toHaveLength(0);
  });
});

describe('updateDraft', () => {
  test('replaces the correct draft in store', async () => {
    store.drafts = [makeDraft('1', { title: 'Old' }), makeDraft('2')];
    const updated = makeDraft('1', { title: 'New', updated_at: 5000 });
    mockFetch(updated);

    await updateDraft('1', { title: 'New' });

    expect(store.drafts[0].title).toBe('New');
    expect(store.drafts[0].updated_at).toBe(5000);
    expect(store.drafts).toHaveLength(2);
  });

  test('returns null on API error', async () => {
    mockFetch(null, false);
    const result = await updateDraft('1', { title: 'x' });
    expect(result).toBeNull();
  });
});

describe('setActive', () => {
  test('updates activeDraftId', () => {
    setActive('xyz');
    expect(store.activeDraftId).toBe('xyz');
  });
});
