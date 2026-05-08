<script>
  import { untrack } from 'svelte';
  import { getChunkDetails } from './charCount.js';
  import { splitChunks, getCurrentChunkIndex } from './chunks.js';
  import { updateDraft } from './stores/drafts.svelte.js';

  const { draft = null } = $props();

  const CHARACTER_LIMIT = 300;

  let content = $state(draft?.content ?? '');
  let title = $state(draft?.title ?? 'Untitled');
  let notes = $state(draft?.notes ?? '');
  let notesExpanded = $state(true);
  let editingTitle = $state(false);
  let cursorPosition = $state(0);
  let copyAllActive = $state(false);
  let checkedPrefixIndex = $state(null);
  let saveTimer = null;

  let textarea = $state(null);
  let titleInput = $state(null);
  let visualEditor = $state(null);

  // Reset local state when switching to a different draft.
  // Only track draft.id as a dependency so typing (which changes draft.content
  // via debounced save) doesn't clobber what the user is currently typing.
  $effect(() => {
    const id = draft?.id;
    clearTimeout(saveTimer);
    saveTimer = null;
    untrack(() => {
      content = draft?.content ?? '';
      title = draft?.title ?? 'Untitled';
      notes = draft?.notes ?? '';
      editingTitle = false;
    });
  });

  let chunks = $derived(splitChunks(content));
  let currentChunkIndex = $derived(getCurrentChunkIndex(content, cursorPosition));
  let currentChunkDetails = $derived(getChunkDetails(chunks[currentChunkIndex] ?? ''));

  const PREFIX_STYLE = 'position:absolute;left:0.5rem;font-weight:bold;color:#4b5563;cursor:pointer;pointer-events:auto;background:none;border:none;padding:0;font-size:inherit;font-family:inherit;line-height:inherit;';
  const OVERAGE_STYLE = 'color:#f87171;';

  let visualHtml = $derived(
    chunks.map((chunk, i) => {
      const details = getChunkDetails(chunk);
      const sep = i > 0 ? '<br><br><br>' : '';
      const label = checkedPrefixIndex === i ? '&#x2713;' : `${i + 1}/`;
      const btn = `<button style="${PREFIX_STYLE}" data-chunk="${i}">${label}</button>`;
      const safe = `<span>${escapeHtml(details.safeText)}</span>`;
      const overage = details.isOverage
        ? `<span style="${OVERAGE_STYLE}">${escapeHtml(details.overageText)}</span>`
        : '';
      return `${sep}${btn}${safe}${overage}`;
    }).join('')
  );

  $effect(() => {
    if (!visualEditor) return;
    void visualHtml;
    visualEditor.querySelectorAll('[data-chunk]').forEach(btn => {
      btn.onclick = () => clickPrefix(Number(btn.dataset.chunk));
    });
  });

  $effect(() => {
    if (!textarea) return;
    textarea.value = content; // sync DOM before measuring so scrollHeight is accurate
    textarea.style.height = 'auto';
    const h = textarea.scrollHeight + 'px';
    textarea.style.height = h;
    if (visualEditor) visualEditor.style.height = h;
  });

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function scheduleAutoSave() {
    if (!draft?.id) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      updateDraft(draft.id, { content, title, notes });
    }, 500);
  }

  function onInput(e) {
    content = e.target.value;
    cursorPosition = e.target.selectionStart ?? 0;
    scheduleAutoSave();
  }

  function onCursorMove(e) {
    cursorPosition = e.target.selectionStart ?? 0;
  }

  function onNotesInput(e) {
    notes = e.target.value;
    scheduleAutoSave();
  }

  function startEditTitle() {
    editingTitle = true;
    setTimeout(() => titleInput?.focus(), 0);
  }

  async function saveTitle() {
    editingTitle = false;
    if (draft?.id) {
      clearTimeout(saveTimer);
      await updateDraft(draft.id, { title, content, notes });
    }
  }

  function onTitleKeydown(e) {
    if (e.key === 'Enter') { e.preventDefault(); saveTitle(); }
    if (e.key === 'Escape') { title = draft?.title ?? 'Untitled'; editingTitle = false; }
  }

  function copyAll() {
    if (!content.trim()) return;
    const text = chunks.map((chunk, i) => `${i + 1}/ ${chunk}`).join('\n\n');
    copyToClipboard(text);
    copyAllActive = true;
    setTimeout(() => { copyAllActive = false; }, 1500);
  }

  function clear() {
    content = '';
    scheduleAutoSave();
  }

  function clickPrefix(index) {
    const chunk = chunks[index];
    if (chunk === undefined) return;
    copyToClipboard(`${index + 1}/ ${chunk}`);
    checkedPrefixIndex = index;
    setTimeout(() => { checkedPrefixIndex = null; }, 1000);
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
  }
