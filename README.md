# Latent

AI chat application built with [Tauri 2](https://v2.tauri.app/), React, and Rust.

## Prerequisites

- [Rust](https://www.rust-lang.org/) (latest stable)
- Node.js 18+
- Linux build dependencies:

```bash
sudo apt install libwebkit2gtk-4.1-dev libsoup-3.0-dev libssl-dev librsvg2-dev
```

## Getting Started

```bash
npm install
npm start
```

The app will start in development mode with hot reload.

## Usage

- **Toggle window**: `Ctrl+Shift+H` (or `Cmd+Shift+H` on macOS)
- **Send message**: `Enter` (use `Shift+Enter` for new line)
- **New chat**: Click "New Chat" in the sidebar
- **Settings**: Click the gear icon in the sidebar footer

### API Setup

1. Open Settings from the sidebar
2. Choose an AI provider (Google Gemini or OpenAI)
3. Enter your API key and save

## Build

```bash
npm run package
```

Produces a bundled executable in `src-tauri/target/release/bundle/`.

## Tech Stack

- **Desktop framework**: Tauri 2
- **Frontend**: React 19 + Vite 8
- **Backend**: Rust (AI calls, config management)
- **AI providers**: Google Gemini, OpenAI
- **Shortcuts**: tauri-plugin-global-shortcut
