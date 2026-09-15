import { describe, expect, it } from "vitest";
import {
  AZURE_UPLOAD_MANIFEST_FORMAT,
  azureAuthHeader,
  azureResultAttachmentsUrl,
  azureResultsUrl,
  azureRunAttachmentsUrl,
  azureRunUrl,
  azureRunWebUrl,
  azureRunsUrl,
  azureProjectsUrl,
  buildAttachmentPayload,
  buildCompleteRunPayload,
  buildResultPayload,
  buildRunPayload,
  defaultRunName,
  generateAzureUploadManifest,
  parseRunId,
  redactAzureConfig,
  stepFileName,
  stripDataUrlPrefix,
  validateAzureConfig
} from "./azure";
import type { SessionBundle } from "./types";

const bundle: SessionBundle = {
  session: {
    id: "session_1",
    title: "Login workflow",
    summary: "Sign in to the app.",
    status: "idle",
    createdAt: "2026-05-25T00:00:00.000Z",
    updatedAt: "2026-05-25T00:00:00.000Z",
    startUrl: "https://example.com/login",
    actionCount: 2
  },
  actions: [
    {
      id: "action_1",
      sessionId: "session_1",
      stepNumber: 1,
      type: "click",
      page: { url: "https://example.com/login", domain: "example.com", title: "Login" },
      target: {
        tagName: "button",
        selector: "button",
        xpath: "/html/body/button[1]",
        selectorConfidence: 1,
        candidates: [{ kind: "css", value: "button", confidence: 1 }]
      },
      valuePolicy: "none",
      sensitive: false,
      highRisk: false,
      title: "Click sign in",
      description: "Click the sign-in button.",
      createdAt: "2026-05-25T00:00:00.000Z"
    },
    {
      id: "action_2",
      sessionId: "session_1",
      stepNumber: 2,
      type: "input",
      page: { url: "https://example.com/login", domain: "example.com", title: "Login" },
      target: {
        tagName: "input",
        selector: "input",
        xpath: "/html/body/input[1]",
        selectorConfidence: 1,
        candidates: [{ kind: "css", value: "input", confidence: 1 }]
      },
      valuePolicy: "none",
      sensitive: false,
      highRisk: false,
      title: "Enter email",
      description: "Type the email.",
      createdAt: "2026-05-25T00:00:00.000Z"
    }
  ],
  screenshots: []
};

describe("azure helpers", () => {
  it("builds Basic auth without leaking the PAT into the scheme", () => {
    const header = azureAuthHeader("secret-pat");
    expect(header.startsWith("Basic ")).toBe(true);
    expect(header).not.toContain("secret-pat");
  });

  it("validates config and redacts PAT", () => {
    expect(validateAzureConfig({ org: "", project: "", pat: "" }).length).toBeGreaterThan(0);
    expect(validateAzureConfig({ org: "o", project: "p", pat: "x" })).toEqual([]);
    const redacted = redactAzureConfig({ org: " o ", project: "p", pat: "super-secret-pat" });
    expect(redacted).toEqual({ org: "o", project: "p", hasPat: true });
    expect(JSON.stringify(redacted)).not.toContain("super-secret-pat");
  });

  it("builds dev.azure.com endpoint URLs", () => {
    expect(azureRunsUrl("myorg", "myproj")).toBe(
      "https://dev.azure.com/myorg/myproj/_apis/test/runs?api-version=7.1"
    );
    expect(azureRunUrl("myorg", "myproj", 42)).toContain("/runs/42?");
    expect(azureResultsUrl("myorg", "myproj", 42)).toContain("/Runs/42/results?");
    expect(azureResultAttachmentsUrl("myorg", "myproj", 42, 7)).toContain("/Runs/42/Results/7/attachments?");
    expect(azureRunAttachmentsUrl("myorg", "myproj", 42)).toContain("/Runs/42/attachments?");
    expect(azureProjectsUrl("myorg")).toBe("https://dev.azure.com/myorg/_apis/projects?api-version=7.1");
    expect(azureRunWebUrl("myorg", "myproj", 42)).toBe(
      "https://dev.azure.com/myorg/myproj/_test/runs?runId=42"
    );
  });

  it("encodes org/project segments", () => {
    expect(azureRunsUrl("my org", "my/proj")).toContain("my%20org");
  });

  it("parses run ids from plain input or run URL", () => {
    expect(parseRunId("123")).toBe(123);
    expect(parseRunId("https://dev.azure.com/o/p/_test/runs?runId=456")).toBe(456);
    expect(parseRunId("")).toBeUndefined();
    expect(parseRunId("abc")).toBeUndefined();
  });

  it("strips data-URL prefix for the attachment stream", () => {
    expect(stripDataUrlPrefix("data:image/jpeg;base64,AAAA")).toBe("AAAA");
    expect(stripDataUrlPrefix("AAAA")).toBe("AAAA");
    expect(stripDataUrlPrefix("data:image/png;base64,BBBB")).toBe("BBBB");
  });

  it("names step files sequentially", () => {
    expect(stepFileName(1)).toBe("step-001.jpg");
    expect(stepFileName(42)).toBe("step-042.jpg");
  });

  it("builds run/result/attachment payloads", () => {
    expect(buildRunPayload("Q-PROS: x")).toMatchObject({ automated: false, state: "InProgress" });
    expect(buildCompleteRunPayload()).toEqual({ state: "Completed" });
    const results = buildResultPayload(bundle);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ outcome: "Passed", state: "Completed" });
    const att = buildAttachmentPayload("AAAA", "step-001.jpg", "Click sign in");
    expect(att).toMatchObject({ stream: "AAAA", fileName: "step-001.jpg", attachmentType: "GeneralAttachment" });
  });

  it("generates an azure-upload manifest with no secrets or bytes", () => {
    const manifest = generateAzureUploadManifest(bundle, { runName: "Custom run", createdAt: "2026-01-01T00:00:00.000Z" });
    expect(manifest.format).toBe(AZURE_UPLOAD_MANIFEST_FORMAT);
    expect(manifest.run.name).toBe("Custom run");
    expect(manifest.attachments).toHaveLength(2);
    expect(manifest.attachments[0]).toMatchObject({ step: 1, fileName: "step-001.jpg", path: "screenshots/step-001.jpg" });
    expect(JSON.stringify(manifest)).not.toContain("data:image");
    expect(manifest.attachments[0]).not.toHaveProperty("dataUrl");
    expect(manifest.attachments[0]).not.toHaveProperty("stream");
  });

  it("defaults the run name from the session title", () => {
    expect(defaultRunName("Login")).toBe("Q-PROS: Login");
    expect(defaultRunName("")).toBe("Q-PROS: Untitled workflow");
  });
});
