import { describe, expect, it } from "vitest";
import {
  collectOrphanScreenshotIds,
  filterBundleScreenshots,
  hasDuplicateStepNumbers,
  nextAppendedStepNumber,
  planManualInsert,
  renumberMap,
  resolveStepCollision,
  screenshotPathForStep,
  sortSteps
} from "./stepOrdering";

describe("stepOrdering", () => {
  it("sorts deterministically by stepNumber, createdAt, id", () => {
    const steps = [
      { id: "b", stepNumber: 1, createdAt: "2026-05-25T00:00:01.000Z" },
      { id: "a", stepNumber: 1, createdAt: "2026-05-25T00:00:00.000Z" },
      { id: "c", stepNumber: 1, createdAt: "2026-05-25T00:00:00.000Z" }
    ];
    const sorted = sortSteps(steps);
    // Same stepNumber -> earliest createdAt first, then id.
    expect(sorted.map((s) => s.id)).toEqual(["a", "c", "b"]);
  });

  it("append uses max+1 not count+1 so soft-deleted rows never collide", () => {
    // Live steps 1 and 3 (step 2 soft-deleted but still occupies number 2).
    const live = [
      { stepNumber: 1 },
      { stepNumber: 3 }
    ];
    const all = [...live, { stepNumber: 2 }];
    // Old buggy logic: live.length + 1 = 3 -> duplicate.
    expect(live.length + 1).toBe(3);
    // Fixed logic: max(all, counter) + 1 = 4.
    expect(nextAppendedStepNumber(live, 3, all)).toBe(4);
  });

  it("concurrent insert+record resolves to unique sequential numbers", () => {
    // Both writers read the same snapshot: live 1..2, counter 2.
    const live = [{ stepNumber: 1 }, { stepNumber: 2 }];
    const all = [...live];
    const desiredA = nextAppendedStepNumber(live, 2, all);
    const desiredB = nextAppendedStepNumber(live, 2, all);
    expect(desiredA).toBe(3);
    expect(desiredB).toBe(3);
    // Writer A wins 3; writer B bumps to 4 inside its transaction.
    const takenAfterA = new Set([1, 2, desiredA]);
    const finalB = resolveStepCollision(desiredB, takenAfterA);
    expect(finalB).toBe(4);
    const numbers = [1, 2, desiredA, finalB].sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4]);
    expect(hasDuplicateStepNumbers(numbers.map((n, i) => ({ id: `a${i}`, stepNumber: n })))).toBe(false);
  });

  it("plans insert-after with deterministic shift set", () => {
    const sortedLive = sortSteps([
      { id: "a1", stepNumber: 1, createdAt: "2026-05-25T00:00:00.000Z" },
      { id: "a2", stepNumber: 2, createdAt: "2026-05-25T00:00:01.000Z" },
      { id: "a3", stepNumber: 3, createdAt: "2026-05-25T00:00:02.000Z" }
    ]);
    const plan = planManualInsert(sortedLive, "a1");
    expect(plan.stepNumber).toBe(2);
    expect(plan.shiftedActionIds).toEqual(["a2", "a3"]);
  });

  it("bundle excludes deleted-step shots and sorts deterministically", () => {
    const liveIds = new Set(["a1", "a3"]);
    const screenshots = [
      { id: "s2", actionId: "a2", stepNumber: 2, createdAt: "2026-05-25T00:00:02.000Z" },
      { id: "s3", actionId: "a3", stepNumber: 3, createdAt: "2026-05-25T00:00:03.000Z" },
      { id: "s1", actionId: "a1", stepNumber: 1, createdAt: "2026-05-25T00:00:01.000Z" },
      { id: "sX", actionId: "missing", stepNumber: 9, createdAt: "2026-05-25T00:00:09.000Z" }
    ];
    expect(collectOrphanScreenshotIds(screenshots, liveIds).sort()).toEqual(["s2", "sX"]);
    const filtered = filterBundleScreenshots(screenshots, liveIds);
    expect(filtered.map((s) => s.id)).toEqual(["s1", "s3"]);
  });

  it("renumbers deterministically 1..N", () => {
    const sorted = sortSteps([
      { id: "b", stepNumber: 5, createdAt: "2026-05-25T00:00:01.000Z" },
      { id: "a", stepNumber: 5, createdAt: "2026-05-25T00:00:00.000Z" }
    ]);
    const map = renumberMap(sorted);
    expect(map.get("a")).toBe(1);
    expect(map.get("b")).toBe(2);
  });

  it("formats screenshot paths with zero padding", () => {
    expect(screenshotPathForStep(1)).toBe("screenshots/step-001.jpg");
    expect(screenshotPathForStep(42)).toBe("screenshots/step-042.jpg");
  });
});
