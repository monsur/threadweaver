import * as db from '../db.js';

export const store = $state({
  drafts: [],
  activeDraftId: null,
  pendingDelete: null,
});

export async function loadDrafts() {
  // Show cached data immediately for instant display on reload
  const cached = (await db.getAll()).sort((a, b) => b.updated_at - a.updated_at);
  if (cached.length > 0) {
    store.drafts = cached;
    if (!store.activeDraftId) store.activeDraftId = cached[0].id;
  }

  try {
    const res = await fetch('/api/drafts', { credentials: 'include' });
    if (!res.ok) return;
    const remote = await res.json();

    // Update IDB with fresh server data
    const remoteIds = new Set(remote.map(d => d.id));
    for (const d of remote) await db.put(d);
    // Remove IDB entries deleted on the server, but keep any pending syncs
    for (const c of cached) {
      if (!remoteIds.has(c.id) && !c.pendingSync) await db.remove(c.id);
    }

    // Merge: server data + any offline creates not yet on server
    const pendingCreates = cached.filter(
      c => c.pendingSync && c.pendingSyncMethod === 'POST' && !remoteIds.has(c.id)
    );
    const merged = [...remote, ...pendingCreates].sort((a, b) => b.updated_at - a.updated_at);

    store.drafts = merged;
    if (!store.activeDraftId && merged.length > 0) store.activeDraftId = merged[0].id;
    if (store.activeDraftId && !merged.find(d => d.id === store.activeDraftId)) {
      store.activeDraftId = merged[0]?.id ?? null;
    }
  } catch {
    // Offline — keep cached data
  }
}

export async function createDraft(data = {}) {
  const now = Date.now();
  const draft = {
    id: crypto.randomUUID(),
    title: data.title ?? 'Untitled',
    content: data.content ?? '',
    notes: data.notes ?? '',
    created_at: now,
    updated_at: now,
  };

  // Optimistic: write to IDB and store immediately (spread to plain object — avoids proxy clone issues)
  await db.put({ ...draft });
  store.drafts = [draft, ...store.drafts];
  store.activeDraftId = draft.id;

  try {
    const res = await fetch('/api/drafts', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft), // include id so server uses our UUID
    });
    if (res.ok) {
      const server = await res.json();
      await db.put({ ...server });
      store.drafts = store.drafts.map(d => d.id === draft.id ? server : d);
    } else {
      await db.put({ ...draft, pendingSync: true, pendingSyncMethod: 'POST' });
    }
  } catch {
    await db.put({ ...draft, pendingSync: true, pendingSyncMethod: 'POST' });
  }

  return draft;
}

export async function updateDraft(id, data) {
  const existing = store.drafts.find(d => d.id === id);
  if (!existing) return null;

  const updated = {
    ...existing,
    title:      data.title      ?? existing.title,
    content:    data.content    ?? existing.content,
    notes:      data.notes      ?? existing.notes,
    updated_at: Date.now(),
  };

  // Optimistic: write to IDB and store immediately
  await db.put(updated);
  store.drafts = store.drafts.map(d => d.id === id ? updated : d);

  try {
    const res = await fetch(`/api/drafts/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const server = await res.json();
      await db.put({ ...server });
      store.drafts = store.drafts.map(d => d.id === id ? server : d);
      return server;
    } else {
      await db.put({ ...updated, pendingSync: true });
      return updated;
    }
  } catch {
    await db.put({ ...updated, pendingSync: true });
    return updated;
  }
}

export function deleteDraftWithUndo(id) {
  const draft = store.drafts.find(d => d.id === id);
  if (!draft) return;

  store.drafts = store.drafts.filter(d => d.id !== id);
  if (store.activeDraftId === id) {
    store.activeDraftId = store.drafts[0]?.id ?? null;
  }

  db.remove(id); // optimistic IDB removal

  const timer = setTimeout(async () => {
    await fetch(`/api/drafts/${id}`, { method: 'DELETE', credentials: 'include' });
    store.pendingDelete = null;
    if (store.drafts.length === 0) await createDraft();
  }, 30_000);

  store.pendingDelete = {
    draft,
    timer,
    undo() {
      clearTimeout(timer);
      db.put({ ...draft }); // restore to IDB
      store.drafts = [draft, ...store.drafts].sort((a, b) => b.updated_at - a.updated_at);
      store.activeDraftId = draft.id;
      store.pendingDelete = null;
    },
  };
}

export function setActive(id) {
  store.activeDraftId = id;
}

export function _reset() {
  if (store.pendingDelete?.timer) clearTimeout(store.pendingDelete.timer);
  store.drafts = [];
  store.activeDraftId = null;
  store.pendingDelete = null;
}
