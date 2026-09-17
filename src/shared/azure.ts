import type { SessionBundle } from "./types";

export const AZURE_API_VERSION = "7.1";
export const AZURE_CONFIG_KEY = "qpros.azure.config";

export interface AzureConfig {
  org: string;
  project: string;
  /** Personal Access Token. Stored in chrome.storage.local only. Never synced, never logged. */
  pat: string;
}

export interface AzurePushOptions {
  runName?: string;
  /** Reuse an existing run instead of creating one. */
  runId?: number;
  /** Optional extra run-level files already exported (filenames only, no bytes). */
  runFiles?: string[];
}

export interface AzurePushResult {
  runId: number;
  resultId: number;
  runWebUrl: string;
  attachmentCount: number;
  runAttachmentCount: number;
}

function toBase64Ascii(input: string): string {
  // PATs are ASCII; btoa exists in SW + pages, Buffer in Node/vitest.
  if (typeof globalThis.btoa === "function") return globalThis.btoa(input);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buf = (globalThis as any).Buffer;
  if (buf) return buf.from(input, "utf-8").toString("base64");
  throw new Error("No base64 encoder available");
}

export function azureAuthHeader(pat: string): string {
  return `Basic ${toBase64Ascii(`:${pat}`)}`;
}

export function sanitizeSegment(value: string): string {
  return value.trim();
}

export function validateAzureConfig(config: Partial<AzureConfig>): string[] {
  const errors: string[] = [];
  if (!config.org || !sanitizeSegment(config.org)) errors.push("Organization is required.");
  if (!config.project || !sanitizeSegment(config.project)) errors.push("Project is required.");
  if (!config.pat) errors.push("Personal Access Token is required.");
  return errors;
}

/** Redacted copy safe for UI state / logs. Never includes the PAT. */
export function redactAzureConfig(config: Partial<AzureConfig>): { org: string; project: string; hasPat: boolean } {
  return {
    org: sanitizeSegment(config.org ?? ""),
    project: sanitizeSegment(config.project ?? ""),
    hasPat: Boolean(config.pat)
  };
}

function enc(value: string): string {
  return encodeURIComponent(sanitizeSegment(value));
}

export function azureRunsUrl(org: string, project: string): string {
  return `https://dev.azure.com/${enc(org)}/${enc(project)}/_apis/test/runs?api-version=${AZURE_API_VERSION}`;
}

export function azureRunUrl(org: string, project: string, runId: number): string {
  return `https://dev.azure.com/${enc(org)}/${enc(project)}/_apis/test/runs/${runId}?api-version=${AZURE_API_VERSION}`;
}

export function azureResultsUrl(org: string, project: string, runId: number): string {
  return `https://dev.azure.com/${enc(org)}/${enc(project)}/_apis/test/Runs/${runId}/results?api-version=${AZURE_API_VERSION}`;
}

export function azureResultAttachmentsUrl(org: string, project: string, runId: number, resultId: number): string {
  return `https://dev.azure.com/${enc(org)}/${enc(project)}/_apis/test/Runs/${runId}/Results/${resultId}/attachments?api-version=${AZURE_API_VERSION}`;
}

export function azureRunAttachmentsUrl(org: string, project: string, runId: number): string {
  return `https://dev.azure.com/${enc(org)}/${enc(project)}/_apis/test/Runs/${runId}/attachments?api-version=${AZURE_API_VERSION}`;
}

export function azureProjectsUrl(org: string): string {
  return `https://dev.azure.com/${enc(org)}/_apis/projects?api-version=${AZURE_API_VERSION}`;
}

export function azureRunWebUrl(org: string, project: string, runId: number): string {
  return `https://dev.azure.com/${enc(org)}/${enc(project)}/_test/runs?runId=${runId}`;
}

/** "1234" -> 1234, full run URL with ?runId=1234 -> 1234, else undefined. */
export function parseRunId(input: string): number | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  const match = trimmed.match(/[?&]runId=(\d+)/);
  if (match) return Number(match[1]);
  return undefined;
}

/** "data:image/jpeg;base64,AAAA" -> "AAAA". Pass-through when already raw. */
export function stripDataUrlPrefix(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  if (dataUrl.startsWith("data:") && comma !== -1) return dataUrl.slice(comma + 1);
  return dataUrl;
}

