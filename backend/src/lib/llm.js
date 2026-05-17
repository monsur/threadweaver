import systemPrompt from '../prompts/generate-thread.txt?raw';

export async function generateThread(article, env) {
  const { title, url, author, highlights = [] } = article;

  let userMessage = `Title: ${title}\nAuthor: ${author}\nURL: ${url}`;
  if (highlights.length > 0) {
    userMessage += '\n\nHighlights:\n' + highlights.map((h, i) => `${i + 1}. ${h}`).join('\n');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.LLM_MODEL,
      max_tokens: parseInt(env.LLM_MAX_TOKENS),
      temperature: parseFloat(env.LLM_TEMPERATURE),
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);

  const data = await res.json();
  return data.content[0].text;
}
