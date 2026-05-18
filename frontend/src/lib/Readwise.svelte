<script>
  import { createDraft, setActive } from './stores/drafts.svelte.js';

  let { setView } = $props();

  let articles = $state([]);
  let loading = $state(true);
  let error = $state(null);

  let generating = $state(null);
  let postErrors = $state({});

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

        {#if postErrors[article.id]}
          <div class="mt-1 flex items-center gap-2">
            <p class="text-red-400 text-xs">Failed to generate. </p>
            <button
              class="text-xs text-purple-400 hover:text-purple-300 underline"
              onclick={() => handlePost(article)}
            >Retry</button>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

