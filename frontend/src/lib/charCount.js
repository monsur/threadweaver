const CHARACTER_LIMIT = 300;
const URL_WEIGHT = 20;
const MENTION_WEIGHT = 15;

const urlRegex = /(https?:\/\/[^\s]+)/g;
const mentionRegex = /(@[a-zA-Z0-9.]+)/g;

/**
 * Returns the Bluesky character count and safe/overage split for a chunk.
 * URLs count as 20, mentions count as 15, everything else counts as-is.
 */
export function getChunkDetails(chunk) {
  let length = 0;
  const parts = [];
  let lastIndex = 0;

  const matches = [
    ...Array.from(chunk.matchAll(urlRegex), m => ({ text: m[0], type: 'url', index: m.index })),
    ...Array.from(chunk.matchAll(mentionRegex), m => ({ text: m[0], type: 'mention', index: m.index })),
  ].sort((a, b) => a.index - b.index);

  for (const match of matches) {
    if (match.index > lastIndex) {
      const text = chunk.substring(lastIndex, match.index);
      length += text.length;
      parts.push({ text, type: 'text' });
    }
    const weight = match.type === 'url' ? URL_WEIGHT : MENTION_WEIGHT;
    length += weight;
    parts.push({ text: match.text, type: match.type });
    lastIndex = match.index + match.text.length;
  }

  if (lastIndex < chunk.length) {
    const text = chunk.substring(lastIndex);
    length += text.length;
    parts.push({ text, type: 'text' });
  }

  const isOverage = length > CHARACTER_LIMIT;

  let currentLength = 0;
  let safeText = '';
  let overageText = '';

  for (const part of parts) {
    const weight = part.type === 'url' ? URL_WEIGHT : part.type === 'mention' ? MENTION_WEIGHT : part.text.length;
    if (currentLength + weight <= CHARACTER_LIMIT) {
      safeText += part.text;
      currentLength += weight;
    } else {
      const remaining = CHARACTER_LIMIT - currentLength;
      const safeChars = part.text.length > remaining ? part.text.substring(0, remaining) : part.text;
      safeText += safeChars;
      overageText += part.text.substring(safeChars.length);
      currentLength += safeChars.length;
    }
  }

  return { length, isOverage, safeText, overageText };
}

export function countChars(text) {
  return getChunkDetails(text).length;
}