</script>

<div class="w-full bg-slate-800 rounded-lg shadow-lg p-6 mb-8">
  <!-- Editable title -->
  <div class="mb-4">
    {#if editingTitle}
      <input
        bind:this={titleInput}
        bind:value={title}
        onblur={saveTitle}
        onkeydown={onTitleKeydown}
        class="w-full bg-transparent border-b border-slate-600 focus:outline-none focus:border-blue-500 pb-1"
        style="color:#f1f5f9;font-size:1.5rem;font-weight:700;"
      />
    {:else}
      <button
        onclick={startEditTitle}
        class="text-left w-full"
        style="background:none;border:none;padding:0;cursor:pointer;color:#f1f5f9;font-size:1.5rem;font-weight:700;padding-bottom:0.25rem;border-bottom:1px solid transparent;"
      >
        {title || 'Untitled'}
      </button>
    {/if}
  </div>

  <div class="flex justify-between items-center mb-2">
    <span class="text-sm font-semibold {currentChunkDetails.isOverage ? 'text-red-400' : 'text-gray-400'}">
      {currentChunkDetails.length}/{CHARACTER_LIMIT}
    </span>
    <span class="text-sm text-gray-500">Chunk {currentChunkIndex + 1} of {chunks.length}</span>
  </div>

  <div class="min-h-60" style="position:relative;">
    <textarea
      bind:this={textarea}
      class="w-full h-full bg-transparent text-lg border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      style="position:relative;z-index:1;resize:none;color:transparent;caret-color:#c9d1d9;overflow:hidden;padding:1rem;padding-left:2.5rem;"
      placeholder="Start writing your post here..."
      value={content}
      oninput={onInput}
      onclick={onCursorMove}
      onkeyup={onCursorMove}
    ></textarea>

    <div
      bind:this={visualEditor}
      class="w-full h-full text-lg"
      style="position:absolute;top:0;left:0;z-index:2;white-space:pre-wrap;word-wrap:break-word;text-align:left;border-radius:0.5rem;pointer-events:none;padding:1rem;padding-left:2.5rem;"
    >{@html visualHtml}</div>
  </div>

  <div class="flex justify-between mt-4">
    <button onclick={clear} class="btn">Clear</button>
    <button
      onclick={copyAll}
      disabled={!content.trim() || copyAllActive}
      class="btn disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {copyAllActive ? 'Copied!' : 'Copy All Posts'}
    </button>
  </div>

  <!-- Notes panel -->
  <div style="margin-top:1.5rem;border-top:1px solid #334155;padding-top:1rem;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:{notesExpanded ? '0.625rem' : '0'};">
      <span style="color:#94a3b8;font-size:0.875rem;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;">Notes</span>
      <button
        onclick={() => notesExpanded = !notesExpanded}
        style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.75rem;padding:0.125rem 0.375rem;border-radius:0.25rem;"
        aria-label={notesExpanded ? 'Collapse notes' : 'Expand notes'}
      >
        {notesExpanded ? '▲ Hide' : '▼ Show'}
      </button>
    </div>
    {#if notesExpanded}
      <textarea
        value={notes}
        oninput={onNotesInput}
        placeholder="Private notes — not published. Jot down ideas, sources, or raw material here."
        class="w-full bg-slate-900 text-base border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        style="resize:vertical;color:#c9d1d9;padding:0.75rem;min-height:6rem;font-family:inherit;"
      ></textarea>
    {/if}
  </div>
</div>

<style>
  .btn {
    background-color: #2563eb;
    color: white;
    font-weight: bold;
    padding: 0.5rem 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    transition: background-color 0.2s;
    border: none;
    cursor: pointer;
  }

  .btn:hover {
    background-color: #1d4ed8;
  }

  .btn:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }
</style>
