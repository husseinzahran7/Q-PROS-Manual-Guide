import { describe, expect, it } from "vitest";
import {
  DEFAULT_KEEP_NEWEST,
  ESTIMATED_BYTES_PER_STEP,
  MAX_SESSION_SCREENSHOT_BYTES,
  dataUrlBytes,
  getShotRenderParams,
  getStorageWarning,
  isRecordingTab,
  pickSessionsToPrune
} from "./storageLifecycle";

describe("storageLifecycle (thread 7: permissions + storage)", () => {
  it("gates events to recording tabs only — unrelated tabs dropped", () => {
    expect(isRecordingTab(11, [10, 12])).toBe(false);
    expect(isRecordingTab(10, [10, 12])).toBe(true);
    expect(isRecordingTab(undefined, [10])).toBe(true); // extension UI
    expect(isRecordingTab(99, [])).toBe(true); // no gate yet
    expect(isRecordingTab(99, undefined)).toBe(true);
  });

  it("computes base64 bytes without storing full buffers", () => {
    // "AAAA" -> 3 bytes
    expect(dataUrlBytes("data:image/jpeg;base64,AAAA")).toBe(3);
    expect(dataUrlBytes("")).toBe(0);
  });

  it("500-step session at current sizes stays under quota warning (unlimitedStorage)", () => {
    const perStep = ESTIMATED_BYTES_PER_STEP; // 80KB
    const usage = perStep * 500; // ~40MB
    const quota = 1024 * 1024 * 1024; // 1GB with unlimitedStorage
    const result = getStorageWarning({
      usageBytes: usage,
      quotaBytes: quota,
      perSession: [{ sessionId: "s1", screenshotBytes: usage, actionCount: 500, screenshotCount: 500 }]
    });
    expect(result.warn).toBe(false);
    // per-session cap is 100MB — 40MB session is fine
    expect(usage).toBeLessThan(MAX_SESSION_SCREENSHOT_BYTES);
  });

  it("warns near quota or over per-session cap", () => {
    const overQuota = getStorageWarning({
      usageBytes: 900,
      quotaBytes: 1000,
      perSession: []
    });
    expect(overQuota.warn).toBe(true);

    const overCap = getStorageWarning({
      usageBytes: 10,
      quotaBytes: 1_000_000_000,
      perSession: [{ sessionId: "big", screenshotBytes: MAX_SESSION_SCREENSHOT_BYTES + 1, actionCount: 900, screenshotCount: 900 }]
    });
    expect(overCap.warn).toBe(true);
    expect(overCap.reasons.join(" ")).toContain("big");
  });

  it("prunes oldest beyond keep, sparing the active recording", () => {
    const sessions = [
      { id: "oldest", updatedAt: "2026-01-01" },
      { id: "mid", updatedAt: "2026-02-01" },
      { id: "newest", updatedAt: "2026-03-01" }
    ];
    expect(pickSessionsToPrune(sessions, 2)).toEqual(["oldest"]);
    expect(pickSessionsToPrune(sessions, 10)).toEqual([]);
    // active recording is spared and counts toward keep
    expect(pickSessionsToPrune(sessions, 1, "oldest")).toEqual(["mid", "newest"]);
    expect(pickSessionsToPrune(sessions, 2, "newest")).toEqual(["oldest"]);
    expect(DEFAULT_KEEP_NEWEST).toBe(10);
  });

  it("degrades shot quality as session approaches cap (auto-downsample)", () => {
    expect(getShotRenderParams(0)).toEqual({ maxWidth: 1400, quality: 0.82 });
    expect(getShotRenderParams(60 * 1024 * 1024)).toEqual({ maxWidth: 1000, quality: 0.7 });
    expect(getShotRenderParams(90 * 1024 * 1024)).toEqual({ maxWidth: 800, quality: 0.6 });
  });
});
