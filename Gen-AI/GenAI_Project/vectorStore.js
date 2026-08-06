require('dotenv').config();

let store = []; // Structure: [{ id: number, chunk: string, embedding: number[] }]

/**
 * Calculates Cosine Similarity between two numerical vectors.
 * @param {number[]} a - Vector A
 * @param {number[]} b - Vector B
 * @returns {number} - Cosine similarity score between -1 and 1
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const sqrtMag = Math.sqrt(magA) * Math.sqrt(magB);
  if (sqrtMag === 0) return 0;

  return dotProduct / sqrtMag;
}

/**
 * Generates vector embedding for a given text string using Gemini API.
 * @param {string} text 
 * @returns {Promise<number[]>}
 */
async function generateEmbedding(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
    throw new Error("GEMINI_API_KEY is not configured in .env file.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      content: {
        parts: [{ text: text }]
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Embedding API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.embedding || !data.embedding.values) {
    throw new Error("Invalid embedding response format received from Gemini API.");
  }

  return data.embedding.values;
}

/**
 * Indexes an array of text chunks into the in-memory vector store.
 * @param {Array<string>} chunks 
 * @returns {Promise<number>} - Count of indexed chunks
 */
async function indexDocumentChunks(chunks) {
  store = []; // Reset store for new document

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const embedding = await generateEmbedding(chunk);
      store.push({
        id: i + 1,
        chunk: chunk,
        embedding: embedding
      });
    } catch (err) {
      console.error(`Failed to generate embedding for chunk #${i + 1}:`, err.message);
    }
  }

  return store.length;
}

/**
 * Searches stored chunks for those most similar to the query.
 * @param {string} query 
 * @param {number} topK 
 * @returns {Promise<Array<{ chunk: string, score: number, id: number }>>}
 */
async function searchVectorStore(query, topK = 3) {
  if (store.length === 0) {
    throw new Error("Vector store is empty. Please index a document first.");
  }

  const queryEmbedding = await generateEmbedding(query);

  const scoredChunks = store.map(item => ({
    id: item.id,
    chunk: item.chunk,
    score: cosineSimilarity(queryEmbedding, item.embedding)
  }));

  // Sort by score descending
  scoredChunks.sort((a, b) => b.score - a.score);

  return scoredChunks.slice(0, topK);
}

/**
 * Returns current store statistics.
 */
function getStoreStats() {
  return {
    totalChunks: store.length
  };
}

module.exports = {
  cosineSimilarity,
  generateEmbedding,
  indexDocumentChunks,
  searchVectorStore,
  getStoreStats
};
