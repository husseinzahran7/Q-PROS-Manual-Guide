import { describe, expect, it } from "vitest";
import { bumpVersion, setVersionContent } from "./versionUtils.mjs";

describe("release version utils (manifest key order)", () => {
  it("bumps patch/minor/major and explicit versions", () => {
    expect(bumpVersion("1.2.3", "patch")).toBe("1.2.4");
    expect(bumpVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(bumpVersion("1.2.3", "major")).toBe("2.0.0");
    expect(bumpVersion("1.2.3", "4.5.6")).toBe("4.5.6");
  });

  it("rejects unknown bump kinds", () => {
    expect(() => bumpVersion("1.2.3", "banana")).toThrow();
  });

  it("replaces only the version value, preserving key order + formatting", () => {
    const manifest = `{
  "manifest_version": 3,
  "name": "Q-PROS Manual Guide",
  "description": "Record browser workflows.",
  "version": "1.0.0",
  "icons": {
    "16": "icons/icon-16.png"
  }
}
`;
    const next = setVersionContent(manifest, "1.0.1");

    // Only the version line changed.
    expect(next).toContain('"version": "1.0.1"');
    // Key order untouched: version still sits between description and icons.
    const order = ["manifest_version", "name", "description", "version", "icons"].map((key) =>
      next.indexOf(`"${key}"`)
    );
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Formatting untouched: same length delta as the version string itself.
    expect(next.length - manifest.length).toBe("1.0.1".length - "1.0.0".length);
    expect(next.endsWith("\n")).toBe(true);
  });

  it("throws when no version field exists", () => {
    expect(() => setVersionContent('{"name": "x"}', "1.0.1")).toThrow();
  });
});
