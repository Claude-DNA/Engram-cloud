# Engram Cloud

A Tauri v2 desktop application built with React 18, TypeScript, Vite, TailwindCSS, Zustand, and React Router v7.

## Prerequisites

- Node.js 22 (use `nvm use`)
- Rust (stable) — install via [rustup](https://rustup.rs/)
- macOS: Xcode Command Line Tools

## Development

```bash
nvm use
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Tauri v2 |
| UI Framework | React 18 |
| Language | TypeScript |
| Bundler | Vite |
| Styling | TailwindCSS 3 |
| State | Zustand 5 |
| Routing | React Router v7 |

## Routes

| Path | Description |
|------|-------------|
| `/` | Home — Engram Cloud landing |
| `/cloud/:cloudType` | Cloud view by type |
| `/experience/:id` | Experience detail |
| `/timeline` | Timeline view |
| `/settings` | Application settings |

## Theme

The app uses a dark indigo palette defined as CSS custom properties:

| Variable | Hex | Usage |
|----------|-----|-------|
| `--color-background` | `#0f0d1a` | App background |
| `--color-surface` | `#1a1730` | Cards, panels |
| `--color-accent-gold` | `#d4a843` | Highlights, CTAs |
| `--color-text-primary` | `#e8e4f0` | Body text |
| `--color-text-secondary` | `#9b93b0` | Muted text |
| `--color-border` | `#2d2845` | Borders, dividers |
