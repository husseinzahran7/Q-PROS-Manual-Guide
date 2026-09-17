import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  generateDevtoolsRecorderJson,
  generateHumanGuide,
  generatePlaywright,
  generateSkillPackBase64,
  generateTaskBrief,
  generateTrajectoryJsonl
} from "./exporters";
import { actionDescription as docxDescribe } from "./exportDocx";
import { actionDescription as pdfDescribe } from "./exportPdf";
import { shouldMaskAction } from "./sanitize";
import type { SessionBundle } from "./types";

const SECRET_PASTE = "SECRET-PASTE-abc123XYZ";
const SECRET_PROMPT = "SECRET-PROMPT-def456UVW";
const SECRET_INPUT = "SECRET-INPUT-ghi789RST";

function baseTarget(overrides = {}) {
  return {
    tagName: "input",
    selector: "input[name='token']",
    xpath: "//input[1]",
    selectorConfidence: 0.9,
    candidates: [{ kind: "css" as const, value: "input[name='token']", confidence: 0.9 }],
    ...overrides
  };
}

const bundle: SessionBundle = {
  session: {
    id: "session_priv",
    title: "Privacy leak check",
    summary: "Check sensitive masking.",
    status: "idle",
    createdAt: "2026-05-25T00:00:00.000Z",
    updatedAt: "2026-05-25T00:00:00.000Z",
    startUrl: "https://example.com/app",
    actionCount: 4
  },
  actions: [
    {
      id: "action_paste",
      sessionId: "session_priv",
      stepNumber: 1,
      type: "paste",
      page: { url: "https://example.com/app", domain: "example.com", title: "App" },
      target: baseTarget({ ariaLabel: "Token field" }),
      // Simulates an old recording where the user toggled Sensitive after
      // capture: value still present, policy still literal. Exporters must
      // gate on sensitive flag, not policy alone.
      value: SECRET_PASTE,
      valuePolicy: "literal",
      sensitive: true,
      highRisk: false,
      title: "Paste content into Token field",
      description: "Paste the required content into Token field.",
      createdAt: "2026-05-25T00:00:00.000Z"
    },
    {
      id: "action_prompt",
      sessionId: "session_priv",
      stepNumber: 2,
      type: "dialog",
      page: { url: "https://example.com/app", domain: "example.com", title: "App" },
      target: {
        tagName: "document",
        selector: "html",
        xpath: "/html",
        selectorConfidence: 1,
        candidates: [{ kind: "css" as const, value: "html", confidence: 1 }]
      },
      value: SECRET_PROMPT,
      valuePolicy: "literal",
      sensitive: true,
      highRisk: false,
      title: "Respond to browser prompt",
      description: 'Provide the prompt response "Enter token".',
      createdAt: "2026-05-25T00:00:00.000Z",
      dialog: { kind: "prompt", message: "Enter token", response: SECRET_PROMPT, accepted: true }
    },
    {
      id: "action_input",
      sessionId: "session_priv",
      stepNumber: 3,
      type: "input",
      page: { url: "https://example.com/app", domain: "example.com", title: "App" },
      target: baseTarget({ ariaLabel: "API key" }),
      value: SECRET_INPUT,
      valuePolicy: "literal",
      sensitive: true,
      highRisk: false,
      title: `Enter "${SECRET_INPUT}" in API key`,
      description: `Type "${SECRET_INPUT}" into API key.`,
      createdAt: "2026-05-25T00:00:00.000Z"
    },
    {
      id: "action_normal",
      sessionId: "session_priv",
      stepNumber: 4,
      type: "input",
      page: { url: "https://example.com/app", domain: "example.com", title: "App" },
      target: baseTarget({ ariaLabel: "Username", selector: "input[name='username']" }),
      value: "alice",
      valuePolicy: "literal",
      sensitive: false,
      highRisk: false,
      title: 'Enter "alice" in Username',
      description: 'Type "alice" into Username.',
      createdAt: "2026-05-25T00:00:00.000Z"
    }
  ],
  screenshots: []
};

const SECRETS = [SECRET_PASTE, SECRET_PROMPT, SECRET_INPUT];

describe("privacy leak close: sensitive paste/prompt/input", () => {
  it("gates masking on sensitive flag, not policy alone", () => {
    expect(shouldMaskAction({ sensitive: true, valuePolicy: "literal" })).toBe(true);
    expect(shouldMaskAction({ sensitive: false, valuePolicy: "literal" })).toBe(false);
    expect(shouldMaskAction({ sensitive: false, valuePolicy: "runtime" })).toBe(true);
  });

  it("human guide never contains secrets, still lists runtime vars", () => {
    const md = generateHumanGuide(bundle);
    for (const s of SECRETS) expect(md).not.toContain(s);
    expect(md).toContain("Runtime variable required");
    expect(md).toContain("alice");
  });

  it("task brief treats sensitive as runtime-required", () => {
    const brief = generateTaskBrief(bundle);
    for (const s of SECRETS) expect(brief).not.toContain(s);
    expect(brief).toContain("Runtime Variables");
  });

  it("trajectory jsonl masks dialog response + value labels", () => {
    const jsonl = generateTrajectoryJsonl(bundle);
    for (const s of SECRETS) expect(jsonl).not.toContain(s);
    const lines = jsonl.split("\n").slice(1).map((l) => JSON.parse(l));
    const prompt = lines.find((l) => l.action_type === "dialog");
    expect(prompt.dialog.response).toBeUndefined();
    expect(prompt.runtime_variable_name).toBeTruthy();
    expect(prompt.value_policy).toBe("runtime");
  });

  it("playwright uses env placeholders, never cleartext", () => {
    const code = generatePlaywright(bundle);
    for (const s of SECRETS) expect(code).not.toContain(s);
    expect(code).toContain("process.env.");
    // Non-sensitive value still replays literally.
    expect(code).toContain("alice");
  });

  it("devtools recorder uses {{VAR}} placeholders for sensitive", () => {
    const json = generateDevtoolsRecorderJson(bundle);
    for (const s of SECRETS) expect(json).not.toContain(s);
    expect(json).toContain("{{");
  });

  it("docx + pdf descriptions redact sensitive values", () => {
    for (const action of bundle.actions.slice(0, 3)) {
      expect(docxDescribe(action, 0)).not.toContain(action.value || "IMPOSSIBLE");
      expect(pdfDescribe(action)).not.toContain(action.value || "IMPOSSIBLE");
    }
    // Docx/pdf explicitly mark redaction so reviewers know a runtime value is needed.
    expect(docxDescribe(bundle.actions[0], 0)).toContain("REDACTED");
    expect(pdfDescribe(bundle.actions[1])).toContain("REDACTED");
    // Normal value still exported.
    expect(docxDescribe(bundle.actions[3], 3)).toContain("alice");
    expect(pdfDescribe(bundle.actions[3])).toContain("alice");
  });

  it("skill-pack zip never contains secrets in text fixtures", async () => {
    const base64 = await generateSkillPackBase64(bundle);
    const zip = await JSZip.loadAsync(base64, { base64: true });
    for (const name of [
      "human-guide.md",
      "trajectory.jsonl",
      "replay.playwright.ts",
      "replay.devtools.json",
      "task-brief.md",
      "agent-task.md"
    ]) {
      const text = await zip.file(name)!.async("string");
      for (const s of SECRETS) expect(text, `${name} leaks`).not.toContain(s);
    }
  });
});
