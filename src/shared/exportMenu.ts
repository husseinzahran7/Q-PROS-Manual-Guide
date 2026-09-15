/* =============================================================
   Shared export menu (single source of truth for export parity).

   The guide library (editor) and the sidepanel render their export
   buttons from EXPORT_MENU so neither surface can fall behind the
   other when a format is added. Labels resolve through i18n.

   clientDownload mirrors the service worker: text formats come back
   as `content` and the ZIP as `base64` for the UI to save itself,
   while docx/pdf are saved by the worker via chrome.downloads and
   only report success.
   ============================================================= */

import type { MessageKey } from "./i18n";
import type { ExportType } from "./types";

export interface ExportMenuOption {
  type: ExportType;
  labelKey: MessageKey;
  fileExtension: string;
  clientDownload: boolean;
}

export const EXPORT_MENU: ExportMenuOption[] = [
  { type: "markdown", labelKey: "editor.export.markdown", fileExtension: "md", clientDownload: true },
  { type: "playwright", labelKey: "editor.export.playwright", fileExtension: "ts", clientDownload: true },
  { type: "devtools", labelKey: "editor.export.devtools", fileExtension: "json", clientDownload: true },
  { type: "skill-pack", labelKey: "editor.export.skillpack", fileExtension: "zip", clientDownload: true },
  { type: "docx", labelKey: "editor.export.docx", fileExtension: "docx", clientDownload: false },
  { type: "pdf", labelKey: "editor.export.pdf", fileExtension: "pdf", clientDownload: false }
];

export const EXPORT_MENU_TYPES: ExportType[] = EXPORT_MENU.map((option) => option.type);
