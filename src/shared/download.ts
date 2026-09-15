/* =============================================================
   Shared client-side download helpers (single source of truth).

   Used by both the guide library (editor) and the sidepanel so the
   export-download path can't drift between the two surfaces.
   ============================================================= */

export function download(filename: string, content: string | Blob, type = "text/markdown") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function mimeForFilename(filename: string) {
  if (filename.endsWith(".ts")) return "text/typescript";
  if (filename.endsWith(".json")) return "application/json";
  return "text/markdown";
}

export function blobFromBase64(base64: string, type: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type });
}
