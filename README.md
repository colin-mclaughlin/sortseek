# 🧠 SortSeek – Your AI-Powered File Explorer

SortSeek is an intelligent desktop app that helps you **find, understand, and organize your documents** using the power of AI. Think of it as your personal file assistant: it lets you **summarize**, **search semantically**, and **navigate through PDFs, DOCX, and TXT files** – all from a beautiful local-first interface.

> ✨ Built with Electron + React + FastAPI + LangChain + ChromaDB

---

## 🚀 Features

- 🔍 **Semantic Search**: Find documents and file chunks by meaning, not just keywords.
- 🧠 **AI Summarization**: Get high-level summaries of entire files or specific clauses.
- 📄 **In-App Viewing**: View and explore PDF, DOCX, and TXT files directly in-app.
- ⚡ **Local-First**: Your files are processed locally. Fast, secure, and private.
- 🧭 **Navigation Tree**: Browse your folders and open files with a familiar sidebar layout.
- 📂 **"Index This Folder" Button**: Smartly indexes only what’s needed to keep things fast.
- 🔁 **File Change Detection**: Re-indexes only when documents actually change.

---

## 🧠 How It Works

SortSeek combines a powerful tech stack to deliver fast, intelligent document interaction:

- 🧩 **Electron + React + Tailwind + shadcn/ui** for the clean, responsive frontend  
- ⚙️ **FastAPI** backend serving AI-powered endpoints  
- 🔗 **LangChain + OpenAI** for summarization and embedding generation  
- 🧠 **ChromaDB** for local vector database and semantic search  
- 📚 **pdfminer + python-docx** for extracting file contents  
- 🚀 Smart logic to skip empty/unchanged files for fast incremental indexing  

---

## 🛠️ Installation (Dev)

To run SortSeek locally on your machine:

1. **Clone the repo**
   ```bash
   git clone https://github.com/colin-mclaughlin/sortseek.git
   cd sortseek
   ```

2. **Install dependencies**

   **Frontend:**
   ```bash
   cd frontend
   npm install
   ```

   **Backend:**
   ```bash
   cd ../backend
   python -m venv .venv
   .\.venv\Scripts\activate  # Or source .venv/bin/activate on Mac/Linux
   pip install -r requirements.txt
   ```

3. **Add your OpenAI key**

   Create a `.env` file inside the `backend/` folder:

   ```
   OPENAI_API_KEY=your_openai_key_here
   ```

4. **Start the app**

   In one terminal:
   ```bash
   cd backend
   uvicorn main:app --reload
   ```

   In a second terminal:
   ```bash
   cd frontend
   npm run dev
   ```

   App will be available at `http://localhost:5173/`

---

## 🛣️ Roadmap

- ✅ Clause-level TLDRs  
- ✅ Smart indexing with file change detection  
- ✅ View and summarize PDFs, DOCX, and TXT files  
- ✅ Semantic search with score boosting and highlighting  
- 🔜 File actions: rename, move, delete  
- 🔜 OCR support for image-based PDFs  
- 🔜 Desktop app installer (via Tauri or Electron Forge)  
- 🔜 User settings panel for themes, memory, and model selection  

---

## 📖 Background & Vision

SortSeek was born from a simple question:

> "What if your file explorer actually *understood* your documents?"

Most tools focus on finding filenames or full-text search. SortSeek goes deeper — letting you ask natural-language questions, explore clause-level summaries, and browse intelligently. It’s a new kind of desktop assistant for knowledge workers, students, and anyone drowning in files.

---

## 🤝 Contributing

This is a solo-built project in progress, but contributions, feedback, and issue reports are always welcome! Feel free to open a pull request or GitHub issue.

---

## 📄 License

MIT License. Use it, modify it, build on it.
