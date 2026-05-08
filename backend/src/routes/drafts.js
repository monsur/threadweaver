export async function listDrafts(db) {
  const { results } = await db.prepare(
    'SELECT * FROM drafts ORDER BY updated_at DESC'
  ).all();
  return results;
}

export async function createDraft(db, data = {}) {
  const draft = {
    id: data.id ?? crypto.randomUUID(),
    title: data.title ?? 'Untitled',
    content: data.content ?? '',
    notes: data.notes ?? '',
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  await db.prepare(
    'INSERT INTO drafts (id, title, content, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(draft.id, draft.title, draft.content, draft.notes, draft.created_at, draft.updated_at).run();
  return draft;
}

export async function getDraft(db, id) {
  return db.prepare('SELECT * FROM drafts WHERE id = ?').bind(id).first();
}

export async function updateDraft(db, id, data) {
  const existing = await getDraft(db, id);
  if (!existing) return null;
  const updated = {
    title:      data.title      ?? existing.title,
    content:    data.content    ?? existing.content,
    notes:      data.notes      ?? existing.notes,
    updated_at: Date.now(),
  };
  await db.prepare(
    'UPDATE drafts SET title = ?, content = ?, notes = ?, updated_at = ? WHERE id = ?'
  ).bind(updated.title, updated.content, updated.notes, updated.updated_at, id).run();
  return { ...existing, ...updated };
}

export async function deleteDraft(db, id) {
  const existing = await getDraft(db, id);
  if (!existing) return false;
  await db.prepare('DELETE FROM drafts WHERE id = ?').bind(id).run();
  return true;
}
