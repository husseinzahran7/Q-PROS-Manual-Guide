import { describe, expect, it } from "vitest";
import {
  mergeOverlayTargets,
  resolveCaptureWindowId,
  withAckTimeout,
} from "./workerReliability";

describe("workerReliability", () => {
  it("prefers sender window for capture (multi-window fix)", () => {
    expect(
      resolveCaptureWindowId({ senderWindowId: 7, stateTabWindowId: 2 })
    ).toBe(7);
  });

  it("falls back to recording tab window when sender unknown", () => {
    expect(resolveCaptureWindowId({ stateTabWindowId: 2 })).toBe(2);
    expect(resolveCaptureWindowId({})).toBeUndefined();
  });

  it("merges sender tab into overlay targets", () => {
    expect(mergeOverlayTargets([1, 2], 3)).toEqual([1, 2, 3]);
    expect(mergeOverlayTargets([1, 2], 2)).toEqual([1, 2]);
    expect(mergeOverlayTargets([1], undefined)).toEqual([1]);
  });

  it("ack timeout falls back instead of hanging", async () => {
    const hanging = new Promise<string>(() => undefined);
    const result = await withAckTimeout(hanging, 10);
    expect(result.timedOut).toBe(true);
  });

  it("fast ack does not time out", async () => {
    const result = await withAckTimeout(Promise.resolve("ok"), 50);
    expect(result).toMatchObject({ value: "ok", timedOut: false });
  });
});
