<script>
  import { store, createDraft, deleteDraftWithUndo, setActive } from './stores/drafts.svelte.js';
  import { filterDrafts } from './filterDrafts.js';

  let open = $state(false);
  let query = $state('');

  let filtered = $derived(filterDrafts(store.drafts, query));

  function toggle() { open = !open; }
  function close() { open = false; query = ''; }

  async function newDraft() {
    await createDraft();
    close();
  }

  function selectDraft(id) {
    setActive(id);
    close();
  }

  function handleKeydown(e) {
    if (e.key === 'Escape') close();
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Hamburger button -->
<button
  onclick={toggle}
  aria-label="Toggle drafts sidebar"
  style="position:fixed;top:1rem;right:1rem;z-index:50;background:#1e293b;border:1px solid #334155;border-radius:0.5rem;padding:0.5rem 0.625rem;cursor:pointer;color:#94a3b8;line-height:0;"
>
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <rect x="2" y="3" width="16" height="2" rx="1"/>
    <rect x="2" y="9" width="16" height="2" rx="1"/>
    <rect x="2" y="15" width="16" height="2" rx="1"/>
  </svg>
</button>

<!-- Backdrop -->
{#if open}
  <div
    onclick={close}
    aria-hidden="true"
    style="position:fixed;inset:0;z-index:40;background:rgba(0,0,0,0.45);"
  ></div>
{/if}

<!-- Sidebar panel -->
<div
  aria-label="Drafts sidebar"
  style="position:fixed;top:0;right:0;z-index:45;height:100vh;width:22rem;background:#0f172a;border-left:1px solid #1e293b;display:flex;flex-direction:column;transform:{open ? 'translateX(0)' : 'translateX(100%)'};transition:transform 0.2s ease;overflow:hidden;"
>
  <!-- Header -->
  <div style="padding:1rem;border-bottom:1px solid #1e293b;flex-shrink:0;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
      <span style="color:#f1f5f9;font-weight:600;font-size:1rem;">Drafts</span>
      <button
        onclick={newDraft}
        style="background:#2563eb;color:white;border:none;border-radius:0.375rem;padding:0.25rem 0.75rem;font-size:0.875rem;cursor:pointer;font-weight:500;"
      >
        + New
      </button>
    </div>
    <input
      type="search"
      bind:value={query}
      placeholder="Search drafts…"
      style="width:100%;box-sizing:border-box;background:#1e293b;border:1px solid #334155;border-radius:0.375rem;padding:0.5rem 0.75rem;color:#f1f5f9;font-size:0.875rem;"
    />
  </div>

  <!-- Draft list -->
  <div style="flex:1;overflow-y:auto;">
    {#if filtered.length === 0}
      <p style="color:#64748b;font-size:0.875rem;text-align:center;padding:2rem 1rem;">
        {query.trim() ? 'No drafts match your search.' : 'No drafts yet.'}
      </p>
    {:else}
      {#each filtered as draft (draft.id)}
        <div
          style="display:flex;align-items:center;padding:0.625rem 1rem;border-bottom:1px solid #1e293b;{store.activeDraftId === draft.id ? 'background:#1e293b;' : ''}"
        >
          <button
            onclick={() => selectDraft(draft.id)}
            style="flex:1;min-width:0;background:none;border:none;cursor:pointer;text-align:left;padding:0;"
          >
            <div style="color:#f1f5f9;font-size:0.875rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              {draft.title || 'Untitled'}
            </div>
            <div style="color:#64748b;font-size:0.75rem;margin-top:0.125rem;">
              {formatDate(draft.updated_at)}
            </div>
          </button>
          <button
            onclick={() => deleteDraftWithUndo(draft.id)}
            aria-label="Delete draft"
            style="flex-shrink:0;background:none;border:none;color:#64748b;cursor:pointer;padding:0.25rem;border-radius:0.25rem;margin-left:0.5rem;line-height:0;"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M6.5 1a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zM2 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1H2V4zm1 2l.894 8.053A1 1 0 0 0 4.886 15h6.228a1 1 0 0 0 .992-.947L13 6H3z"/>
            </svg>
          </button>
        </div>
      {/each}
    {/if}
  </div>
</div>

<!-- Undo toast (visible even when sidebar is closed) -->
{#if store.pendingDelete}
  <div
    style="position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);z-index:60;background:#334155;border:1px solid #475569;border-radius:0.5rem;padding:0.75rem 1rem;display:flex;align-items:center;gap:1rem;box-shadow:0 4px 12px rgba(0,0,0,0.4);min-width:16rem;"
  >
    <span style="color:#f1f5f9;font-size:0.875rem;">Draft deleted</span>
    <button
      onclick={() => store.pendingDelete?.undo()}
      style="color:#60a5fa;font-size:0.875rem;font-weight:600;background:none;border:none;cursor:pointer;margin-left:auto;"
    >
      Undo
    </button>
  </div>
{/if}
