/**
 * Splits input text into overlapping chunks.
 * @param {string} text - The extracted document text
 * @param {number} chunkSize - Number of words per chunk (default: 500)
 * @param {number} overlap - Word overlap between consecutive chunks (default: 50)
 * @returns {Array<string>} - Array of text chunks
 */
function chunkText(text, chunkSize = 500, overlap = 50) {
  if (!text || typeof text !== 'string') return [];

  // Clean whitespace and split by words
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return [];

  const chunks = [];
  const step = Math.max(1, chunkSize - overlap);

  for (let i = 0; i < words.length; i += step) {
    const chunkWords = words.slice(i, i + chunkSize);
    const chunkStr = chunkWords.join(' ').trim();
    if (chunkStr.length > 0) {
      chunks.push(chunkStr);
    }
  }

  return chunks;
}

module.exports = { chunkText };
