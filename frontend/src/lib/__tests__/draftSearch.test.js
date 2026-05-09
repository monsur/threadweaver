import { describe, test, expect } from 'vitest';
import { filterDrafts } from '../filterDrafts.js';

const drafts = [
  { id: '1', title: 'Hello World', content: 'Some content here', notes: 'Private note' },
  { id: '2', title: 'Another post', content: 'Bluesky thread ideas', notes: '' },
  { id: '3', title: 'Untitled', content: '', notes: 'AI brainstorm material' },
];

describe('filterDrafts', () => {
  test('empty query returns all drafts', () => {
    expect(filterDrafts(drafts, '')).toHaveLength(3);
  });

  test('whitespace-only query returns all drafts', () => {
    expect(filterDrafts(drafts, '   ')).toHaveLength(3);
  });

  test('matches on title', () => {
    const result = filterDrafts(drafts, 'hello');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('matches on content', () => {
    const result = filterDrafts(drafts, 'bluesky');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  test('matches on notes', () => {
    const result = filterDrafts(drafts, 'brainstorm');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('3');
  });

  test('no matches returns empty array', () => {
    expect(filterDrafts(drafts, 'xyzzy-no-match')).toHaveLength(0);
  });

  test('search is case-insensitive', () => {
    expect(filterDrafts(drafts, 'HELLO')).toHaveLength(1);
    expect(filterDrafts(drafts, 'BLUESKY')).toHaveLength(1);
    expect(filterDrafts(drafts, 'BRAINSTORM')).toHaveLength(1);
  });
});
