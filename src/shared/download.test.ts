import { describe, expect, it, vi } from "vitest";
import { blobFromBase64, download, mimeForFilename } from "./download";

describe("download helpers (shared editor + sidepanel path)", () => {
  it("maps filenames to mime types", () => {
    expect(mimeForFilename("guide.md")).toBe("text/markdown");
    expect(mimeForFilename("spec.playwright.ts")).toBe("text/typescript");
    expect(mimeForFilename("recording.json")).toBe("application/json");
    expect(mimeForFilename("notes.txt")).toBe("text/markdown");
  });

  it("round-trips base64 through a Blob", async () => {
    const original = "hello q-pros #1";
    const base64 = btoa(original);
    const blob = blobFromBase64(base64, "text/plain");
    expect(blob.type).toBe("text/plain");
    expect(blob.size).toBe(original.length);
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(blob);
    });
    expect(text).toBe(original);
  });

  it("downloads via object URL and revokes it", () => {
    const create = vi.fn(() => "blob:mock-url");
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });

    const click = vi.fn();
    const anchor = { href: "", download: "", click } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValueOnce(anchor);

    download("guide.md", "# hello", "text/markdown");

    expect(create).toHaveBeenCalledTimes(1);
    expect(anchor.href).toBe("blob:mock-url");
    expect(anchor.download).toBe("guide.md");
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:mock-url");

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("downloads Blob content untouched", () => {
    const create = vi.fn(() => "blob:mock-url");
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });

    const click = vi.fn();
    const anchor = { href: "", download: "", click } as unknown as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValueOnce(anchor);

    const blob = new Blob(["zip-bytes"], { type: "application/zip" });
    download("pack.zip", blob, "application/zip");

    expect(create).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
