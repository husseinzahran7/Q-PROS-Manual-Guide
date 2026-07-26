# Q-PROS Manual Guide

> Record a browser workflow once, then export it as a human-readable manual test guide in Word, PDF, Markdown, or Playwright test format.

A local-first Chrome (Manifest V3) extension. You hit **Start recording**, do the task in your browser, and every click, input, navigation, and dialog is captured with a screenshot. Then edit the steps and export — as a Word document, PDF, Markdown SOP, Playwright test, or Chrome DevTools Recorder file.

Everything stays on your machine. No backend, no login, no cloud sync, no telemetry.

---

## Highlights

- **Captures what matters** — clicks, typing (with IME/composition handling), form changes, submits, keyboard shortcuts, navigations, SPA route changes, file uploads, drag & drop, and native `alert`/`confirm`/`prompt`/`print` dialogs.
- **A screenshot per step, with the clicked element highlighted** — taken at action time so the target element is still on screen and ringed for review.
- **Live REC overlay** — an on-page badge that confirms recording is active, flashes when each step is saved, can be **paused/resumed**, and is **draggable** out of the way.
- **Smart selectors** — every step stores role / label / placeholder / text / CSS / XPath candidates with a confidence score; low-confidence locators are flagged and editable.
- **Privacy by default** — password fields are never stored, sensitive-looking fields are masked, and their region is blacked out in the screenshot.
- **Editor / guide library** — rename, re-describe, drag-to-reorder, delete & restore, zoom screenshots, set the workflow goal & success criteria, and insert manual `note` / `wait` steps.
- **Rich exports** — Word (.docx), PDF, Markdown SOP, Playwright test, and Chrome DevTools Recorder JSON.
- **Bilingual UI** — English / 简体中文, following the browser language.
- **Keyboard shortcut** — `Alt+Shift+R` to start/stop anywhere.

## Install

### From source (developer mode)
1. `npm install && npm run build`
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/` folder.

## Usage

1. Click the extension icon → **Start recording** (or press `Alt+Shift+R`). The starting page URL is captured as step 1.
2. Do your task. The REC badge shows a step count and flashes "✓ step N saved" when each screenshot is stored — that's your cue to proceed.
3. **Stop recording**, then **Open guide library**.
4. Fill in the workflow **Goal** and **Success criteria**, tidy up steps, then **Export**.

## Export formats

| Output | What it's for |
| --- | --- |
| **Word** (`.docx`) | Professional manual test guide with screenshots. |
| **PDF** (`.pdf`) | Print-ready manual test guide with centered layout. |
| **SOP** (`.md`) | Human-readable step-by-step Markdown guide. |
| **Playwright** (`.ts`) | A `@playwright/test` script using semantic locators. |
| **DevTools Recorder** (`.json`) | Importable into Chrome DevTools → Recorder. |

## Privacy

All recording data lives in local IndexedDB on your machine. Password values are never stored; sensitive-looking field values are masked and redacted from screenshots. Nothing is uploaded — there is no backend.

## Architecture

| Area | File |
| --- | --- |
| Content script (capture + REC overlay) | `src/content/recorder.ts` |
| MAIN-world dialog hooks | `public/page-hooks.js` |
| Service worker (state, screenshots, storage, exports) | `src/background/serviceWorker.ts` |
| Popup UI | `src/popup/main.tsx` |
| Side panel (step editor + guide library) | `src/sidepanel/main.tsx` |
| Editor / guide library | `src/editor/main.tsx` |
| Selector engine | `src/shared/selector.ts` |
| Exporters (SOP / Playwright / DevTools / Skill Pack) | `src/shared/exporters.ts` |
| Word export | `src/shared/exportDocx.ts` |
| PDF export | `src/shared/exportPdf.ts` |
| Local DB (Dexie/IndexedDB) | `src/shared/db.ts` |
| Types & message protocol | `src/shared/types.ts` |
| i18n strings | `src/shared/i18n.ts` |

Stack: TypeScript, React 19, Vite 7, Dexie, docx.js, jsPDF. Manifest V3.

## Development

```bash
npm install
npm run dev         # Vite dev server
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build       # production build into dist/
npm run package     # build + zip into web-ext-artifacts/
```

Load the `dist/` folder via **Load unpacked** after a build.

## License

[MIT](LICENSE) © 2026 Hussein Zahran
