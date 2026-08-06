# 🛡️ GenAI Mini PDF RAG Chatbot

A production-ready Retrieval-Augmented Generation (RAG) system built with **Node.js**, **Express**, **Google Gemini 3.6 API**, **Vector Embeddings**, and **Prompt Injection Security Guardrails**.

---

## 🌟 Key Features

* 📄 **PDF Text Extraction**: Extract & parse raw document text using `pdf-parse`.
* ✂️ **Smart Text Chunking**: Slices text into overlapping 500-word segments (50-word overlap) to preserve semantic context across boundaries.
* 🧠 **Vector Embeddings & Semantic Search**: Generates 768-dimensional embeddings using Gemini `gemini-embedding-2` and matches user queries via **Cosine Similarity** math.
* 🛡️ **Prompt Injection Defenses**:
  * **Direct Injection Defense**: Pre-filters user queries for jailbreaks, developer mode overrides (`DAN`), system prompt extraction, and instruction overrides.
  * **Indirect Injection Defense**: Sanitizes retrieved document context, frames text inside `<untrusted_pdf_context>` XML tags, and applies rigid system prompt rules.
* 💻 **Interactive Web Dashboard**: Beautiful, responsive UI with **Light / Dark Mode toggle**, drag-and-drop PDF upload, collapsible source inspector, and one-click security testing buttons.

---

## 📁 Repository Structure

```text
GenAI_Project/
├── server.js              # Express app, exposes /api/index, /api/upload, /api/ask, /api/status
├── extractText.js         # PDF text extraction module
├── chunkText.js           # Text chunking algorithm (~500 words, 50 overlap)
├── vectorStore.js         # Gemini Embeddings + Memory Store + Cosine Similarity Search
├── sanitizeQuery.js       # Prompt injection defense (Direct & Indirect security guardrails)
├── course-syllabus.txt    # Default document for RAG indexing
├── package.json           # Project dependencies
├── .env                   # GEMINI_API_KEY configuration (git-ignored)
└── public/                # Interactive Web UI (HTML, CSS, JS)
```

---

## ⚡ Quick Start

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/lokhnadhgembali/Gen-AI-Mini-PDF-RAG-Chatbot.git
cd Gen-AI-Mini-PDF-RAG-Chatbot/Gen-AI/GenAI_Project
npm install
```

### 2. Configure Environment Variables
Create a `.env` file inside `Gen-AI/GenAI_Project/`:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=4000
```

### 3. Start the Server
```bash
npm start
```
Open **`http://localhost:4000`** in your browser!

---

## 🧪 API Endpoints

### `POST /api/index`
Indexes default/sample document text into the vector store.

### `POST /api/upload`
Uploads a custom PDF or TXT file and indexes its vector embeddings.

### `POST /api/ask`
Answers questions grounded strictly in the indexed document text with prompt injection guardrails active.
```json
{
  "question": "What topics are covered in week 2?"
}
```

---

## 🔒 Security Guardrail Details

1. **Direct Injection Protection**: Detects and blocks malicious patterns such as `"ignore previous instructions"`, `"system override"`, or `"reveal system prompt"`.
2. **Context Delimiter Isolation**: Framed using `<untrusted_pdf_context>` XML tags.
3. **Strict Grounding**: Instructs Gemini to answer strictly from retrieved context or respond with *"I am sorry, but the provided document does not contain information to answer your question."*
