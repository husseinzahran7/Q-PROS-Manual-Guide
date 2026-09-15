import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  generateAgentInstructions,
  generateDevtoolsRecorderJson,
  generateHumanGuide,
  generatePlaywright,
  generateSkillPackBase64,
  generateStartContextJson,
  generateTaskBrief,
  generateTrajectoryJsonl,
  generateValidationsYaml,
  locatorCode,
  safeHostname
} from "./exporters";
import { dataUrlToUint8Array, imageTypeFromDataUrl } from "./exportDocx";
import { pdfImageFormat } from "./exportPdf";
import type { RecordedAction, SessionBundle } from "./types";

const bundle: SessionBundle = {
  session: {
    id: "session_1",
    title: "Login workflow",
    summary: "Sign in to the app.",
    status: "idle",
    createdAt: "2026-05-25T00:00:00.000Z",
    updatedAt: "2026-05-25T00:00:00.000Z",
    startUrl: "https://example.com/login",
    actionCount: 1
  },
  actions: [
    {
      id: "action_1",
      sessionId: "session_1",
      stepNumber: 1,
      type: "input",
      page: { url: "https://example.com/login", domain: "example.com", title: "Login" },
      target: {
        tagName: "input",
        placeholder: "Email",
        selector: "input[name=\"email\"]",
        xpath: "/html/body/input[1]",
        selectorConfidence: 0.82,
        candidates: [{ kind: "placeholder", value: "Email", confidence: 0.82 }]
      },
      valuePolicy: "runtime",
      runtimeVariable: { name: "EMAIL" },
      sensitive: false,
      highRisk: false,
      title: "Enter email",
      description: "Type the account email.",
      createdAt: "2026-05-25T00:00:00.000Z"
    }
  ],
  screenshots: [
    {
      id: "shot_1",
      sessionId: "session_1",
      actionId: "action_1",
      stepNumber: 1,
      dataUrl: "data:image/jpeg;base64,AAAA",
      path: "screenshots/step-001.jpg",
      createdAt: "2026-05-25T00:00:00.000Z"
    }
  ]
};

