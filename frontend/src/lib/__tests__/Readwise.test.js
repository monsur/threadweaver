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

function mockFetch(responses) {
  let i = 0;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
    const r = responses[i] ?? responses[responses.length - 1];
    i++;
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: async () => r.json,
    };
  }));
}

const makeArticles = (...titles) =>
  titles.map((title, n) => ({ id: `id-${n}`, title, author: 'Author', url: `https://example.com/${n}` }));

// ── loading / empty / error states ───────────────────────────────────────────

describe('Readwise article list states', () => {
  test('shows loading state while articles fetch is in flight', async () => {
    let resolve;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(r => { resolve = r; })));
    const { getByTestId } = render(Readwise, { setView: vi.fn() });
    expect(getByTestId('loading')).toBeInTheDocument();
    resolve({ ok: true, json: async () => ({ articles: [] }) });
  });

  test('shows empty state when API returns no articles', async () => {
    mockFetch([{ json: { articles: [] } }]);
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => expect(screen.getByText(/no articles found/i)).toBeInTheDocument());
  });

  test('shows error state when API call fails', async () => {
    mockFetch([{ ok: false, status: 500, json: {} }]);
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => expect(screen.getByText(/failed to load/i)).toBeInTheDocument());
  });

  test('shows retry button in error state', async () => {
    mockFetch([{ ok: false, status: 500, json: {} }]);
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => expect(screen.getByText(/retry/i)).toBeInTheDocument());
  });

  test('retry button re-fetches articles', async () => {
    mockFetch([
      { ok: false, status: 500, json: {} },
      { json: { articles: makeArticles('Article A') } },
    ]);
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => screen.getByText(/retry/i));
    await fireEvent.click(screen.getByText(/retry/i));
    await waitFor(() => expect(screen.getByText('Article A')).toBeInTheDocument());
  });
});

// ── article rendering ─────────────────────────────────────────────────────────

describe('Readwise article rendering', () => {
  test('renders article title for each article', async () => {
    mockFetch([{ json: { articles: makeArticles('First Article', 'Second Article') } }]);
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => expect(screen.getByText('First Article')).toBeInTheDocument());
    expect(screen.getByText('Second Article')).toBeInTheDocument();
  });

  test('article title renders as a link with target="_blank"', async () => {
    mockFetch([{ json: { articles: makeArticles('Linked Article') } }]);
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => screen.getByText('Linked Article'));
    const link = screen.getByText('Linked Article').closest('a');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('href', 'https://example.com/0');
  });

  test('renders Archive and Post buttons for each article', async () => {
    mockFetch([{ json: { articles: makeArticles('Article A') } }]);
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => screen.getByText('Article A'));
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Post')).toBeInTheDocument();
  });
});

// ── expand / collapse + highlights ───────────────────────────────────────────

describe('Readwise expand and highlights', () => {
  test('clicking expand arrow fetches and displays highlights', async () => {
    mockFetch([
      { json: { articles: makeArticles('Article A') } },
      { json: { highlights: ['Highlight one', 'Highlight two'] } },
    ]);
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => screen.getByText('Article A'));

    await fireEvent.click(screen.getByLabelText('Expand'));
    await waitFor(() => expect(screen.getByText('Highlight one')).toBeInTheDocument());
    expect(screen.getByText('Highlight two')).toBeInTheDocument();
  });

  test('highlights are not re-fetched on subsequent expands', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ articles: makeArticles('Article A') }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ highlights: ['A highlight'] }) });
    vi.stubGlobal('fetch', fetchMock);

    render(Readwise, { setView: vi.fn() });
    await waitFor(() => screen.getByText('Article A'));

    // expand once
    await fireEvent.click(screen.getByLabelText('Expand'));
    await waitFor(() => screen.getByText('A highlight'));

    // collapse then expand again
    await fireEvent.click(screen.getByLabelText('Collapse'));
    await fireEvent.click(screen.getByLabelText('Expand'));

    // fetch was called twice total: once for articles, once for highlights
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('shows "No highlights" when highlights array is empty', async () => {
    mockFetch([
      { json: { articles: makeArticles('Article A') } },
      { json: { highlights: [] } },
    ]);
    render(Readwise, { setView: vi.fn() });
    await waitFor(() => screen.getByText('Article A'));
    await fireEvent.click(screen.getByLabelText('Expand'));
    await waitFor(() => expect(screen.getByText('No highlights')).toBeInTheDocument());
  });
});

// ── Post button ───────────────────────────────────────────────────────────────

describe('Readwise Post button', () => {
  test('clicking Post shows loading overlay and disables buttons', async () => {
    let resolveGenerate;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
      if (String(url).includes('/api/readwise/articles')) {
        return { ok: true, json: async () => ({ articles: makeArticles('Article A') }) };
      }
      // generate call — hang until we resolve
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

    mockFetch([
      { json: { articles: makeArticles('Article A') } },
      { json: { title: 'Article A', content: 'thread', notes: 'notes' } },
    ]);

    render(Readwise, { setView });
    await waitFor(() => screen.getByText('Article A'));
    await fireEvent.click(screen.getByText('Post'));
    await waitFor(() => expect(setView).toHaveBeenCalledWith('editor'));

    expect(createDraft).toHaveBeenCalledWith({ title: 'Article A', content: 'thread', notes: 'notes' });
    expect(setActive).toHaveBeenCalledWith('new-draft-id');
    expect(screen.queryByText('Article A')).not.toBeInTheDocument();
  });

  test('on error: hides overlay, re-enables buttons, shows error message', async () => {
    mockFetch([
      { json: { articles: makeArticles('Article A') } },
      { ok: false, status: 500, json: {} },
    ]);

    render(Readwise, { setView: vi.fn() });
    await waitFor(() => screen.getByText('Article A'));
    await fireEvent.click(screen.getByText('Post'));
    await waitFor(() => expect(screen.getByText(/failed to generate/i)).toBeInTheDocument());

    expect(screen.queryByText('Generating…')).not.toBeInTheDocument();
    expect(screen.getByText('Post')).not.toBeDisabled();
    expect(screen.getByText('Archive')).not.toBeDisabled();
  });
});
