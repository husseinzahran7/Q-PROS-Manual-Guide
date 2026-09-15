import { describe, expect, it } from "vitest";
import { EXPORT_MENU, EXPORT_MENU_TYPES } from "./exportMenu";
import { dictionary } from "./i18n";
import type { ExportType } from "./types";

const ALL_TYPES: ExportType[] = ["skill-pack", "markdown", "playwright", "devtools", "docx", "pdf"];

describe("shared export menu (sidepanel/editor parity)", () => {
  it("covers every export type exactly once", () => {
    expect(EXPORT_MENU).toHaveLength(6);
    expect([...EXPORT_MENU_TYPES].sort()).toEqual([...ALL_TYPES].sort());
    expect(new Set(EXPORT_MENU_TYPES).size).toBe(6);
  });

  it("resolves every label in both languages", () => {
    for (const option of EXPORT_MENU) {
      const entry = dictionary[option.labelKey];
      expect(entry, `missing i18n key ${option.labelKey}`).toBeDefined();
      expect(entry.en.trim().length).toBeGreaterThan(0);
      expect(entry.zh.trim().length).toBeGreaterThan(0);
    }
  });

  it("marks only worker-saved formats as non-client downloads", () => {
    const byType = new Map(EXPORT_MENU.map((option) => [option.type, option]));
    // docx/pdf are saved by the worker via chrome.downloads.
    expect(byType.get("docx")!.clientDownload).toBe(false);
    expect(byType.get("pdf")!.clientDownload).toBe(false);
    // markdown/playwright/devtools/skill-pack come back for the UI to save.
    for (const type of ["markdown", "playwright", "devtools", "skill-pack"] as const) {
      expect(byType.get(type)!.clientDownload).toBe(true);
    }
  });
});
