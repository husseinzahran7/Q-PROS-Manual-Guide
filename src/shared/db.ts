import Dexie, { type Table } from "dexie";
import { collectOrphanScreenshotIds, renumberMap, sortSteps } from "./stepOrdering";
import type { ExportRecord, RecordedAction, RecordingSession, ScreenshotRecord } from "./types";

export class RecorderDatabase extends Dexie {
  sessions!: Table<RecordingSession, string>;
  actions!: Table<RecordedAction, string>;
  screenshots!: Table<ScreenshotRecord, string>;
  exports!: Table<ExportRecord, string>;

  constructor() {
    super("q-pros-manual-guide");
    this.version(1).stores({
      sessions: "id, status, createdAt, updatedAt",
      actions: "id, sessionId, stepNumber, createdAt, deleted",
      screenshots: "id, sessionId, actionId, stepNumber",
      exports: "id, sessionId, type, createdAt"
    });
  }
}

export const db = new RecorderDatabase();

export async function getSessionBundle(sessionId: string) {
  const session = await db.sessions.get(sessionId);
  if (!session) {
    throw new Error("Session not found");
  }
  const allActions = await db.actions.where("sessionId").equals(sessionId).sortBy("stepNumber");
  const allScreenshots = await db.screenshots.where("sessionId").equals(sessionId).sortBy("stepNumber");
  // Deterministic order even with duplicate stepNumbers (race / soft-deleted reuse).
  const actions = sortSteps(allActions.filter((action) => !action.deleted));
  const liveIds = new Set(actions.map((action) => action.id));
  // Exclude orphan shots (deleted-step or missing-action) so bundles/exports stay clean.
  const screenshots = sortSteps(allScreenshots.filter((shot) => liveIds.has(shot.actionId)));
  return {
    session,
    actions,
    screenshots
  };
}

/**
 * Hard-delete screenshots whose action is missing or soft-deleted.
 * Returns the number of pruned rows. Safe to run as a periodic job or
 * after delete/restore/reorder.
 */
export async function pruneOrphanScreenshots(sessionId?: string): Promise<number> {
  const shots = sessionId
    ? await db.screenshots.where("sessionId").equals(sessionId).toArray()
    : await db.screenshots.toArray();
  if (shots.length === 0) return 0;
  const sessionIds = [...new Set(shots.map((shot) => shot.sessionId))];
  const actions = await db.actions.where("sessionId").anyOf(sessionIds).toArray();
  const liveIds = new Set(actions.filter((action) => !action.deleted).map((action) => action.id));
  const orphans = collectOrphanScreenshotIds(shots, liveIds);
  if (orphans.length === 0) return 0;
  await db.screenshots.where(":id").anyOf(orphans).delete();
  return orphans.length;
}

/**
 * Deterministically renumber live steps 1..N and sync their screenshots.
 * Repairs duplicate/gapped numbering after races. Returns the new count.
 */
export async function normalizeStepNumbers(sessionId: string): Promise<number> {
  return db.transaction("rw", db.actions, db.screenshots, db.sessions, async () => {
    const all = await db.actions.where("sessionId").equals(sessionId).toArray();
    const live = sortSteps(all.filter((action) => !action.deleted));
    const plan = renumberMap(live);
    for (const [actionId, stepNumber] of plan) {
      await db.actions.update(actionId, { stepNumber });
      const related = await db.screenshots.where("actionId").equals(actionId).toArray();
      for (const shot of related) {
        await db.screenshots.update(shot.id, {
          stepNumber,
          path: `screenshots/step-${String(stepNumber).padStart(3, "0")}.jpg`
        });
      }
    }
    const session = await db.sessions.get(sessionId);
    if (session) {
      await db.sessions.update(sessionId, {
        actionCount: Math.max(session.actionCount, live.length),
        updatedAt: new Date().toISOString()
      });
    }
    return live.length;
  });
}
