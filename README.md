# SortSeek - Local-First File Assistant

SortSeek is a local-first desktop application that helps users find, understand, and organize their documents using AI-powered semantic search and intelligent suggestions.

## Features

### MVP Features (v1.0)

- **File Handling**
  - Recursive folder import
  - Supported formats: PDF, DOCX, TXT
  - In-app file preview
  - User-highlighted sections

- **Semantic Search & Q&A**
  - Full-text search bar across all indexed documents
  - LangChain with ChromaDB for embeddings
  - OpenAI GPT-4 integration for summarization and Q&A

- **Clause TLDRs**
  - "TL;DR this section" button when user highlights text
  - Show the summary in a sidebar panel

- **Smart Rename**
  - Suggest filenames based on document content
  - Suggest folder moves based on structure and past behavior
  - Allow user to review/modify before applying

- **Storage**
  - SQLite to store file metadata and search history
  - Local embeddings using ChromaDB

- **Privacy**
  - All data is stored locally
  - No telemetry or analytics

## Tech Stack

- **Frontend**: Electron + React + TypeScript (Vite)
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Python 3.12 + FastAPI
- **Parsing**: pdfplumber, python-docx, textract
- **Embeddings**: LangChain + ChromaDB
- **AI**: OpenAI GPT-4o
- **Bundle**: electron-builder

## Project Structure

```
sortseek/
├── electron/                 # Electron main and preload scripts
│   ├── main.ts              # Main process
│   └── preload.ts           # Preload script
├── src/                     # React frontend
│   ├── components/          # UI components
│   │   └── ui/             # shadcn/ui components
│   ├── lib/                # Utilities
│   ├── App.tsx             # Main app component
│   ├── main.tsx            # React entry point
│   └── index.css           # Global styles
├── backend/                 # Python FastAPI backend
│   ├── services/           # Business logic services
│   │   ├── file_service.py # File handling and parsing
│   │   ├── search_service.py # Semantic search
│   │   └── ai_service.py   # AI features
│   ├── main.py             # FastAPI app
│   ├── database.py         # Database configuration
│   ├── models.py           # SQLAlchemy models
│   └── requirements.txt    # Python dependencies
├── package.json            # Node.js dependencies
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind CSS configuration
└── README.md               # This file
```

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Python 3.12+
- OpenAI API key (optional, for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd sortseek
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Install Python dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   cd ..
   ```

4. **Set up environment variables** (optional)
   Create a `.env` file in the backend directory:
   ```bash
   OPENAI_API_KEY=your_openai_api_key_here
   ```

### Development

1. **Start the backend server**
   ```bash
   npm run backend:dev
   ```

2. **Start the Electron app**
   ```bash
   npm run electron:dev
   ```

3. **Or start both together**
   ```bash
   npm start
   ```

### Building for Production

1. **Build the application**
   ```bash
   npm run electron:build
   ```

2. **Find the built application in the `release` directory**

## Usage

1. **Launch SortSeek**
   - The app will start with an empty document library

2. **Import Documents**
   - Click "Import Folder" to recursively import all supported documents
   - Or drag and drop individual files

3. **Search Documents**
   - Use the search bar to find documents using semantic search
   - Results are ranked by relevance

4. **AI Features**
   - Highlight text and click "TL;DR" for instant summaries
   - Get filename suggestions based on content
   - Receive folder organization recommendations

## Development Notes

### Frontend Development
- The React app runs on `http://localhost:5173` in development
- Electron loads the React app in a desktop window
- Uses shadcn/ui components for consistent design

### Backend Development
- FastAPI server runs on `http://localhost:8000`
- SQLite database is stored in `./sortseek.db`
- Embeddings are stored in `./data/embeddings/`
- Documents are stored in `./data/documents/`

### API Endpoints
- `GET /` - Health check
- `GET /health` - Detailed health status
- `POST /import/folder` - Import folder recursively
- `POST /import/file` - Import single file
- `GET /documents` - List documents
- `POST /search` - Semantic search
- `POST /summarize` - Summarize text
- `POST /suggest-filename` - Suggest filename
- `POST /suggest-folder` - Suggest folder

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Privacy

SortSeek is designed with privacy in mind:
- All data is stored locally on your machine
- No data is sent to external servers (except OpenAI API calls when enabled)
- No telemetry or analytics
- Your documents remain private and secure 