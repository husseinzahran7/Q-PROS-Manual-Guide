import { describe, expect, it } from "vitest";
import { dictionary, t } from "./i18n";

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

describe("i18n dictionary (en/zh parity)", () => {
  it("has non-empty en + zh for every key", () => {
    const keys = Object.keys(dictionary);
    expect(keys.length).toBeGreaterThan(60);
    for (const key of keys) {
      const entry = dictionary[key];
      expect(entry.en.trim().length, `${key} en`).toBeGreaterThan(0);
      expect(entry.zh.trim().length, `${key} zh`).toBeGreaterThan(0);
    }
  });

  it("keeps placeholder variables identical across languages", () => {
    for (const [key, entry] of Object.entries(dictionary)) {
      expect(placeholders(entry.zh), `${key} placeholders`).toEqual(placeholders(entry.en));
    }
  });

  it("interpolates variables", () => {
    // lang resolves from navigator (jsdom default en) — either language is fine.
    const rendered = t("step.label", { n: 3, type: "click" });
    expect(rendered).toContain("3");
    expect(rendered).toContain("click");
    expect(rendered).not.toMatch(/\{n\}|\{type\}/);
  });

  it("covers the shared export menu + sidepanel surfaces", () => {
    for (const key of [
      "editor.export.markdown",
      "editor.export.playwright",
      "editor.export.devtools",
      "editor.export.docx",
      "editor.export.pdf",
      "editor.export.skillpack",
      "editor.moreFormats",
      "sidepanel.title",
      "sidepanel.select",
      "sidepanel.back",
      "sidepanel.deleteStep",
      "sidepanel.deleteSession",
      "manual.addTitle",
      "manual.cancel"
    ]) {
      expect(dictionary[key], `missing ${key}`).toBeDefined();
    }
  });
});
