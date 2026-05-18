import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor, screen } from '@testing-library/svelte';
import Readwise from '../Readwise.svelte';

vi.mock('../stores/drafts.svelte.js', () => ({
  store: { drafts: [], activeDraftId: null },
  createDraft: vi.fn().mockResolvedValue({ id: 'new-draft-id' }),
  setActive: vi.fn(),
  loadDrafts: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// URL-based fetch mock — both articles and highlights fire on mount
function mockFetch({ articles, highlights, generate } = {}) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
    const u = String(url);
    if (u.includes('/api/readwise/generate')) {
      const r = generate ?? { ok: false, status: 500, json: {} };
      return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.json };
    }
    if (u.includes('/api/readwise/highlights')) {
      const r = highlights ?? { json: { highlights: {} } };
      return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.json };
    }
    if (u.includes('/api/readwise/articles')) {
      const r = articles ?? { json: { articles: [] } };
      return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.json };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  }));
}

const makeArticles = (...titles) =>
  titles.map((title, n) => ({ id: `id-${n}`, title, author: 'Author', url: `https://example.com/${n}` }));

// ── loading / empty / error states ───────────────────────────────────────────

describe('Readwise article list states', () => {
  test('shows loading state while articles fetch is in flight', async () => {
    let resolveArticles;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
      if (String(url).includes('/api/readwise/highlights')) {
        return { ok: true, json: async () => ({ highlights: {} }) };
      }
      return new Promise(r => { resolveArticles = r; });
    }));
    const { getByTestId } = render(Readwise, { setView: vi.fn() });
    expect(getByTestId('loading')).toBeInTheDocument();
    resolveArticles({ ok: true, json: async () => ({ articles: [] }) });
  });

  test('shows empty state when API returns no articles', async () => {
    mockFetch({ articles: { json: { articles: [] } } });
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => expect(screen.getByText(/no articles found/i)).toBeInTheDocument());
  });

  test('shows error state when API call fails', async () => {
    mockFetch({ articles: { ok: false, status: 500, json: {} } });
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => expect(screen.getByText(/failed to load/i)).toBeInTheDocument());
  });

  test('shows retry button in error state', async () => {
    mockFetch({ articles: { ok: false, status: 500, json: {} } });
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => expect(screen.getByText(/retry/i)).toBeInTheDocument());
  });

  test('retry button re-fetches articles', async () => {
    let articleCallCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/readwise/highlights')) {
        return { ok: true, json: async () => ({ highlights: {} }) };
      }
      articleCallCount++;
      if (articleCallCount === 1) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, json: async () => ({ articles: makeArticles('Article A') }) };
    }));
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => screen.getByText(/retry/i));
    await fireEvent.click(screen.getByText(/retry/i));
    await waitFor(() => expect(screen.getByText('Article A')).toBeInTheDocument());
  });
});

// ── article rendering ─────────────────────────────────────────────────────────

describe('Readwise article rendering', () => {
  test('renders article title for each article', async () => {
    mockFetch({ articles: { json: { articles: makeArticles('First Article', 'Second Article') } } });
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => expect(screen.getByText('First Article')).toBeInTheDocument());
    expect(screen.getByText('Second Article')).toBeInTheDocument();
  });

  test('article title renders as a link with target="_blank"', async () => {
    mockFetch({ articles: { json: { articles: makeArticles('Linked Article') } } });
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => screen.getByText('Linked Article'));
    const link = screen.getByText('Linked Article').closest('a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('href', 'https://example.com/0');
  });

  test('renders Archive and Post buttons for each article', async () => {
    mockFetch({ articles: { json: { articles: makeArticles('Article A') } } });
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => screen.getByText('Article A'));
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Post')).toBeInTheDocument();
  });
});

// ── expand / collapse + highlights ───────────────────────────────────────────

