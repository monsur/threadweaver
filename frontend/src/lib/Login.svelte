<script>
  let { onlogin } = $props();

  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function submit() {
    if (loading || !password) return;
    loading = true;
    error = '';
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include',
      });
      if (res.ok) {
        onlogin();
      } else {
        error = 'Incorrect password';
        password = '';
      }
    } catch {
      error = 'Could not reach the server';
    } finally {
      loading = false;
    }
  }

  function onkeydown(e) {
    if (e.key === 'Enter') submit();
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen p-6">
  <div class="w-full max-w-sm bg-slate-800 rounded-lg shadow-lg p-8">
    <h1 class="text-2xl font-bold text-center mb-6">Threadweaver</h1>
    <input
      type="password"
      bind:value={password}
      onkeydown={onkeydown}
      placeholder="Password"
      disabled={loading}
      class="w-full bg-slate-700 text-lg border border-slate-600 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
    {#if error}
      <p class="text-red-400 text-sm mb-3">{error}</p>
    {/if}
    <button
      onclick={submit}
      disabled={loading || !password}
      class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? 'Signing in…' : 'Sign in'}
    </button>
  </div>
</div>
