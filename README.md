# Luna Voice

Luna Voice is a desktop AI voice companion powered by ElevenLabs Conversational AI with a beautiful photoreal avatar and glassmorphic UI. Includes US lending domain expertise for borrower guidance.

## Features

### Voice & Conversation
- **ElevenLabs Conversational AI** - Natural voice conversations with the Luna SmartStart agent
- **Photoreal Luna Avatar** - Beautiful Filipina avatar with mood-reactive overlays
- **Light glassmorphic UI** - Chat.ly-style three-column layout

### Phase 2 Capabilities

#### File Upload & Parsing
- **Supported formats**: CSV, XLSX/XLS, PDF, DOCX, TXT, images (PNG/JPG/WEBP)
- **Automatic extraction**: Text and data parsed for context
- Click the **+** button to upload files

#### Memory System
- **Persistent memory**: Save and recall information across sessions
- **Tools**: `memory_save`, `memory_search`, `memory_list`, `memory_delete`
- Access via Memory tab in left sidebar

#### Knowledge Base (US Lending)
- Pre-loaded knowledge covering:
  - HMDA, CFPB, LEI regulations
  - Fed rates and how to look them up
  - LOS/POS systems overview
  - Capital markets basics
  - Lender types (depositories, credit unions, IMBs)
  - 50-state regulation overview
  - Compliance and SOC 2 / data security
  - AI governance in lending
  - Borrower paths (conventional, VA, FHA, first-time buyers)
- **Tools**: `kb_search`, `kb_topics`
- *Disclaimer: Educational guidance only, not legal advice*

#### 1003 Loan Application Checklist
- Guided walkthrough of Uniform Residential Loan Application sections
- Progress tracking across sessions
- **Tools**: `checklist_status`, `checklist_next`, `checklist_set_value`, `checklist_reset`
- Access via "1003" tab in left sidebar

#### OCR
- Extract text from images and scanned documents
- **Tool**: `ocr_extract`
- Useful for paystubs, W-2s, bank statements, ID documents

#### Web Search
- Search the web via Exa API
- Results shown in artifact panel with source citations
- **Tool**: `web_search`

### Other Features
- **Artifact panel** - Display markdown, charts, images, notes, and more
- **Computer use mode** - Optional macOS automation capabilities
- **macOS app** - Installable app you can keep in your Dock

## Requirements

- macOS (for full features) or Linux/Windows (basic features)
- Node.js 20+
- npm
- ElevenLabs API key with Conversational AI access

## Quick Start

```bash
git clone https://github.com/kokodagwapo/lunavoice.git
cd lunavoice
npm install
```

Create `.env.local` with your API keys:

```bash
# Required - ElevenLabs Conversational AI
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_AGENT_ID=agent_9201m2rz87evfjsaek9c3a275b62

# Optional - Exa web search
EXA_API_KEY=your_exa_api_key_here

# Optional - OpenAI for image generation tools
OPENAI_API_KEY=your_openai_api_key_here
```

Start the app:

```bash
npm run dev
```

## Testing Features

### Voice Call
1. `npm run dev`
2. Click the phone button (center-bottom)
3. Allow microphone access
4. Speak to Luna

### File Upload
1. Click the **+** button in the input bar
2. Select CSV, PDF, DOCX, or image files
3. View parsed content in Tool Execution panel

### Memory
1. Switch to **Memory** tab in left sidebar
2. Click "View Memories" to list saved memories
3. Ask Luna: "Remember that I prefer conventional loans"
4. Later ask: "What do you remember about my preferences?"

### Knowledge Base
1. Switch to **Memory** tab → "Knowledge Base"
2. Ask Luna: "What is HMDA?" or "Explain VA loans"
3. Results cite knowledge base articles

### 1003 Checklist
1. Switch to **1003** tab in left sidebar
2. Click "Continue 1003" to start/resume
3. Follow prompts to fill in loan application sections
4. Upload documents for OCR extraction

### OCR
1. Upload an image (paystub, W-2, ID)
2. Ask Luna: "Extract text from the uploaded image"
3. Review extracted text in artifact panel

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `ELEVENLABS_API_KEY` | Yes | ElevenLabs API key |
| `ELEVENLABS_AGENT_ID` | No | Agent ID (defaults to Luna SmartStart) |
| `EXA_API_KEY` | No | Exa API key for web search |
| `OPENAI_API_KEY` | No | OpenAI key for image generation |

## Building the macOS App

```bash
npm run dist:mac
# Output: release/Luna Voice-3.0.0.dmg
```

Or for a quick local build:
```bash
npm run pack:mac
# Output: release/mac/Luna Voice.app
```

## Development

```bash
npm run dev       # Start dev server + Electron
npm run typecheck # Type check
npm run build     # Production build
```

## macOS Permissions

- **Microphone** - Required for voice conversations
- **Accessibility** - Required for computer-control tools
- **Screen Recording** - Required for screenshots

## Phase 2 Checklist

| Feature | Status |
|---------|--------|
| File upload (CSV/XLSX/PDF/DOCX/images) | ✅ Done |
| Memory system (save/search/list/delete) | ✅ Done |
| Knowledge base (US lending) | ✅ Done |
| 1003 checklist guidance | ✅ Done |
| OCR extraction | ✅ Done |
| Web search (Exa) | ✅ Done |
| LOS API knowledge (Encompass, Calyx, etc.) | ✅ Done |
| Connector framework | ✅ Done |
| Secure API key management | ✅ Done |
| Settings panel | ✅ Done |
| App connectors (Gmail, Encompass, REST) | 🔲 Stub |

### LOS API Knowledge

Luna includes educational knowledge about major LOS platforms and their APIs:

- **ICE Encompass** - Developer Connect APIs, OAuth 2.0, loan/pipeline/document endpoints, webhooks
- **ICE Empower** - Cloud LOS API patterns
- **Calyx Point** - COM SDK, XML import/export, PointCentral
- **Dark Matter** - Modern cloud LOS
- **Other platforms** - Byte, LendingPad, MortgageBot, OpenClose, Arive, Blend, Floify

Ask Luna: "How do I integrate with Encompass?" or "What's the auth pattern for Calyx Point?"

*Note: This is educational guidance. Always verify against official vendor documentation.*

### Connector Framework

Luna features a pluggable connector framework for integrating with external services:

- **Manifest-based** - Each connector declares ID, name, auth type, required secrets, and tools
- **Enable/disable** - Toggle connectors from Settings panel
- **Status tracking** - View which connectors are configured and ready

Built-in connectors:
- Memory, Knowledge Base, File/OCR (core)
- Web Search (Exa)
- OpenAI (image generation)
- ElevenLabs (voice)
- Gmail (stub)
- Encompass (stub)
- Generic REST (stub)

### API Key Management

Secure storage for API keys and secrets:

- **OS keychain integration** - Uses Electron `safeStorage` where available
- **Settings UI** - Add/view/delete keys from Settings → API Keys
- **Masked values** - Keys displayed with masked characters
- **Env var support** - `.env.local` keys are auto-loaded

Access via: Settings button (top-right) → API Keys tab

## Disclaimers

- **Lending knowledge**: Educational guidance only. Not legal, financial, or compliance advice. Always verify with qualified professionals and official regulatory sources.
- **OCR**: Accuracy varies. Verify critical information manually.
- **Privacy**: Sensitive data (SSN, income) should be provided directly by the borrower, never invented or guessed.

## License

MIT
