export function filterDrafts(drafts, query) {
  if (!query.trim()) return drafts;
  const q = query.toLowerCase();
  return drafts.filter(d =>
    (d.title ?? '').toLowerCase().includes(q) ||
    (d.content ?? '').toLowerCase().includes(q) ||
    (d.notes ?? '').toLowerCase().includes(q)
  );
}
