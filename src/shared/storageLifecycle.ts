/* Thread 7 — permissions scope + storage lifecycle (pure, testable helpers).
   No chrome/Dexie imports here so vitest can run in jsdom. */

export const MAX_SESSION_SCREENSHOT_BYTES = 100 * 1024 * 1024; // 100 MB per session cap
export const QUOTA_WARN_RATIO = 0.8;
export const DEFAULT_KEEP_NEWEST = 10;
/** Rough post-JPEG size per step at current 1400px / q0.82 downsample. */
export const ESTIMATED_BYTES_PER_STEP = 80 * 1024; // 80 KB

export interface PerSessionUsage {
  sessionId: string;
  screenshotBytes: number;
  actionCount: number;
  screenshotCount: number;
}

export interface StorageWarningInput {
  usageBytes: number;
  quotaBytes: number;
  perSession: PerSessionUsage[];
}

export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  // base64 → bytes ≈ length * 0.75 (minus padding)
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.round((b64.length * 3) / 4) - padding);
}

/** Gate helper: true when a sender tab is allowed to record into the session. */
export function isRecordingTab(tabId: number | undefined, tabIds: number[] | undefined): boolean {
  if (tabId === undefined) return true; // extension UI / no tab context
  if (!tabIds || tabIds.length === 0) return true; // no gate yet (starting)
  return tabIds.includes(tabId);
}

export function getStorageWarning(input: StorageWarningInput): { warn: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const { usageBytes, quotaBytes, perSession } = input;
  if (quotaBytes > 0 && usageBytes / quotaBytes >= QUOTA_WARN_RATIO) {
    reasons.push(`usage ${(usageBytes / 1024 / 1024).toFixed(1)}MB near quota ${(quotaBytes / 1024 / 1024).toFixed(1)}MB`);
  }
  for (const entry of perSession) {
    if (entry.screenshotBytes >= MAX_SESSION_SCREENSHOT_BYTES) {
      reasons.push(`session ${entry.sessionId} over per-session cap`);
    }
  }
  // Project a 500-step session at current average step size; warn only when
  // the projection itself would blow most of the quota.
  if (perSession.length > 0 && quotaBytes > 0) {
    let totalBytes = 0;
    let totalSteps = 0;
    for (const entry of perSession) {
      totalBytes += entry.screenshotBytes;
      totalSteps += Math.max(1, entry.screenshotCount);
    }
    const avg = totalBytes / Math.max(1, totalSteps);
    const projected = Math.round(avg * 500);
    if (projected >= quotaBytes * QUOTA_WARN_RATIO && projected > 0) {
      reasons.push(`projected 500-step session ${(projected / 1024 / 1024).toFixed(1)}MB near quota`);
    }
  }
  return { warn: reasons.length > 0, reasons };
}

export interface PrunableSession {
  id: string;
  updatedAt: string;
}

/** Pick oldest sessions beyond keepNewest, never the active recording. */
export function pickSessionsToPrune(
  sessionsSortedAsc: PrunableSession[],
  keepNewest: number,
  activeSessionId?: string
): string[] {
  const keep = Math.max(0, Math.floor(keepNewest));
  const candidates = sessionsSortedAsc.filter((s) => s.id !== activeSessionId);
  // Oldest-first; drop everything beyond the newest `keep` (counting active as kept).
  const activeCountsAsKept = activeSessionId ? 1 : 0;
  const keepOthers = Math.max(0, keep - activeCountsAsKept);
  // candidates are oldest-first; keep the newest `keepOthers` of them.
  if (candidates.length <= keepOthers) return [];
  return candidates.slice(0, candidates.length - keepOthers).map((s) => s.id);
}

/** Progressive downsample params as a session grows toward its cap. */
export function getShotRenderParams(sessionBytes: number): { maxWidth: number; quality: number } {
  if (sessionBytes >= 80 * 1024 * 1024) return { maxWidth: 800, quality: 0.6 };
  if (sessionBytes >= 50 * 1024 * 1024) return { maxWidth: 1000, quality: 0.7 };
  return { maxWidth: 1400, quality: 0.82 };
}

/** Format helper shared by UI (kept pure for tests). */
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