describe("exporters", () => {
  it("generates a human guide with runtime warning and screenshot reference", () => {
    const guide = generateHumanGuide(bundle);
    expect(guide).toContain("# Login workflow");
    expect(guide).toContain("Runtime variable required: EMAIL");
    expect(guide).toContain("screenshots/step-001.jpg");
  });

  it("generates jsonl trajectory", () => {
    const lines = generateTrajectoryJsonl(bundle).split("\n");
    expect(JSON.parse(lines[0])).toMatchObject({
      type: "start_context",
      url: "https://example.com/login",
      instruction: "Open this page before executing the recorded actions."
    });
    expect(JSON.parse(lines[1])).toMatchObject({
      type: "recorded_action",
      step_number: 1,
      runtime_variable_name: "EMAIL",
      auth_policy: "use_existing_session_only",
      write_back_policy: "append_observations_to_learning_notes_only"
    });
  });

  it("generates explicit start context", () => {
    expect(JSON.parse(generateStartContextJson(bundle))).toMatchObject({
      type: "start_context",
      url: "https://example.com/login",
      domain: "example.com",
      auth_policy: "use_existing_session_only"
    });
  });

  it("generates universal agent instructions with controlled learning rules", () => {
    const instructions = generateAgentInstructions();
    expect(instructions).toContain("Your job is not to blindly replay clicks");
    expect(instructions).toContain("Controlled Learning and Write-Back Policy");
    expect(instructions).toContain("Append JSON objects to `learning-notes.jsonl`");
  });

  it("generates a task brief with authentication policy", () => {
    const brief = generateTaskBrief(bundle);
    expect(brief).toContain("## Authentication Policy");
    expect(brief).toContain("use existing authenticated browser context");
    expect(brief).toContain("EMAIL");
  });

  it("generates Playwright with env variables and locator preference", () => {
    const code = generatePlaywright(bundle);
    expect(code).toContain("page.getByPlaceholder('Email')");
    expect(code).toContain("process.env.EMAIL");
  });

  it("emits Playwright pointer variants and dialog handlers", () => {
    const richBundle: SessionBundle = {
      ...bundle,
      actions: [
        {
          ...bundle.actions[0],
          id: "action_right",
          stepNumber: 1,
          type: "rightclick",
          title: "Right-click row"
        },
        {
          ...bundle.actions[0],
          id: "action_double",
          stepNumber: 2,
          type: "doubleclick",
          title: "Double-click cell"
        },
        {
          ...bundle.actions[0],
          id: "action_dialog",
          stepNumber: 3,
          type: "dialog",
          title: "Respond to prompt",
          valuePolicy: "runtime",
          runtimeVariable: { name: "PROMPT_VALUE" },
          dialog: { kind: "prompt", message: "What is your name?", response: "Ada", accepted: true }
        }
      ]
    };
    const code = generatePlaywright(richBundle);
    expect(code).toContain("click({ button: 'right' })");
    expect(code).toContain(".dblclick()");
    expect(code).toContain("page.once('dialog'");
    expect(code).toContain("process.env.PROMPT_VALUE");
  });

  it("emits Playwright fill for paste and setInputFiles for upload", () => {
    const richBundle: SessionBundle = {
      ...bundle,
      actions: [
        {
          ...bundle.actions[0],
          id: "action_paste",
          stepNumber: 1,
          type: "paste",
          value: "pasted text",
          valuePolicy: "literal",
          runtimeVariable: undefined,
          title: "Paste content"
        },
        {
          ...bundle.actions[0],
          id: "action_upload",
          stepNumber: 2,
          type: "upload",
          value: "report.pdf (1024 bytes)",
          valuePolicy: "runtime",
          runtimeVariable: { name: "UPLOAD_FILES" },
          title: "Upload report"
        }
      ]
    };
    const code = generatePlaywright(richBundle);
    expect(code).toContain(".fill('pasted text'");
    expect(code).toContain("setInputFiles(");
    expect(code).toContain("process.env.UPLOAD_FILES");
    expect(code).toContain("Recorded files: report.pdf");
  });

  it("generates Chrome DevTools Recorder JSON", () => {
    const parsed = JSON.parse(generateDevtoolsRecorderJson(bundle));
    expect(parsed.title).toBe("Login workflow");
    expect(parsed.steps[0].type).toBe("setViewport");
    expect(parsed.steps[1]).toMatchObject({ type: "navigate", url: "https://example.com/login" });
    const change = parsed.steps.find((step: { type: string }) => step.type === "change");
    expect(change.value).toBe("{{EMAIL}}");
    expect(change.selectors[0]).toEqual(["aria/Email"]);
  });

  it("generates validations yaml", () => {
    expect(generateValidationsYaml(bundle)).toContain("require_visible_target: true");
  });

  it("generates a skill pack zip with manifest and screenshots", async () => {
    const base64 = await generateSkillPackBase64(bundle);
    const zip = await JSZip.loadAsync(base64, { base64: true });
    expect(zip.file("manifest.yaml")).toBeTruthy();
    expect(zip.file("agent-instructions.md")).toBeTruthy();
    expect(zip.file("start-context.json")).toBeTruthy();
    expect(zip.file("task-brief.md")).toBeTruthy();
    expect(zip.file("human-guide.md")).toBeTruthy();
    expect(zip.file("learning-notes.jsonl")).toBeTruthy();
    expect(zip.file("learning-notes.schema.json")).toBeTruthy();
    expect(zip.file("workflow-memory.md")).toBeTruthy();
    expect(zip.file("screenshots/step-001.jpg")).toBeTruthy();
    const manifest = await zip.file("manifest.yaml")!.async("string");
    expect(manifest).toContain("q-pros-manual-guide.skill-pack.v2");
    expect(manifest).toContain("start_url: \"https://example.com/login\"");
    expect(manifest).toContain("start_context_file: start-context.json");
    expect(manifest).toContain("write_back_policy: additive_only");
  });

  it("safeHostname falls back to unknown on edge URLs", () => {
    expect(safeHostname("https://example.com/login")).toBe("example.com");
    expect(safeHostname("about:blank")).toBe("unknown");
    expect(safeHostname("")).toBe("unknown");
    expect(safeHostname("not a url")).toBe("unknown");
    expect(safeHostname("chrome://extensions")).not.toBe("");
  });

  it("start context never crashes on about:blank", () => {
    const blankBundle: SessionBundle = {
      ...bundle,
      session: { ...bundle.session, startUrl: "about:blank" },
      actions: [{ ...bundle.actions[0], page: { url: "about:blank", domain: "", title: "" } }]
    };
    const parsed = JSON.parse(generateStartContextJson(blankBundle));
    expect(parsed.domain).toBe("unknown");
    expect(parsed.url).toBe("about:blank");
  });

  it("Playwright nav skips URL assertion on unparseable URL", () => {
    const blankBundle: SessionBundle = {
      ...bundle,
      actions: [
        {
          ...bundle.actions[0],
          id: "nav_blank",
          type: "navigation",
          title: "Open blank",
          page: { url: "about:blank", domain: "", title: "" }
        }
      ]
    };
    const code = generatePlaywright(blankBundle);
    expect(code).toContain("about:blank");
    expect(code).toContain("Skipped URL assertion");
    expect(code).not.toContain("toHaveURL(//)");
  });

  it("locatorCode preserves colons in accessible name", () => {
    const action: RecordedAction = {
      ...bundle.actions[0],
      target: {
        ...bundle.actions[0].target,
        candidates: [{ kind: "role", value: "button:Submit:extra", confidence: 0.9 }]
      }
    };
    expect(locatorCode(action)).toContain("Submit:extra");
    const noColon: RecordedAction = {
      ...bundle.actions[0],
      target: {
        ...bundle.actions[0].target,
        candidates: [{ kind: "role", value: "button", confidence: 0.9 }]
      }
    };
    expect(locatorCode(noColon)).toContain("getByRole('button'");
  });

  it("maps JPEG bytes to jpg for docx ImageRun", () => {
    expect(imageTypeFromDataUrl("data:image/jpeg;base64,AAAA")).toBe("jpg");
    expect(imageTypeFromDataUrl("data:image/jpg;base64,AAAA")).toBe("jpg");
    expect(imageTypeFromDataUrl("data:image/png;base64,AAAA")).toBe("png");
    const bytes = dataUrlToUint8Array("data:image/jpeg;base64,AAAA");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(3);
  });

  it("detects PDF image format with PNG fallback", () => {
    expect(pdfImageFormat("data:image/png;base64,AAAA")).toBe("PNG");
    expect(pdfImageFormat("data:image/jpeg;base64,AAAA")).toBe("JPEG");
    expect(pdfImageFormat("data:image/jpg;base64,AAAA")).toBe("JPEG");
  });

  it("handles 100-step session without throwing", () => {
    const actions = Array.from({ length: 100 }, (_, i) => ({
      ...bundle.actions[0],
      id: `action_${i}`,
      stepNumber: i + 1,
      type: "navigation" as const,
      title: `Nav ${i + 1}`,
      page: { url: `https://example.com/p${i}`, domain: "example.com", title: `P${i}` }
    }));
    const big: SessionBundle = { ...bundle, actions, screenshots: [] };
    expect(() => generatePlaywright(big)).not.toThrow();
    expect(() => generateTrajectoryJsonl(big)).not.toThrow();
    expect(generatePlaywright(big)).toContain("Step 100");
  });
});
