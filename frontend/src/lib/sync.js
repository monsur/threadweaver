import * as db from './db.js';

export async function syncPending() {
  const all = await db.getAll();
  const pending = all.filter(d => d.pendingSync);
  if (pending.length === 0) return;

  for (const draft of pending) {
    const isCreate = draft.pendingSyncMethod === 'POST';
    const url = isCreate ? '/api/drafts' : `/api/drafts/${draft.id}`;
    const { pendingSync, pendingSyncMethod, ...body } = draft;

    try {
      const res = await fetch(url, {
        method: isCreate ? 'POST' : 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        // If the server assigned a different ID (shouldn't happen with client IDs), clean up
        if (updated.id !== draft.id) await db.remove(draft.id);
        await db.put(updated);
      }
      // If !res.ok, leave pendingSync for next attempt
    } catch {
      // Network error — leave pendingSync for next attempt
    }
  }
}
