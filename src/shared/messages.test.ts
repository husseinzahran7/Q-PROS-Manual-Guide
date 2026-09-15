import { beforeEach, describe, expect, it, vi } from "vitest";
import { isOk, sendMessage } from "./messages";

describe("message bridge (chrome.* mocked)", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", {
      runtime: { sendMessage: vi.fn() }
    });
  });

  it("forwards AppMessages and resolves data", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, data: [{ id: "session_1" }] });
    (globalThis as unknown as { chrome: { runtime: { sendMessage: typeof send } } }).chrome.runtime.sendMessage = send;

    const response = await sendMessage<{ id: string }[]>({ type: "session:list" });

    expect(send).toHaveBeenCalledWith({ type: "session:list" });
    if (!isOk<{ id: string }[]>(response)) throw new Error("expected ok");
    expect(response.data).toEqual([{ id: "session_1" }]);
  });

  it("surfaces worker errors through isOk narrowing", async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, error: "Session not found" });
    (globalThis as unknown as { chrome: { runtime: { sendMessage: typeof send } } }).chrome.runtime.sendMessage = send;

    const response = await sendMessage({ type: "session:get", sessionId: "missing" });

    expect(isOk(response)).toBe(false);
    if (isOk(response)) throw new Error("expected error");
    expect(response.error).toBe("Session not found");
  });

  it("covers the full sidepanel/editor export protocol", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, data: { success: true } });
    (globalThis as unknown as { chrome: { runtime: { sendMessage: typeof send } } }).chrome.runtime.sendMessage = send;

    for (const exportType of ["markdown", "playwright", "devtools", "skill-pack", "docx", "pdf"] as const) {
      const response = await sendMessage({ type: "export:create", sessionId: "s1", exportType });
      expect(send).toHaveBeenCalledWith({ type: "export:create", sessionId: "s1", exportType });
      expect(isOk(response)).toBe(true);
    }
  });

  it("covers reorder + restore + delete-step used by both surfaces", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, data: null });
    (globalThis as unknown as { chrome: { runtime: { sendMessage: typeof send } } }).chrome.runtime.sendMessage = send;

    await sendMessage({ type: "session:reorder-steps", sessionId: "s1", actionIds: ["a", "b"] });
    await sendMessage({ type: "session:restore-step", actionId: "a" });
    await sendMessage({ type: "session:delete-step", actionId: "b" });

    expect(send).toHaveBeenCalledTimes(3);
  });
});