describe('Readwise expand and highlights', () => {
  test('shows loading spinner when expanded before highlights arrive', async () => {
    let resolveHighlights;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
      if (String(url).includes('/api/readwise/articles')) {
        return { ok: true, json: async () => ({ articles: makeArticles('Article A') }) };
      }
      return new Promise(r => { resolveHighlights = r; });
    }));
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => screen.getByText('Article A'));

    await fireEvent.click(screen.getByLabelText('Expand'));
    expect(screen.getByTestId('highlights-loading')).toBeInTheDocument();

    resolveHighlights({ ok: true, json: async () => ({ highlights: {} }) });
  });

  test('shows highlights once prefetch resolves', async () => {
    mockFetch({
      articles: { json: { articles: makeArticles('Article A') } },
      highlights: { json: { highlights: { 'id-0': ['Highlight one', 'Highlight two'] } } },
    });
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => screen.getByText('Article A'));

    await fireEvent.click(screen.getByLabelText('Expand'));
    await waitFor(() => expect(screen.getByText('Highlight one')).toBeInTheDocument());
    expect(screen.getByText('Highlight two')).toBeInTheDocument();
  });

  test('shows "No highlights" for article with no highlights in map', async () => {
    mockFetch({
      articles: { json: { articles: makeArticles('Article A') } },
      highlights: { json: { highlights: {} } },
    });
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => screen.getByText('Article A'));
    await fireEvent.click(screen.getByLabelText('Expand'));
    await waitFor(() => expect(screen.getByText('No highlights')).toBeInTheDocument());
  });

  test('highlights are not re-fetched on subsequent expands', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/readwise/articles')) {
        return { ok: true, json: async () => ({ articles: makeArticles('Article A') }) };
      }
      return { ok: true, json: async () => ({ highlights: { 'id-0': ['A highlight'] } }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(Readwise, { setView: vi.fn() });
    await waitFor(() => screen.getByText('Article A'));

    await fireEvent.click(screen.getByLabelText('Expand'));
    await waitFor(() => screen.getByText('A highlight'));

    await fireEvent.click(screen.getByLabelText('Collapse'));
    await fireEvent.click(screen.getByLabelText('Expand'));

    // only 2 fetches total: articles + highlights (no per-article refetch)
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// ── Post button ───────────────────────────────────────────────────────────────

describe('Readwise Post button', () => {
  test('clicking Post shows loading overlay and disables buttons', async () => {
    let resolveGenerate;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes('/api/readwise/articles')) {
        return { ok: true, json: async () => ({ articles: makeArticles('Article A') }) };
      }
      if (u.includes('/api/readwise/highlights')) {
        return { ok: true, json: async () => ({ highlights: {} }) };
      }
      return new Promise(r => { resolveGenerate = r; });
    }));

    render(Readwise, { setView: vi.fn() });
    await waitFor(() => screen.getByText('Article A'));
    await fireEvent.click(screen.getByText('Post'));

    expect(screen.getByText('Generating…')).toBeInTheDocument();
    expect(screen.getByText('Post')).toBeDisabled();
    expect(screen.getByText('Archive')).toBeDisabled();

    resolveGenerate({ ok: false, json: async () => ({}) });
  });

  test('on success: calls createDraft, setActive, setView, and removes article', async () => {
    const { createDraft, setActive } = await import('../stores/drafts.svelte.js');
    const setView = vi.fn();

    mockFetch({
      articles: { json: { articles: makeArticles('Article A') } },
      generate: { json: { title: 'Article A', content: 'thread', notes: 'notes' } },
    });

    render(Readwise, { setView });
    await waitFor(() => screen.getByText('Article A'));
    await fireEvent.click(screen.getByText('Post'));
    await waitFor(() => expect(setView).toHaveBeenCalledWith('editor'));

    expect(createDraft).toHaveBeenCalledWith({ title: 'Article A', content: 'thread', notes: 'notes' });
    expect(setActive).toHaveBeenCalledWith('new-draft-id');
    expect(screen.queryByText('Article A')).not.toBeInTheDocument();
  });

  test('on error: hides overlay, re-enables buttons, shows error message', async () => {
    mockFetch({
      articles: { json: { articles: makeArticles('Article A') } },
      generate: { ok: false, status: 500, json: {} },
    });

    render(Readwise, { setView: vi.fn() });
    await waitFor(() => screen.getByText('Article A'));
    await fireEvent.click(screen.getByText('Post'));
    await waitFor(() => expect(screen.getByText(/failed to generate/i)).toBeInTheDocument());

    expect(screen.queryByText('Generating…')).not.toBeInTheDocument();
    expect(screen.getByText('Post')).not.toBeDisabled();
    expect(screen.getByText('Archive')).not.toBeDisabled();
  });
});
