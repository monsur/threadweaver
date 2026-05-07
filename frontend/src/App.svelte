<script>
  import Editor from './lib/Editor.svelte';
  import Login from './lib/Login.svelte';

  // null = checking, false = not authenticated, true = authenticated
  let authed = $state(null);

  async function checkAuth() {
    try {
      const res = await fetch('/api/me', { credentials: 'include' });
      authed = res.ok;
    } catch {
      authed = false;
    }
  }

  checkAuth();
</script>

{#if authed === null}
  <!-- checking auth, render nothing to avoid flash -->
{:else if authed}
  <div class="p-6 md:p-10 flex flex-col items-center min-h-screen">
    <div class="w-full max-w-5xl">
      <h1 class="text-3xl font-bold mb-4 text-center">Threadweaver</h1>
      <p class="text-sm text-gray-400 text-center mb-6">
        Write your post below. Use three blank lines to create a new post chunk.
        Characters over the limit will be highlighted in red.
      </p>
      <Editor />
    </div>
  </div>
{:else}
  <Login onlogin={() => { authed = true; }} />
{/if}
