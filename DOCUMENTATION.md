# Q-PROS Manual Guide — Documentation

## Table of Contents

1. [Overview](#overview)
2. [Why Q-PROS Manual Guide](#why-q-pros-manual-guide)
3. [Installation](#installation)
4. [Quick Start](#quick-start)
5. [Features](#features)
6. [Recording Workflow](#recording-workflow)
7. [Editing Steps](#editing-steps)
8. [Export Formats](#export-formats)
9. [Privacy & Security](#privacy--security)
10. [Troubleshooting](#troubleshooting)
11. [FAQ](#faq)

---

## Overview

**Q-PROS Manual Guide** is a Chrome browser extension that records your browser interactions and automatically generates professional manual test guides. Perform a workflow once, and the extension captures every click, keystroke, form submission, and navigation — complete with screenshots — then exports it as a Word document, PDF, or other formats.

### Key Value Proposition

| Without Q-PROS | With Q-PROS |
|----------------|-------------|
| Write test steps manually | Steps captured automatically |
| Take screenshots manually | Screenshot per step, auto-captured |
| Inconsistent documentation | Standardized format every time |
| Hours to document a workflow | Minutes — record, review, export |

---

## Why Q-PROS Manual Guide

### Problem
Manual QA testers spend significant time documenting test procedures. A single workflow with 20 steps can take 30-60 minutes to document properly — writing each step, taking screenshots, formatting the document, and ensuring consistency.

### Solution
Q-PROS Manual Guide eliminates the documentation overhead:
- **Record** the workflow once by performing it naturally
- **Review** captured steps in the side panel editor
- **Export** a professional Word or PDF document in seconds

### Benefits
- **Time savings**: Reduce documentation time by 80-90%
- **Consistency**: Every guide follows the same professional format
- **Accuracy**: Steps are captured exactly as performed — no human error
- **Screenshots**: Automatically captured with the target element highlighted
- **Privacy**: Fully local — no data leaves your machine

---

## Installation

### Method 1: Load Unpacked (Development/Internal Use)

1. Download or clone the repository:
   ```
   git clone https://github.com/husseinzahran7/Q-PROS-Manual-Guide.git
   ```

2. Install dependencies and build:
   ```
   npm install
   npm run build
   ```

3. Open Chrome and navigate to:
   ```
   chrome://extensions
   ```

4. Enable **Developer mode** (toggle in top-right corner)

5. Click **Load unpacked** and select the `dist/` folder from the project

6. The Q-PROS Manual Guide icon appears in your Chrome toolbar

### Method 2: Load from ZIP (Team Distribution)

1. Download the extension ZIP file from your team lead or GitHub Release
2. Extract the ZIP to a permanent location (e.g., `C:\Extensions\Q-PROS-Manual-Guide`)
3. Follow steps 3-6 from Method 1, selecting the extracted folder

> **Note**: The extension requires Chrome version 114 or higher (Manifest V3 support).

---

## Quick Start

### Your First Recording

1. **Click the Q-PROS icon** in your Chrome toolbar

2. **Click "Start recording"** (or press `Alt+Shift+R` anywhere)

3. **Perform your workflow** — navigate, click, type, submit forms as normal

4. **Watch the REC badge** — a small overlay shows the step count and flashes when each step is saved

5. **Click "Stop recording"** when done

6. **Click "Open guide library"** to review your recording

7. **Edit steps** if needed (rename, reorder, add notes)

8. **Click "Export Word"** or **"Export PDF"** to generate your guide

### Example Workflow

Recording a login process:

| Step | Action Captured | Screenshot Shows |
|------|-----------------|------------------|
| 1 | Navigate to example.com/login | Login page |
| 2 | Click "Email" field | Email field focused |
| 3 | Enter "user@company.com" | Field with email typed |
| 4 | Click "Password" field | Password field focused |
| 5 | Enter password | Field masked (privacy) |
| 6 | Click "Sign In" button | Button highlighted |
| 7 | Navigate to dashboard | Dashboard page |

**Export result**: A Word/PDF document with all 7 steps, each with a screenshot and description.

---

## Features

### Recording Capabilities

| Feature | Description |
|---------|-------------|
| **Click capture** | Records which element was clicked with position |
| **Input capture** | Records typed text (shows full value, not individual keystrokes) |
| **Form changes** | Dropdown selections, checkbox toggles, radio buttons |
| **Navigation** | Page loads, SPA route changes, back/forward |
| **Keyboard shortcuts** | Enter, Tab, Escape, and key combinations |
| **File uploads** | Detects file selection events |
| **Drag & drop** | Captures drag start and drop targets |
| **Dialogs** | Alert, confirm, prompt, and print dialogs |
| **Multiple tabs** | Follows recording across tab switches |

### Screenshot System

- **One screenshot per step** — captured at the moment of action
- **Element highlighting** — clicked/interacted element is ringed in the screenshot
- **Automatic compression** — JPEG encoding keeps file sizes manageable
- **RE overlay excluded** — the recording badge never appears in screenshots

### Smart Input Handling

The extension uses intelligent debouncing for text input:

- Typing "Hello World" in a search bar = **1 step** (not 11 keystroke steps)
- The full text appears in the step description
- Natural typing pauses (up to 5 seconds) are handled correctly
- Input is flushed when you: click elsewhere, press Enter/Tab, navigate away, or submit a form

### Privacy by Design

- **Password fields** are never recorded — values are completely excluded
- **Sensitive fields** (detected by autocomplete attributes, type=password, etc.) are masked
- **Screenshot redaction** — sensitive field regions are blacked out in screenshots
- **No network requests** — everything stays on your machine
- **No analytics** — zero telemetry or tracking

### Step Editor (Side Panel)

| Action | How |
|--------|-----|
| **Rename a step** | Click the step title and edit |
| **Add description** | Click the description field and type |
| **Reorder steps** | Drag and drop steps up/down |
| **Delete a step** | Click the delete button (can be restored) |
| **Insert manual step** | Add a "Note" or "Wait" step |
| **Set workflow goal** | Describe what the workflow accomplishes |
| **Set success criteria** | Define how to verify the workflow worked |
| **Zoom screenshot** | Click a screenshot to view full size |
| **Mark sensitive** | Flag a step to mask its value |

### Bilingual Support

The extension UI automatically follows your browser language:
- **English** — default
- **简体中文** — Simplified Chinese

---

## Recording Workflow

### Step 1: Start Recording

1. Navigate to the page where your workflow begins
2. Click the Q-PROS icon → **Start recording**
3. The starting URL is automatically captured as Step 1
4. A REC badge appears on the page showing the live step count

### Step 2: Perform Your Workflow

Interact with the browser naturally:
- Click buttons and links
- Fill in forms
- Navigate between pages
- Submit data

Each action is captured with:
- Action type (click, input, navigation, etc.)
- Target element (with multiple selector strategies)
- Screenshot of the page
- Timestamp

### Step 3: Stop Recording

Click the Q-PROS icon → **Stop recording**

The REC badge disappears. All steps are saved locally in your browser.

### Step 4: Review and Edit

Click **Open guide library** to open the side panel:

1. Select your recording from the list
2. Review each step — title, description, screenshot
3. Edit as needed:
   - Fix unclear step titles
   - Add context in descriptions
   - Remove accidental clicks
   - Reorder steps if needed
   - Insert notes for important context

### Step 5: Export

Click **Export Word** or **Export PDF**:
- A save dialog appears
- Choose where to save the file
- The document is generated with:
  - Cover page (PDF only)
  - All steps with screenshots
  - Professional formatting

---

## Editing Steps

### Modifying Step Titles

Click any step title to edit it. The title should clearly describe the action:
- ✅ "Click the Login button"
- ✅ "Enter email in username field"
- ❌ "Click" (too vague)
- ❌ "Step 3" (not descriptive)

### Adding Descriptions

Click the description area below a title to add details:
- What data was entered
- Why this step matters
- What to expect after this action

### Reordering Steps

Drag a step by its handle (≡ icon) to reorder. This is useful if:
- Steps were captured out of order
- You want to group related actions

### Deleting Steps

Click the trash icon to remove a step. Deleted steps can be restored from the "Deleted steps" section.

### Manual Steps

Insert steps that weren't captured:
- **Note**: Add explanatory text (e.g., "Verify the confirmation email arrived")
- **Wait**: Add a pause (e.g., "Wait 3 seconds for the page to load")

---

## Export Formats

### Word Document (.docx)

Best for: Sharing with stakeholders, documentation repositories

Features:
- Professional formatting with Q-PROS branding
- Step-by-step layout with screenshots
- Table of contents compatible
- Editable in Microsoft Word, Google Docs, LibreOffice

### PDF Document (.pdf)

Best for: Print-ready guides, archiving, formal documentation

Features:
- Cover page with title, date, and URL
- Centered layout for clean presentation
- Screenshots centered on the page
- Page numbers and professional typography

### Markdown SOP (.md)

Best for: Developer wikis, GitHub repositories, technical documentation

Features:
- Plain text format
- Embeds screenshots as base links
- Version-control friendly
- Compatible with all Markdown renderers

### Playwright Test (.ts)

Best for: Automated test suites, CI/CD pipelines

Features:
- Generates a `@playwright/test` script
- Uses semantic locators (role, label, placeholder)
- Ready to run with `npx playwright test`
- Includes assertions for page state

### DevTools Recorder JSON (.json)

Best for: Chrome DevTools import, replay in browser

Features:
- Importable into Chrome DevTools → Recorder
- Step-by-step replay capability
- No coding required

---

## Privacy & Security

### Data Storage

All data is stored locally in your browser using IndexedDB:
- Recordings (session metadata)
- Steps (actions with screenshots)
- Screenshots (JPEG images)

**No data is transmitted anywhere.** There is:
- ❌ No backend server
- ❌ No cloud storage
- ❌ No analytics or tracking
- ❌ No account or login required

### What Is Recorded

| Recorded | Not Recorded |
|----------|--------------|
| URLs and page titles | Browsing history |
| Element interactions (clicks, inputs) | Other tabs (unless recording) |
| Typed text in form fields | Passwords |
| Screenshots of the active tab | Bookmarks |
| Dialog messages (alert, confirm) | Cookies or tokens |

### Sensitive Data Protection

- **Password fields**: Completely excluded from recording
- **Autocomplete-sensitive fields**: Values are masked
- **Screenshot redaction**: Sensitive field regions are blacked out
- **User control**: Any step can be marked as sensitive

### Permissions Explanation

| Permission | Why It's Needed |
|------------|-----------------|
| `activeTab` | Capture the current tab you're recording |
| `tabs` | Track which tab is being recorded |
| `scripting` | Inject the recorder into pages |
| `storage` | Save recordings locally (IndexedDB) |
| `sidePanel` | Display the step editor panel |
| `downloads` | Save exported Word/PDF files |
| `<all_urls>` | Record on any website you choose |

---

## Troubleshooting

### "No steps are being recorded"

1. **Reload the page** after installing the extension
2. **Check the REC badge** — it should appear when recording starts
3. **Try clicking** on a link or button — the step count should increase
4. **Open DevTools** (F12) → Console tab → look for errors

### "Screenshots are blank or missing"

1. Ensure the extension has permission for the site
2. Check that `chrome.tabs.captureVisibleTab` works (test in DevTools)
3. Try recording on a simpler page (e.g., google.com)

### "Export fails"

1. **Check the Service Worker**: Go to `chrome://extensions` → find Q-PROS → click "Service Worker" link → check Console for errors
2. **Try a different export format** (Word vs PDF)
3. **Ensure enough disk space** for the file

### "Extension icon doesn't appear"

1. Go to `chrome://extensions`
2. Find "Q-PROS Manual Guide"
3. Click the pin icon to pin it to your toolbar

### "Steps show wrong titles"

Steps are titled automatically based on the action. You can:
- Edit step titles manually in the side panel
- The title updates will be reflected in the export

---

## FAQ

### Q: Does this work on all websites?
**A:** Yes, the extension works on any website. Some sites with heavy JavaScript frameworks (React, Angular, Vue) may have timing issues with screenshots, but step capture still works.

### Q: Can I record in multiple tabs?
**A:** Yes. If you click a link that opens a new tab, the recording follows you. Steps from all tabs are included in the final guide.

### Q: How long can a recording be?
**A:** There's no hard limit. However, very long recordings (100+ steps) may use significant browser storage. Each screenshot is approximately 50-100KB.

### Q: Can I edit a recording after stopping?
**A:** Yes. Open the guide library, select your recording, and edit any step — titles, descriptions, order, or delete unwanted steps.

### Q: Does it work with Single Page Applications (SPAs)?
**A:** Yes. The extension captures route changes in SPAs (React Router, Vue Router, Angular Router) as navigation steps.

### Q: Is my data safe?
**A:** Yes. All data stays on your machine. No network requests are made except for loading Google Fonts for the UI. Passwords are never recorded.

### Q: Can I export to multiple formats?
**A:** Yes. Each export is independent — record once, export as Word, PDF, Markdown, or Playwright as needed.

### Q: Does this work in Edge, Brave, or other Chromium browsers?
**A:** Yes. Any Chromium-based browser (Edge, Brave, Vivaldi, Arc) supports Chrome extensions.

---

## Support

For issues, feature requests, or questions:
- **GitHub Issues**: https://github.com/husseinzahran7/Q-PROS-Manual-Guide/issues
- **Email**: husseinz@q-pros.com

---

*Last updated: July 2026*
