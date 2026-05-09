<script>
  let { setView } = $props();

  let articles = $state([]);
  let loading = $state(true);
  let error = $state(null);

  // per-article state: undefined = not fetched, null = fetching, array = fetched
  let highlights = $state({});
  let expanded = $state({});

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
      highlights[id] = null; // loading
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

  loadArticles();
</script>

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
              class="text-xs px-2 py-1 rounded border border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200 transition-colors"
              onclick={() => {/* Phase 4 */}}
            >Archive</button>
            <button
              class="text-xs px-2 py-1 rounded bg-purple-700 hover:bg-purple-600 text-white transition-colors"
              onclick={() => {/* Phase 3 */}}
            >Post</button>
          </div>
        </div>

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
