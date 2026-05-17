# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IELTS 练习系统 — a single-page vanilla JavaScript web application for IELTS exam practice (reading + listening). No framework, no TypeScript. Runs as static files served by a simple Node.js HTTP server.

## Commands

```bash
# Development server (port 3000, auto-opens browser)
node server.cjs

# esbuild watch mode (rebuilds app.bundle.js on change)
npm run dev

# Production build (minified app.bundle.js)
npm run build

# Build check (dry run, no output)
npm run check

# Concatenation bundler (legacy lazy-load groups → assets/bundles/)
node tools/build-bundles.js
```

## Architecture

### Module System (Hybrid: IIFE + ES Modules)

**IIFE modules** (majority of files) register globals on `window`:
```javascript
(function (global) {
    'use strict';
    // ...
})(typeof window !== 'undefined' ? window : this);
```

**ES modules** (newer files) use `import`/`export` but also register on `window` for backward compat. The `ES_MODULE_FILES` list in `js/runtime/lazyLoader.js` (lines 128-156) enumerates which files need `type="module"` script tags.

**Key globals:** `window.app` (ExamSystemApp), `window.storage`, `window.persistentStore`, `window.dataRepositories`, `window.ExamSystemAppMixins`, `window.AppLazyLoader`, `window.__READING_EXAM_DATA__`, `window.__LISTENING_EXAM_DATA__`

### Lazy Loading

`js/runtime/lazyLoader.js` defines 5 groups loaded via dynamic `<script>` injection:

| Group | Key Files | Dependencies |
|-------|-----------|--------------|
| `exam-data` | complete-exam-data.js, listening-exam-data.js | none |
| `state-core` | examIndex.js, practiceCore.js, resourceCore.js, state-service.js, libraryManager.js | none |
| `practice-suite` | spellingErrorCollector, markdownExporter, practiceRecordModal, practiceRecorder | state-core |
| `browse-runtime` | examActions.js, browseController.js, main.js + sub-modules (20+ files) | state-core |
| `more-tools` | moreView.js | state-core |

Load order within `browse-runtime` matters — `legacyViewBundle.js` first, `main.js` last. The concatenation bundler (`tools/build-bundles.js`) mirrors this exactly.

`js/runtime/boot-fallbacks.js` (39KB) provides proxy implementations that trigger lazy loading on first call.

### Mixin System

`ExamSystemApp` in `js/app/app.js` uses 5 mixins mixed into its prototype:
- `stateMixin` — `getState(path)`, `setState(path, value)`, `updateState(path, updates)`
- `bootstrapMixin` — app initialization
- `lifecycleMixin` — lifecycle events
- `navigationMixin` — `navigateToView(viewName)`, view switching
- `fallbackMixin` — fallback/proxy detection

Each mixin registers on `window.ExamSystemAppMixins.<name>`. `applyMixins()` merges them via `Object.assign`.

### View Switching

CSS class-based: `<div class="view active" id="browse-view">`. Core function `window.showView(viewName)` in `boot-fallbacks.js` toggles the `active` class. Views: `browse`, `mistakes`.

### Data Layer

Repository pattern: `StorageDataSource` → `DataRepositoryRegistry` → concrete repos (`PracticeRepository`, `SettingsRepository`, `MetaRepository`). All IIFEs registering on `window.ExamData`. Bootstrap in `js/data/index.js` exposes `window.dataRepositories`.

Exam data uses separate registries (`window.__READING_EXAM_DATA__`, `window.__LISTENING_EXAM_DATA__`) — Map-based stores with `register/get/has/keys/clear` API.

### Practice Sessions

Exams open in **new browser windows** via `js/app/examSession/windowManager.js`. Script injection through `dataInjector.js`. Communication via `postMessage`. Each exam type has a self-contained HTML page:
- `assets/generated/reading-exams/` — reading exams
- `assets/generated/listening-exams/` — listening exams

### Build System

- **esbuild** (`build.js`): Bundles `js/app/app.js` + imports → `assets/dist/app.bundle.js` (IIFE, ES2020)
- **Concatenation bundler** (`tools/build-bundles.js`): Groups of legacy JS → `assets/bundles/{group}.bundle.js`

## Critical Files

| File | Role |
|------|------|
| `js/runtime/lazyLoader.js` | Lazy group manifest + dynamic script loader |
| `js/runtime/boot-fallbacks.js` | Proxy implementations, `showView()`, nav setup |
| `js/app/app.js` | ExamSystemApp class, mixin application |
| `js/app/examActions.js` | Core exam display/sort/dedup logic (42KB, largest file) |
| `js/app/browseController.js` | Filter mode management (default/frequency-p1/prequency-p4) |
| `js/app/state-service.js` | Filter normalization, custom suite state (31KB) |
| `js/app/mixins/navigationMixin.js` | View navigation with history API |
| `js/runtime/examPages/unifiedReadingPage.js` | Self-contained reading exam renderer (114KB) |
| `js/runtime/examPages/unifiedListeningPage.js` | Self-contained listening exam renderer (35KB) |
| `css/variables.css` | CSS custom properties (design tokens) |
| `css/heroui-bridge.css` | Bridges HeroUI component styles to app theme |
| `css/main.css` | Main application styles |

## Design Tokens

Defined in `css/variables.css`. Theme is `ink` (amber/copper warm tones):
- `--color-gradient-primary` — primary gradient
- `--glass-blur: blur(20px)` — glassmorphism effect
- `--shui-text-strong: #111827` — primary text
- `--shui-text-muted: #6B7280` — secondary text
- `--shui-accent: #d97706` — accent color (amber)
- `--shui-accent-alt: #ea580c` — secondary accent (orange)

**Color constraint:** Never use blue-purple (#3730A3, #4338CA, etc.). The app uses only warm amber/copper tones.

## Code Style

- All user-facing text in Chinese (简体中文)
- Functions and variables use camelCase
- CSS classes use BEM-like naming (`.hero-card__value`, `.shui-filter-btn`)
- Dual button class system: HTML uses `.segmented-btn`, browseController creates `.shui-segmented-btn`. Always query both when selecting buttons: `.shui-segmented-btn, .segmented-btn`