export function stepFileName(stepNumber: number): string {
  return `step-${String(stepNumber).padStart(3, "0")}.jpg`;
}

export function defaultRunName(sessionTitle: string): string {
  const title = sessionTitle.trim() || "Untitled workflow";
  return `Q-PROS: ${title}`;
}

export function buildRunPayload(runName: string): Record<string, unknown> {
  return { name: runName, automated: false, state: "InProgress" };
}

export function buildCompleteRunPayload(): Record<string, unknown> {
  return { state: "Completed" };
}

export function buildResultPayload(bundle: SessionBundle): Record<string, unknown>[] {
  const summary = bundle.session.summary?.trim();
  const comment = [
    bundle.session.title,
    summary ? `\n${summary}` : "",
    `\nRecorded ${bundle.actions.length} steps with Q-PROS Manual Guide. Screenshots attached per step.`
  ].join("");
  return [
    {
      testCaseTitle: bundle.session.title || "Q-PROS manual run",
      automatedTestName: `Q-PROS.${bundle.session.id}`,
      outcome: "Passed",
      state: "Completed",
      comment: comment.slice(0, 1000)
    }
  ];
}

export function buildAttachmentPayload(base64: string, fileName: string, comment: string): Record<string, unknown> {
  return {
    stream: base64,
    fileName,
    comment: comment.slice(0, 500),
    attachmentType: "GeneralAttachment"
  };
}

// ---------------------------------------------------------------------------
// azure-upload.json manifest for Skill Pack + pipeline reuse.
// No secrets, no image bytes — filenames + step mapping only.
// ---------------------------------------------------------------------------

export const AZURE_UPLOAD_MANIFEST_FORMAT = "q-pros-manual-guide.azure-upload.v1";
export const AZURE_UPLOAD_MANIFEST_FILE = "azure-upload.json";

export interface AzureUploadManifest {
  format: string;
  version: 1;
  session: { id: string; title: string; stepCount: number; startUrl: string };
  run: { name: string; resultTitle: string };
  result: { testCaseTitle: string; outcome: "Passed" };
  attachments: { step: number; actionId: string; fileName: string; path: string; comment: string }[];
  runFiles: string[];
  api: {
    apiVersion: string;
    createRun: string;
    addResults: string;
    addResultAttachment: string;
    completeRun: string;
    note: string;
  };
  createdAt: string;
}

export function generateAzureUploadManifest(
  bundle: SessionBundle,
  opts?: { runName?: string; runFiles?: string[]; createdAt?: string }
): AzureUploadManifest {
  const runName = opts?.runName?.trim() || defaultRunName(bundle.session.title);
  const startUrl = bundle.session.startUrl || bundle.actions[0]?.page.url || "";
  const attachments = bundle.actions.map((action, index) => {
    const step = index + 1;
    const fileName = stepFileName(step);
    return {
      step,
      actionId: action.id,
      fileName,
      path: `screenshots/${fileName}`,
      comment: `${action.title}`.slice(0, 200)
    };
  });
  return {
    format: AZURE_UPLOAD_MANIFEST_FORMAT,
    version: 1,
    session: {
      id: bundle.session.id,
      title: bundle.session.title,
      stepCount: bundle.actions.length,
      startUrl
    },
    run: { name: runName, resultTitle: bundle.session.title || "Q-PROS manual run" },
    result: { testCaseTitle: bundle.session.title || "Q-PROS manual run", outcome: "Passed" },
    attachments,
    runFiles: opts?.runFiles ?? [],
    api: {
      apiVersion: AZURE_API_VERSION,
      createRun: "POST /{organization}/{project}/_apis/test/runs?api-version=7.1",
      addResults: "POST /{organization}/{project}/_apis/test/Runs/{runId}/results?api-version=7.1",
      addResultAttachment:
        "POST /{organization}/{project}/_apis/test/Runs/{runId}/Results/{resultId}/attachments?api-version=7.1",
      completeRun: "PATCH /{organization}/{project}/_apis/test/runs/{runId}?api-version=7.1",
      note: "Upload screenshots sequentially as GeneralAttachment with base64 stream (data-URL prefix stripped). Auth: Basic base64(':' + PAT)."
    },
    createdAt: opts?.createdAt ?? new Date().toISOString()
  };
}
