import { useEffect, useState } from "react";
import { parseRunId } from "./azure";
import { t } from "./i18n";

interface RedactedConfig {
  org: string;
  project: string;
  hasPat: boolean;
}

interface PushResult {
  runId: number;
  resultId: number;
  runWebUrl: string;
  attachmentCount: number;
  runAttachmentCount: number;
}

function send<T>(message: unknown): Promise<{ ok: boolean; data?: T; error?: string }> {
  return chrome.runtime.sendMessage(message);
}

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  marginBottom: 8,
  fontSize: 12
};

const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--border, #ddd)",
  fontSize: 12
};

/**
 * Push-to-Azure Test panel. Mounts in the sidepanel and the editor.
 * The PAT is write-only: the worker returns only { org, project, hasPat },
 * so the token value never comes back to any UI surface.
 */
export function AzurePushPanel({ sessionId, sessionTitle }: { sessionId: string; sessionTitle: string }) {
  const [org, setOrg] = useState("");
  const [project, setProject] = useState("");
  const [pat, setPat] = useState("");
  const [hasPat, setHasPat] = useState(false);
  const [runName, setRunName] = useState("");
  const [runIdText, setRunIdText] = useState("");
  const [includePdf, setIncludePdf] = useState(false);
  const [busy, setBusy] = useState<"save" | "test" | "push" | null>(null);
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void send<RedactedConfig>({ type: "azure:get-config" }).then((response) => {
      if (cancelled || !response.ok || !response.data) return;
      setOrg(response.data.org);
      setProject(response.data.project);
      setHasPat(response.data.hasPat);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setRunName(`Q-PROS: ${sessionTitle}`);
    setResult(null);
    setStatus("");
  }, [sessionId, sessionTitle]);

  function note(message: string, error: boolean) {
    setStatus(message);
    setIsError(error);
  }

  async function handleSave() {
    setBusy("save");
    setResult(null);
    const response = await send<RedactedConfig>({
      type: "azure:save-config",
      config: { org: org.trim(), project: project.trim(), pat }
    });
    setBusy(null);
    if (!response.ok) {
      note(response.error || t("azure.saveFailed"), true);
      return;
    }
    // PAT stays in the worker; clear the field the moment it is stored.
    setPat("");
    setHasPat(response.data?.hasPat ?? true);
    note(t("azure.saved"), false);
  }

  async function handleTest() {
    setBusy("test");
    setResult(null);
    const response = await send<{ projectFound: boolean; projectCount: number }>({
      type: "azure:test-connection"
    });
    setBusy(null);
    if (!response.ok) {
      note(response.error || t("azure.testFailed"), true);
      return;
    }
    note(
      response.data?.projectFound
        ? t("azure.testOk")
        : t("azure.testOkNoProject", { n: response.data?.projectCount ?? 0 }),
      false
    );
  }

  async function handlePush() {
    const runId = runIdText.trim() ? parseRunId(runIdText) : undefined;
    if (runIdText.trim() && runId === undefined) {
      note(t("azure.badRunId"), true);
      return;
    }
    setBusy("push");
    setResult(null);
    const response = await send<PushResult>({
      type: "azure:push-run",
      sessionId,
      runName: runName.trim() || undefined,
      runId,
      includePdf
    });
    setBusy(null);
    if (!response.ok || !response.data) {
      note(response.error || t("azure.pushFailed"), true);
      return;
    }
    setResult(response.data);
    note(
      t("azure.pushOk", {
        n: response.data.attachmentCount,
        run: response.data.runId,
        result: response.data.resultId
      }),
      false
    );
  }

  const disabled = busy !== null;

  return (
    <section aria-label={t("azure.title")} style={{ marginTop: 12 }}>
      <h3 style={{ fontSize: 13, margin: "0 0 8px" }}>{t("azure.title")}</h3>
      <p style={{ fontSize: 11, opacity: 0.75, margin: "0 0 8px" }}>{t("azure.patNote")}</p>
      <label style={fieldStyle}>
        <span>{t("azure.org")}</span>
        <input style={inputStyle} value={org} onChange={(e) => setOrg(e.target.value)} placeholder="contoso" autoComplete="off" />
      </label>
      <label style={fieldStyle}>
        <span>{t("azure.project")}</span>
        <input style={inputStyle} value={project} onChange={(e) => setProject(e.target.value)} placeholder="MyProject" autoComplete="off" />
      </label>
      <label style={fieldStyle}>
        <span>{t("azure.pat")}</span>
        <input
          style={inputStyle}
          type="password"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          placeholder={hasPat ? t("azure.patSaved") : "••••••••"}
          autoComplete="off"
        />
      </label>
      <label style={fieldStyle}>
        <span>{t("azure.runName")}</span>
        <input style={inputStyle} value={runName} onChange={(e) => setRunName(e.target.value)} autoComplete="off" />
      </label>
      <label style={fieldStyle}>
        <span>{t("azure.reuseRun")}</span>
        <input
          style={inputStyle}
          value={runIdText}
          onChange={(e) => setRunIdText(e.target.value)}
          placeholder={t("azure.reuseRunHint")}
          autoComplete="off"
        />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 8 }}>
        <input type="checkbox" checked={includePdf} onChange={(e) => setIncludePdf(e.target.checked)} />
        {t("azure.includePdf")}
      </label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button disabled={disabled || !org.trim() || !project.trim() || (!pat && !hasPat)} onClick={() => void handleSave()}>
          {busy === "save" ? t("azure.saving") : t("azure.save")}
        </button>
        <button disabled={disabled} onClick={() => void handleTest()}>
          {busy === "test" ? t("azure.testing") : t("azure.test")}
        </button>
        <button disabled={disabled} onClick={() => void handlePush()}>
          {busy === "push" ? t("azure.pushing") : t("azure.push")}
        </button>
      </div>
      {status ? (
        <p style={{ fontSize: 12, color: isError ? "#b3261e" : "#146c2e", margin: "8px 0 0" }}>{status}</p>
      ) : null}
      {result ? (
        <p style={{ fontSize: 12, margin: "6px 0 0" }}>
          <a href={result.runWebUrl} target="_blank" rel="noreferrer">
            {t("azure.openRun", { run: result.runId })}
          </a>
          {result.runAttachmentCount > 0 ? <span> · PDF attached</span> : null}
        </p>
      ) : null}
    </section>
  );
}
