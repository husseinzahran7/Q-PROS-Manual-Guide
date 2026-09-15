/**
 * Pure helpers for MV3 worker reliability (thread 3).
 * Kept free of chrome.* imports so vitest can cover them without mocks.
 */

export const DEDUPE_STORAGE_KEY = "dedupeState";
export const OVERLAY_ACK_TIMEOUT_MS = 200;

/**
 * Resolve which window to capture.
 * Priority: sender window (the tab that actually fired the event) first,
 * then the recording tab's window, then undefined (active window fallback).
 * Using state.tabId's window shoots the wrong window in multi-window runs.
 */
export function resolveCaptureWindowId(args: {
  senderWindowId?: number;
  senderTabId?: number;
  stateTabWindowId?: number;
}): number | undefined {
  if (typeof args.senderWindowId === "number") return args.senderWindowId;
  if (typeof args.stateTabWindowId === "number") return args.stateTabWindowId;
  return undefined;
}

/**
 * Merge the sender tab into the overlay target list so the hide/show
 * round-trip covers the tab that fired the event (multi-window / child tab).
 */
export function mergeOverlayTargets(targetTabs: number[], senderTabId?: number): number[] {
  if (senderTabId === undefined) return targetTabs;
  if (targetTabs.includes(senderTabId)) return targetTabs;
  return [...targetTabs, senderTabId];
}

/**
 * Race an ack promise against a timeout. Resolves with { timedOut: true }
 * instead of hanging forever when the content script is gone (navigated,
 * closed, or never injected). Callers treat timeout as "proceed anyway".
 */
export function withAckTimeout<T>(ack: Promise<T>, timeoutMs = OVERLAY_ACK_TIMEOUT_MS): Promise<{ value?: T; timedOut: boolean }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ value?: T; timedOut: boolean }>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), timeoutMs);
  });
  return Promise.race([
    Promise.resolve(ack).then(
      (value) => ({ value, timedOut: false }),
      () => ({ timedOut: true as const })
    ),
    timeout,
  ]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
