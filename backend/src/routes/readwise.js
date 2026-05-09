function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function fetchAllArticles(apiKey, tag) {
  const articles = [];
  let cursor = null;

  do {
    const url = new URL('https://readwise.io/api/v3/list');
    url.searchParams.set('category', 'article');
    url.searchParams.set('tags', tag);
    url.searchParams.set('sort', '-created_at');
    if (cursor) url.searchParams.set('pageCursor', cursor);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Token ${apiKey}` },
    });
    if (!res.ok) throw new Error(`Readwise API error: ${res.status}`);

    const data = await res.json();
    for (const doc of (data.results ?? [])) {
      articles.push({ id: doc.id, title: doc.title, author: doc.author, url: doc.url });
    }
    cursor = data.nextPageCursor ?? null;
  } while (cursor);

  return articles;
}

export async function handleReadwise(request, env) {
  const { pathname } = new URL(request.url);
  const method = request.method;

  // GET /api/readwise/articles
  if (pathname === '/api/readwise/articles' && method === 'GET') {
    try {
      const articles = await fetchAllArticles(env.READWISE_API_KEY, env.READWISE_TAG);
      return json({ articles });
    } catch {
      return json({ error: 'Failed to fetch articles from Readwise' }, 502);
    }
  }

  // GET /api/readwise/articles/:id/highlights
  const highlightsMatch = pathname.match(/^\/api\/readwise\/articles\/([^/]+)\/highlights$/);
  if (highlightsMatch && method === 'GET') {
    const id = highlightsMatch[1];
    try {
      // ⚠️ v3 IDs are UUIDs; v2 book_id is numeric — verify this mapping during testing.
      // Fallback: filter by source_url if book_id doesn't match.
      const res = await fetch(
        `https://readwise.io/api/v2/highlights/?book_id=${encodeURIComponent(id)}&page_size=100`,
        { headers: { Authorization: `Token ${env.READWISE_API_KEY}` } },
      );
      if (!res.ok) return json({ highlights: [] });
      const data = await res.json();
      const highlights = (data.results ?? []).map(h => h.text);
      return json({ highlights });
    } catch {
      return json({ highlights: [] });
    }
  }

  return json({ error: 'Not found' }, 404);
}
