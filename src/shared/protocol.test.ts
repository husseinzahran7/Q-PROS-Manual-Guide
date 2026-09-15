import { describe, expect, it } from "vitest";
import {
  base64ByteLength,
  exportFilenameFor,
  isTabAllowedForRecording,
  screenshotPathFor,
  slugifySessionTitle
} from "./protocol";

describe("worker protocol helpers (chrome.*-free mirrors)", () => {
  it("gates action:record to recording tabs", () => {
    // Extension UI messages carry no sender tab: always allowed.
    expect(isTabAllowedForRecording([1, 2], undefined)).toBe(true);
    // No gate set yet: allow (matches worker before recording starts).
    expect(isTabAllowedForRecording(undefined, 9)).toBe(true);
    expect(isTabAllowedForRecording([], 9)).toBe(true);
    // Recording tabs pass, foreign tabs are refused.
    expect(isTabAllowedForRecording([1, 2], 2)).toBe(true);
    expect(isTabAllowedForRecording([1, 2], 7)).toBe(false);
  });

  it("slugifies session titles like the worker", () => {
    expect(slugifySessionTitle("Login workflow")).toBe("login-workflow");
    expect(slugifySessionTitle("  Checkout!! v2 ")).toBe("checkout-v2");
    expect(slugifySessionTitle("")).toBe("q-pros-manual-guide");
    expect(slugifySessionTitle("!!!")).toBe("q-pros-manual-guide");
  });

  it("names export files per type", () => {
    expect(exportFilenameFor("Login workflow", "markdown")).toBe("login-workflow.md");
    expect(exportFilenameFor("Login workflow", "playwright")).toBe("login-workflow.ts");
    expect(exportFilenameFor("Login workflow", "devtools")).toBe("login-workflow.json");
    expect(exportFilenameFor("Login workflow", "skill-pack")).toBe("login-workflow.zip");
    expect(exportFilenameFor("Login workflow", "docx")).toBe("login-workflow.docx");
    expect(exportFilenameFor("Login workflow", "pdf")).toBe("login-workflow.pdf");
  });

  it("numbers screenshot paths with zero padding", () => {
    expect(screenshotPathFor(1)).toBe("screenshots/step-001.jpg");
    expect(screenshotPathFor(42)).toBe("screenshots/step-042.jpg");
    expect(screenshotPathFor(1234)).toBe("screenshots/step-1234.jpg");
  });

  it("estimates base64 payload bytes like storageEstimate", () => {
    // 4 base64 chars -> 3 bytes.
    expect(base64ByteLength("data:image/jpeg;base64,AAAA")).toBe(3);
    expect(base64ByteLength("data:image/jpeg;base64,AAAAAAAA")).toBe(6);
    // No data-URL prefix: whole string counts.
    expect(base64ByteLength("AAAAAAAA")).toBe(6);
  });
});
