import { describe, test, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { getAll, get, put, remove, getUpdatedAfter, _resetDb } from '../db.js';

beforeEach(() => {
  global.indexedDB = new IDBFactory();
  _resetDb();
});

const draft = (id, extra = {}) => ({
  id, title: 'T', content: '', notes: '', created_at: 1000, updated_at: 1000, ...extra,
});

describe('db', () => {
  test('put then get returns the draft', async () => {
    await put(draft('a'));
    expect(await get('a')).toMatchObject({ id: 'a', title: 'T' });
  });

  test('put twice updates the record', async () => {
    await put(draft('a'));
    await put({ ...draft('a'), title: 'Updated' });
    expect((await get('a')).title).toBe('Updated');
  });

  test('remove then get returns undefined', async () => {
    await put(draft('a'));
    await remove('a');
    expect(await get('a')).toBeUndefined();
  });

  test('getAll returns all stored drafts', async () => {
    await put(draft('a'));
    await put(draft('b'));
    const all = await getAll();
    expect(all).toHaveLength(2);
  });

  test('getAll on empty store returns empty array', async () => {
    expect(await getAll()).toEqual([]);
  });

  test('getUpdatedAfter returns only drafts modified after timestamp', async () => {
    await put(draft('a', { updated_at: 500 }));
    await put(draft('b', { updated_at: 1500 }));
    const result = await getUpdatedAfter(1000);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  test('getUpdatedAfter returns empty array when nothing is newer', async () => {
    await put(draft('a', { updated_at: 500 }));
    expect(await getUpdatedAfter(1000)).toHaveLength(0);
  });
});
