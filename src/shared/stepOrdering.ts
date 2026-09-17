/**
 * Deterministic step ordering + orphan-screenshot helpers.
 *
 * Problems fixed:
 * - `sortBy("stepNumber")` is nondeterministic when two rows share a
 *   stepNumber (duplicate after a race, or a soft-deleted row reusing a
 *   number). All ordering goes through `sortSteps` (stepNumber, createdAt, id).
 * - `live.length + 1` reuses numbers held by soft-deleted rows.
 *   Append allocation uses max(all stepNumbers, session.actionCount) + 1.
 * - `getSessionBundle` returned screenshots for soft-deleted actions (orphans).
 *   Bundle now filters screenshots to live actionIds only.
 */

export interface OrderedLike {
  id: string;
  stepNumber: number;
  createdAt?: string;
}

export interface ScreenshotLike {
  id: string;
  actionId: string;
}

export function compareSteps(a: OrderedLike, b: OrderedLike): number {
  if (a.stepNumber !== b.stepNumber) return a.stepNumber - b.stepNumber;
  const aCreated = a.createdAt ?? "";
  const bCreated = b.createdAt ?? "";
  if (aCreated !== bCreated) return aCreated < bCreated ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Deterministic copy sorted by (stepNumber, createdAt, id). */
export function sortSteps<T extends OrderedLike>(steps: T[]): T[] {
  return [...steps].sort(compareSteps);
}

export function maxStepNumber(steps: Pick<OrderedLike, "stepNumber">[]): number {
  let max = 0;
  for (const step of steps) {
    if (Number.isFinite(step.stepNumber) && step.stepNumber > max) max = step.stepNumber;
  }
  return max;
}

/**
 * Next number for an appended step. Considers live rows, ALL rows (including
 * soft-deleted, which still occupy numbers), and the session monotonic
 * counter so concurrent insert+record can never reuse a number.
 */
export function nextAppendedStepNumber(
  live: Pick<OrderedLike, "stepNumber">[],
  sessionActionCount: number | undefined,
  all?: Pick<OrderedLike, "stepNumber">[]
): number {
  const liveMax = maxStepNumber(live);
  const allMax = all ? maxStepNumber(all) : 0;
  const counter = Number.isFinite(sessionActionCount) ? (sessionActionCount as number) : 0;
  return Math.max(liveMax, allMax, counter, 0) + 1;
}

/** Resolve a collision by bumping until free. Pure + testable. */
export function resolveStepCollision(desired: number, taken: Set<number> | number[]): number {
  const set = Array.isArray(taken) ? new Set(taken) : taken;
  let next = Math.max(1, Math.floor(desired) || 1);
  while (set.has(next)) next += 1;
  return next;
}

export interface ManualInsertPlan {
  stepNumber: number;
  /** Live action ids whose stepNumber must shift +1 (already sorted deterministically). */
  shiftedActionIds: string[];
}

/**
 * Plan an insert-after. New step takes after.stepNumber + 1; every live step
 * with stepNumber >= new number shifts +1. Returns ids in deterministic order.
 */
export function planManualInsert<T extends OrderedLike>(
  sortedLive: T[],
  insertAfterActionId: string
): ManualInsertPlan {
  const after = sortedLive.find((a) => a.id === insertAfterActionId);
  if (!after) throw new Error("Referenced step not found");
  const stepNumber = after.stepNumber + 1;
  const shiftedActionIds = sortedLive
    .filter((a) => a.stepNumber >= stepNumber)
    .map((a) => a.id);
  return { stepNumber, shiftedActionIds };
}

/** True when any live stepNumber appears twice. */
export function hasDuplicateStepNumbers(live: Pick<OrderedLike, "id" | "stepNumber">[]): boolean {
  const seen = new Set<number>();
  for (const step of live) {
    if (seen.has(step.stepNumber)) return true;
    seen.add(step.stepNumber);
  }
  return false;
}

/**
 * Deterministic renumber 1..N in current sorted order.
 * Used to repair duplicates and by reorder flows.
 */
export function renumberMap<T extends OrderedLike>(sortedLive: T[]): Map<string, number> {
  const map = new Map<string, number>();
  sortedLive.forEach((step, index) => {
    map.set(step.id, index + 1);
  });
  return map;
}

/** Screenshot ids whose action is missing or soft-deleted. */
export function collectOrphanScreenshotIds(
  screenshots: ScreenshotLike[],
  liveActionIds: Set<string> | string[]
): string[] {
  const live = Array.isArray(liveActionIds) ? new Set(liveActionIds) : liveActionIds;
  const orphans: string[] = [];
  for (const shot of screenshots) {
    if (!live.has(shot.actionId)) orphans.push(shot.id);
  }
  return orphans;
}

/** Filter screenshots to live actions only, deterministically sorted. */
export function filterBundleScreenshots<
  S extends ScreenshotLike & OrderedLike
>(screenshots: S[], liveActionIds: Set<string> | string[]): S[] {
  const live = Array.isArray(liveActionIds) ? new Set(liveActionIds) : liveActionIds;
  return sortSteps(screenshots.filter((shot) => live.has(shot.actionId)));
}

export function screenshotPathForStep(stepNumber: number): string {
  return `screenshots/step-${String(stepNumber).padStart(3, "0")}.jpg`;
}
