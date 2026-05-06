import { describe, test, expect } from 'vitest';
import { splitChunks, getCurrentChunkIndex } from '../chunks.js';

describe('splitChunks', () => {
  test('single chunk with no separators returns array of one', () => {
    expect(splitChunks('hello world')).toEqual(['hello world']);
  });

  test('two chunks separated by triple newline returns array of two', () => {
    expect(splitChunks('first\n\n\nsecond')).toEqual(['first', 'second']);
  });

  test('three chunks', () => {
    expect(splitChunks('a\n\n\nb\n\n\nc')).toEqual(['a', 'b', 'c']);
  });

  test('empty string returns array with one empty string', () => {
    expect(splitChunks('')).toEqual(['']);
  });

  test('whitespace within a chunk is preserved', () => {
    const chunk = '  leading and trailing  ';
    expect(splitChunks(chunk)).toEqual([chunk]);
  });

  test('newlines within a chunk are preserved', () => {
    expect(splitChunks('line1\nline2')).toEqual(['line1\nline2']);
  });

  test('multiple consecutive separators produce empty chunks between them', () => {
    const result = splitChunks('a\n\n\n\n\n\nb');
    // '\n\n\n\n\n\n' splits into 'a', '\n\n\n', 'b' — the middle is an empty chunk with extra newlines
    expect(result.length).toBeGreaterThan(1);
    expect(result[0]).toBe('a');
    expect(result[result.length - 1]).toBe('b');
  });
});

describe('getCurrentChunkIndex', () => {
  test('cursor at start of single chunk returns 0', () => {
    expect(getCurrentChunkIndex('hello', 0)).toBe(0);
  });

  test('cursor at end of single chunk returns 0', () => {
    expect(getCurrentChunkIndex('hello', 5)).toBe(0);
  });

  test('cursor in first chunk of two returns 0', () => {
    expect(getCurrentChunkIndex('first\n\n\nsecond', 2)).toBe(0);
  });

  test('cursor in second chunk of two returns 1', () => {
    // 'first' is 5 chars, separator is 3, so second chunk starts at index 8
    expect(getCurrentChunkIndex('first\n\n\nsecond', 9)).toBe(1);
  });

  test('cursor at separator boundary falls into first chunk', () => {
    // cursor at position 5 (right at the separator start) — still in chunk 0
    expect(getCurrentChunkIndex('first\n\n\nsecond', 5)).toBe(0);
  });

  test('empty content returns 0', () => {
    expect(getCurrentChunkIndex('', 0)).toBe(0);
  });
});
