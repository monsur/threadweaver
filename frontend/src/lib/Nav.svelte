<script>
  let { currentView, setView } = $props();
</script>

<nav class="flex gap-4 mb-6 border-b border-slate-700 pb-3">
  <button
    class="px-3 py-1 rounded text-sm font-medium transition-colors {currentView === 'editor'
      ? 'bg-purple-600 text-white active'
      : 'text-slate-400 hover:text-slate-200'}"
    onclick={() => setView('editor')}
  >
    Editor
  </button>
  <button
    class="px-3 py-1 rounded text-sm font-medium transition-colors {currentView === 'readwise'
      ? 'bg-purple-600 text-white active'
      : 'text-slate-400 hover:text-slate-200'}"
    onclick={() => setView('readwise')}
  >
    Readwise
  </button>
</nav>
