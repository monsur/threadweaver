<script>
  import { createDraft, setActive } from './stores/drafts.svelte.js';

  let { setView } = $props();

  let articles = $state([]);
  let loading = $state(true);
  let error = $state(null);

  // per-article state: undefined = not fetched, null = fetching, array = fetched
  let highlights = $state({});
  let expanded = $state({});

  let generating = $state(null);   // article id currently being generated
  let postErrors = $state({});     // article id -> true if last Post failed

  async function loadArticles() {
    loading = true;
    error = null;
    try {
      const res = await fetch('/api/readwise/articles', { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      articles = data.articles ?? [];
    } catch {
      error = true;
    } finally {
      loading = false;
    }
  }

  async function toggleExpand(id) {
    expanded[id] = !expanded[id];
    if (expanded[id] && highlights[id] === undefined) {
      highlights[id] = null;
      try {
        const res = await fetch(`/api/readwise/articles/${id}/highlights`, { credentials: 'include' });
        if (!res.ok) throw new Error();
        const data = await res.json();
        highlights[id] = data.highlights ?? [];
      } catch {
        highlights[id] = [];
      }
    }
  }

  async function handlePost(article) {
    generating = article.id;
    postErrors[article.id] = false;
    try {
      const res = await fetch('/api/readwise/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: article.id }),
      });
      if (!res.ok) throw new Error();
      const { title, content, notes } = await res.json();
      const draft = await createDraft({ title, content, notes });
      setActive(draft.id);
      articles = articles.filter(a => a.id !== article.id);
      setView('editor');
    } catch {
      postErrors[article.id] = true;
    } finally {
      generating = null;
    }
  }

  loadArticles();
</script>

<!-- full-page loading overlay -->
{#if generating}
  <div class="fixed inset-0 bg-slate-900/80 flex flex-col items-center justify-center z-50">
    <p class="text-white text-lg font-medium">Generating…</p>
  </div>
{/if}

{#if loading}
  <div class="text-slate-400 text-sm mt-6" data-testid="loading">Loading articles…</div>

{:else if error}
  <div class="mt-6">
    <p class="text-red-400 text-sm mb-2">Failed to load articles.</p>
    <button
      class="text-sm text-purple-400 hover:text-purple-300 underline"
      onclick={loadArticles}
    >Retry</button>
  </div>

{:else if articles.length === 0}
  <p class="text-slate-400 text-sm mt-6">No articles found with this tag.</p>

{:else}
  <ul class="mt-4 divide-y divide-slate-800">
    {#each articles as article (article.id)}
      <li class="py-3">
        <div class="flex items-center gap-2">
          <!-- expand arrow -->
          <button
            class="text-slate-500 hover:text-slate-300 w-5 flex-shrink-0 transition-colors"
            onclick={() => toggleExpand(article.id)}
            aria-label={expanded[article.id] ? 'Collapse' : 'Expand'}
            disabled={generating === article.id}
          >
            {#if expanded[article.id]}▼{:else}▶{/if}
          </button>

          <!-- title -->
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            class="flex-1 text-slate-200 hover:text-white text-sm truncate"
          >{article.title}</a>

          <!-- action buttons -->
          <div class="flex gap-2 flex-shrink-0">
            <button
              class="text-xs px-2 py-1 rounded border border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={generating === article.id}
              onclick={() => {/* Phase 4 */}}
            >Archive</button>
            <button
              class="text-xs px-2 py-1 rounded bg-purple-700 hover:bg-purple-600 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={generating === article.id}
              onclick={() => handlePost(article)}
            >Post</button>
          </div>
        </div>

        <!-- per-row post error -->
        {#if postErrors[article.id]}
          <div class="ml-7 mt-1 flex items-center gap-2">
            <p class="text-red-400 text-xs">Failed to generate. </p>
            <button
              class="text-xs text-purple-400 hover:text-purple-300 underline"
              onclick={() => handlePost(article)}
            >Retry</button>
          </div>
        {/if}

        <!-- highlights -->
        {#if expanded[article.id]}
          <div class="ml-7 mt-2">
            {#if highlights[article.id] === null}
              <p class="text-slate-500 text-xs">Loading highlights…</p>
            {:else if highlights[article.id]?.length === 0}
              <p class="text-slate-500 text-xs">No highlights</p>
            {:else}
              <ul class="space-y-1">
                {#each highlights[article.id] as hl}
                  <li class="text-slate-400 text-xs before:content-['•'] before:mr-2">{hl}</li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}
