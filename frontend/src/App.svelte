<script>
  import Editor from './lib/Editor.svelte';
  import Login from './lib/Login.svelte';
  import Sidebar from './lib/Sidebar.svelte';
  import { store, loadDrafts, createDraft } from './lib/stores/drafts.svelte.js';

  // null = checking, false = not authenticated, true = authenticated
  let authed = $state(null);

  async function init() {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      if (res.ok) {
        authed = true;
        await loadDrafts();
        if (store.drafts.length === 0) {
          await createDraft();
        }
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
    if (store.drafts.length === 0) {
      await createDraft();
    }
  }

  init();

  let activeDraft = $derived(store.drafts.find(d => d.id === store.activeDraftId) ?? null);
</script>

{#if authed === null}
  <!-- checking auth — render nothing to avoid flash -->
{:else if authed}
  <div class="p-6 md:p-10 flex flex-col items-center min-h-screen">
    <div class="w-full max-w-5xl">
      <h1 class="text-3xl font-bold mb-4 text-center">Threadweaver</h1>
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
