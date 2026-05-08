export const store = $state({
  drafts: [],
  activeDraftId: null,
  pendingDelete: null,
});

export async function loadDrafts() {
  const res = await fetch('/api/drafts', { credentials: 'include' });
  if (!res.ok) return;
  store.drafts = await res.json();
  if (store.drafts.length > 0 && !store.activeDraftId) {
    store.activeDraftId = store.drafts[0].id;
  }
}

export async function createDraft(data = {}) {
  const res = await fetch('/api/drafts', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) return null;
  const draft = await res.json();
  store.drafts = [draft, ...store.drafts];
  store.activeDraftId = draft.id;
  return draft;
}

export async function updateDraft(id, data) {
  const res = await fetch(`/api/drafts/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) return null;
  const updated = await res.json();
  store.drafts = store.drafts.map(d => d.id === id ? updated : d);
  return updated;
}

export function deleteDraftWithUndo(id) {
  const draft = store.drafts.find(d => d.id === id);
  if (!draft) return;

  store.drafts = store.drafts.filter(d => d.id !== id);
  if (store.activeDraftId === id) {
    store.activeDraftId = store.drafts[0]?.id ?? null;
  }

  const timer = setTimeout(async () => {
    await fetch(`/api/drafts/${id}`, { method: 'DELETE', credentials: 'include' });
    store.pendingDelete = null;
  }, 30_000);

  store.pendingDelete = {
    draft,
    timer,
    undo() {
      clearTimeout(timer);
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
