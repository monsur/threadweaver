<script>
  import Editor from './lib/Editor.svelte';
  import Login from './lib/Login.svelte';
  import Sidebar from './lib/Sidebar.svelte';
  import { store, loadDrafts, createDraft } from './lib/stores/drafts.svelte.js';
  import { network } from './lib/stores/network.svelte.js';
  import { syncPending } from './lib/sync.js';

  // null = checking, false = not authenticated, true = authenticated
  let authed = $state(null);

  async function init() {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (res.ok) {
        authed = true;
        await loadDrafts();
        if (store.drafts.length === 0) await createDraft();
      } else {
        authed = false;
      }
    } catch {
      authed = false;
    }
  }

  async function handleLogin() {
    authed = true;
    await loadDrafts();
    if (store.drafts.length === 0) await createDraft();
  }

  init();

  let activeDraft = $derived(store.drafts.find(d => d.id === store.activeDraftId) ?? null);

  // Sync pending writes and refresh when coming back online
  let wasOffline = false;
  $effect(() => {
    if (!network.online) {
      wasOffline = true;
    } else if (wasOffline) {
      wasOffline = false;
      syncPending().then(() => loadDrafts());
    }
  });
</script>

{#if authed === null}
  <!-- checking auth — render nothing to avoid flash -->
{:else if authed}
  <div class="p-6 md:p-10 flex flex-col items-center min-h-screen">
    <div class="w-full max-w-5xl">
      <h1 class="text-3xl font-bold mb-4 text-center text-slate-100">Threadweaver</h1>
      <p class="text-sm text-gray-400 text-center mb-6">
        Write your post below. Use three blank lines to create a new post chunk.
        Characters over the limit will be highlighted in red.
      </p>
      <Editor draft={activeDraft} />
    </div>
  </div>
  <Sidebar />
{:else}
  <Login onlogin={handleLogin} />
{/if}

<!-- Offline indicator -->
{#if !network.online}
  <div
    style="position:fixed;bottom:0;left:0;right:0;z-index:100;background:#7c3aed;color:white;text-align:center;padding:0.375rem 1rem;font-size:0.875rem;"
  >
    Offline — changes will sync when you reconnect
  </div>
{/if}
