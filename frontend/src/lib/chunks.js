const SEPARATOR = /\n\n\n/;
const SEPARATOR_LEN = 3; // length of '\n\n\n'

export function splitChunks(text) {
  return text.split(SEPARATOR);
}

export function getCurrentChunkIndex(text, cursorPosition) {
  const chunks = splitChunks(text);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunkEnd = offset + chunks[i].length + (i < chunks.length - 1 ? SEPARATOR_LEN : 0);
    if (cursorPosition <= chunkEnd) return i;
    offset = chunkEnd;
  }
  return chunks.length - 1;
}
