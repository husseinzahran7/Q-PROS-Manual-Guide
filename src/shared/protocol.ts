/* =============================================================
   Shared worker-protocol helpers (single source of truth).

   Pure mirrors of the service-worker logic so the message protocol
   (tab gate), export filenames, and screenshot pipeline math are
   unit-testable without chrome.* mocks:

   - isTabAllowedForRecording: same gate as handleMessage action:record
   - slugifySessionTitle / exportFilenameFor: same naming as createExport
   - screenshotPathFor: same path as persistScreenshot
   - base64ByteLength: same estimate as storageEstimate
   ============================================================= */

import type { ExportType } from "./types";

export const EXPORT_EXTENSION: Record<ExportType, string> = {
  "skill-pack": "zip",
  markdown: "md",
  playwright: "ts",
  devtools: "json",
  docx: "docx",
  pdf: "pdf"
};

/* Tab gate: refuse events from tabs outside the recording session.
   senderTabId is undefined for messages from extension UI surfaces,
   which are always allowed through. */
export function isTabAllowedForRecording(
  tabIds: number[] | undefined,
  senderTabId: number | undefined
): boolean {
  if (senderTabId === undefined) return true;
  if (!tabIds || tabIds.length === 0) return true;
  return tabIds.includes(senderTabId);
}

export function slugifySessionTitle(title: string): string {
  return (
    title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() ||
    "q-pros-manual-guide"
  );
}

export function exportFilenameFor(title: string, exportType: ExportType): string {
  return `${slugifySessionTitle(title)}.${EXPORT_EXTENSION[exportType]}`;
}

export function screenshotPathFor(stepNumber: number): string {
  return `screenshots/step-${String(stepNumber).padStart(3, "0")}.jpg`;
}

/* base64 data-URL → bytes, same approximation as storageEstimate. */
export function base64ByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const body = comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
  return Math.round(body.length * 0.75);
}
