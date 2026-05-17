import { describe, test, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateThread } from '../lib/llm.js';

const promptPath = join(dirname(fileURLToPath(import.meta.url)), '../../src/prompts/generate-thread.txt');
const expectedPrompt = readFileSync(promptPath, 'utf-8');

const baseEnv = {
  ANTHROPIC_API_KEY: 'test-key',
  LLM_MODEL: 'claude-opus-4-7',
  LLM_MAX_TOKENS: '1024',
  LLM_TEMPERATURE: '0.7',
};

const anthropicOk = (text = 'post one\n\n\npost two') => ({
  ok: true,
  status: 200,
  json: async () => ({ content: [{ type: 'text', text }] }),
});

beforeEach(() => vi.restoreAllMocks());

describe('generateThread', () => {
  test('calls Anthropic API with model, max_tokens, and temperature from env', async () => {
    const fetchMock = vi.fn().mockResolvedValue(anthropicOk());
    vi.stubGlobal('fetch', fetchMock);

    await generateThread({ title: 'T', url: 'https://x.com', author: 'A', highlights: [] }, baseEnv);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('claude-opus-4-7');
    expect(body.max_tokens).toBe(1024);
    expect(body.temperature).toBe(0.7);
  });

  test('system prompt matches generate-thread.txt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(anthropicOk());
    vi.stubGlobal('fetch', fetchMock);

    await generateThread({ title: 'T', url: 'https://x.com', author: 'A', highlights: [] }, baseEnv);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.system).toBe(expectedPrompt);
  });

  test('user message includes title, author, URL, and numbered highlights', async () => {
    const fetchMock = vi.fn().mockResolvedValue(anthropicOk());
    vi.stubGlobal('fetch', fetchMock);

    await generateThread({
      title: 'My Article',
      url: 'https://example.com',
      author: 'Jane Doe',
      highlights: ['First point', 'Second point'],
    }, baseEnv);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const msg = body.messages[0].content;
    expect(msg).toContain('My Article');
    expect(msg).toContain('Jane Doe');
    expect(msg).toContain('https://example.com');
    expect(msg).toContain('1. First point');
    expect(msg).toContain('2. Second point');
  });

  test('user message omits highlights section when highlights array is empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue(anthropicOk());
    vi.stubGlobal('fetch', fetchMock);

    await generateThread({ title: 'T', url: 'https://x.com', author: 'A', highlights: [] }, baseEnv);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).not.toContain('Highlights');
  });

  test('returns raw text content from API response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(anthropicOk('thread content here')));
    const result = await generateThread({ title: 'T', url: 'https://x.com', author: 'A', highlights: [] }, baseEnv);
    expect(result).toBe('thread content here');
  });
});
