<script>
  let { currentView, setView } = $props();

  const labels = { editor: 'Editor', readwise: 'Readwise' };
  let open = $state(false);

  function pick(v) {
    setView(v);
    open = false;
  }

  function onkeydown(e) {
    if (e.key === 'Escape') open = false;
  }
</script>

<svelte:window on:keydown={onkeydown} />

<nav class="flex items-center gap-1 mb-4 text-sm select-none">
  <span class="text-slate-400 font-semibold">Threadweaver</span>
  <span class="text-slate-600 mx-1">›</span>

  <div class="relative">
    <button
      class="flex items-center gap-1 text-slate-200 font-semibold hover:text-white transition-colors"
      onclick={() => open = !open}
      aria-haspopup="listbox"
      aria-expanded={open}
    >
      {labels[currentView]}
      <svg class="w-3 h-3 text-slate-400 transition-transform {open ? 'rotate-180' : ''}" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M1 1l4 4 4-4"/>
      </svg>
    </button>

    {#if open}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute top-full left-0 mt-1 z-50"
        onmouseleave={() => {}}
      >
        <!-- backdrop to catch outside clicks -->
        <div
          class="fixed inset-0 -z-10"
          onclick={() => open = false}
          role="presentation"
        ></div>
        <ul
          class="bg-slate-800 border border-slate-700 rounded shadow-lg overflow-hidden min-w-[120px]"
          role="listbox"
        >
          {#each Object.entries(labels) as [value, label]}
            <li role="option" aria-selected={currentView === value}>
              <button
                class="w-full text-left px-4 py-2 text-sm transition-colors
                  {currentView === value
                    ? 'text-white bg-slate-700 font-semibold active'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'}"
                onclick={() => pick(value)}
              >
                {label}
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
</nav>
