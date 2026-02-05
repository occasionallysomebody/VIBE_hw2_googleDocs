# Collaborative Text Editor

Thread-safe multi-client text editing web app - blending Google Docs and Notion features. Built with Y.js CRDTs for conflict-free real-time collaboration.

## Quick Start

### Development Mode (Recommended)

```bash
npm install
npm run dev
```

This starts both the WebSocket server (port 1234) and Vite dev server (port 5173).

Open **http://localhost:5173** in your browser. Open multiple tabs/windows to test real-time collaboration.

### Production Mode

```bash
npm install
npm run build
npm start
```

Open **http://localhost:1234** in your browser.

## Features

### Google Docs-style Features
- **Rich Text Formatting** — Bold, italic, underline (Ctrl+B/I/U)
- **Toolbar** — Easy access to formatting options
- **Real-time Collaboration** — See collaborators' cursors and changes instantly
- **Word/Character Count** — Live statistics in status bar

### Notion-style Features
- **Block-based Editing** — Each paragraph/heading is a block
- **Multiple Block Types** — Headings (H1, H2, H3), paragraphs, lists, code blocks, quotes
- **Block Indicators** — Visual indicators for block types
- **Easy Block Creation** — Press Enter to create new blocks

### Technical Features
- **Thread-safe** — CRDT-based conflict resolution (no data loss)
- **Multi-client** — Unlimited simultaneous users
- **Real-time Sync** — Changes appear instantly across all clients
- **Presence Indicators** — See who's online
- **Connection Status** — Visual connection indicator

## Usage

1. **Start typing** — Click anywhere and start typing
2. **Format text** — Select text and use toolbar buttons or keyboard shortcuts
3. **Change block type** — Select a block and click a block type button (H1, H2, etc.)
4. **Create new blocks** — Press Enter to create a new block
5. **Merge blocks** — Press Backspace at the start of a block to merge with previous

## Keyboard Shortcuts

- `Ctrl/Cmd + B` — Bold
- `Ctrl/Cmd + I` — Italic
- `Ctrl/Cmd + U` — Underline
- `Enter` — Create new block
- `Backspace` (at block start) — Merge with previous block

## Architecture

- **Frontend**: Vite + Vanilla JavaScript + Y.js
- **Backend**: Node.js + WebSocket (ws) + Y.js server
- **Sync**: Y.js CRDTs for conflict-free replication
- **Build**: Vite for fast development and optimized production builds

## Full Documentation

See **[DOCS.md](./DOCS.md)** for detailed architecture, configuration, and deployment instructions.

## License

MIT
