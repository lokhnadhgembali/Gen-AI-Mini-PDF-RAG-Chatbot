require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { extractText } = require('./extractText');
const { chunkText } = require('./chunkText');
const {
  indexDocumentChunks,
  searchVectorStore,
  getStoreStats
} = require('./vectorStore');
const {
  sanitizeUserQuery,
  sanitizeAndFrameContext,
  getHardenedSystemPrompt
} = require('./sanitizeQuery');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for file upload
const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Ensure uploads dir exists
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}

let currentDocumentName = 'course-syllabus.pdf';

/**
 * Helper function to call Gemini Flash for answer synthesis
 */
async function generateAnswerWithGemini(systemPrompt, userQuery, framedContext) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    throw new Error('GEMINI_API_KEY is not configured in .env file.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

  const promptText = `${systemPrompt}\n\nRetrieved Document Context:\n${framedContext}\n\nUser Question:\n${userQuery}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: promptText }]
        }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini LLM API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  if (
    !data.candidates ||
    !data.candidates[0] ||
    !data.candidates[0].content ||
    !data.candidates[0].content.parts ||
    !data.candidates[0].content.parts[0]
  ) {
    throw new Error('Invalid response structure returned by Gemini API.');
  }

  return data.candidates[0].content.parts[0].text;
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

/**
 * GET /api/status - Get current store stats
 */
app.get('/api/status', (req, res) => {
  const stats = getStoreStats();
  res.json({
    status: 'success',
    currentDocument: currentDocumentName,
    indexedChunks: stats.totalChunks
  });
});

/**
 * POST /api/index - Index default or sample PDF/text
 */
app.post('/api/index', async (req, res) => {
  try {
    let sampleFilePath = path.join(__dirname, 'course-syllabus.pdf');
    let rawText = '';

    if (fs.existsSync(sampleFilePath)) {
      rawText = await extractText(sampleFilePath);
      currentDocumentName = 'course-syllabus.pdf';
    } else {
      // Default sample content if PDF file is not present yet
      rawText = `
StudyStack PEP Course Syllabus:
Week 1: Fundamentals of Node.js, Event Loop, Modules, and File System APIs.
Week 2: Express.js Routing, Middleware, Query Parameters vs Route Params, Custom Logger Middleware.
Week 3: Database Integration with MongoDB, Mongoose Schemas, CRUD Operations, and Aggregation Pipelines.
Week 4: Generative AI, LLM Completion APIs, Embeddings, Cosine Similarity, and RAG Architecture.
Security Module: Defense against Direct Prompt Injections and Indirect PDF Context Attacks.
`;
      currentDocumentName = 'Sample Syllabus (Default Text)';
    }

    const chunks = chunkText(rawText, 500, 50);
    const count = await indexDocumentChunks(chunks);

    res.json({
      message: `Successfully indexed ${count} chunks from "${currentDocumentName}"`,
      document: currentDocumentName,
      chunksIndexed: count
    });
  } catch (error) {
    console.error('Error during indexing:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/upload - Upload custom PDF file and index it
 */
app.post('/api/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const filePath = req.file.path;
    currentDocumentName = req.file.originalname;

    let rawText = '';
    if (req.file.originalname.endsWith('.pdf')) {
      rawText = await extractText(filePath);
    } else {
      rawText = fs.readFileSync(filePath, 'utf-8');
    }

    // Clean up temporary upload file
    fs.unlinkSync(filePath);

    const chunks = chunkText(rawText, 500, 50);
    const count = await indexDocumentChunks(chunks);

    res.json({
      message: `Successfully uploaded and indexed ${count} chunks from "${currentDocumentName}"`,
      document: currentDocumentName,
      chunksIndexed: count
    });
  } catch (error) {
    console.error('Error during file upload indexing:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ask - Ask question using RAG + Prompt Injection Security
 */
app.post('/api/ask', async (req, res) => {
  try {
    const { question, enforceSecurity = true } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Field "question" is required.' });
    }

    // Step 1: Security Inspection
    const securityCheck = sanitizeUserQuery(question);

    if (enforceSecurity && !securityCheck.isSafe) {
      return res.json({
        isSafe: false,
        securityBlocked: true,
        answer: '🛡️ SECURITY GUARDRAIL TRIGGERED: Prompt Injection Attempt Blocked! Your query contained patterns designed to bypass system rules or extract secret prompt instructions.',
        flags: securityCheck.flags,
        sources: []
      });
    }

    // Step 2: Retrieve relevant chunks using Vector Similarity Search
    const topChunks = await searchVectorStore(securityCheck.sanitizedQuery, 3);
    const { framedContext, rawText } = sanitizeAndFrameContext(topChunks);

    // Step 3: Answer Generation via Gemini LLM
    const systemPrompt = getHardenedSystemPrompt();
    const answer = await generateAnswerWithGemini(
      systemPrompt,
      securityCheck.sanitizedQuery,
      framedContext
    );

    res.json({
      isSafe: true,
      securityBlocked: false,
      answer,
      sources: topChunks.map(c => ({
        id: c.id,
        snippet: c.chunk.slice(0, 150) + '...',
        similarityScore: c.score.toFixed(4)
      })),
      flags: securityCheck.flags
    });
  } catch (error) {
    console.error('Error answering question:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 RAG Chatbot Server running on http://localhost:${PORT}`);
  console.log(`====================================================`);
});
