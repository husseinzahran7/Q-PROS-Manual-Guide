import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import type { RecordingSession, RecordedAction, ScreenshotRecord, SessionBundle } from "../shared/types";

function send<T>(message: unknown): Promise<{ ok: boolean; data?: T; error?: string }> {
  return chrome.runtime.sendMessage(message);
}

function StepCard({
  action,
  screenshot,
  index,
  onDelete,
}: {
  action: RecordedAction;
  screenshot?: ScreenshotRecord;
  index: number;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const actionIcon = () => {
    switch (action.type) {
      case "click": return "🖱️";
      case "input": return "⌨️";
      case "keydown": return "🔑";
      case "navigation": return "🔗";
      case "change": return "📝";
      case "submit": return "📤";
      case "note": return "📌";
      case "wait": return "⏱️";
      default: return "▶️";
    }
  };

  return (
    <div style={{
      background: "white",
      borderRadius: "8px",
      border: "1px solid #e2e8f0",
      marginBottom: "8px",
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    }}>
      <div
        style={{
          padding: "10px 12px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: expanded ? "#f0fdf4" : "white",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={{
          background: "#047857",
          color: "white",
          borderRadius: "50%",
          width: "24px",
          height: "24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "11px",
          fontWeight: "bold",
          flexShrink: 0,
        }}>
          {index + 1}
        </span>
        <span style={{ fontSize: "14px" }}>{actionIcon()}</span>
        <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "#334155" }}>
          {action.title}
        </span>
        <span style={{ fontSize: "11px", color: "#94a3b8" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: "0 12px 12px", borderTop: "1px solid #f1f5f9" }}>
          <p style={{ fontSize: "12px", color: "#64748b", margin: "8px 0" }}>
            {action.description}
          </p>
          <p style={{ fontSize: "11px", color: "#94a3b8", margin: "4px 0" }}>
            URL: {action.page.url}
          </p>
          <p style={{ fontSize: "11px", color: "#94a3b8", margin: "4px 0" }}>
            Time: {new Date(action.createdAt).toLocaleString()}
          </p>
          {screenshot && (
            <img
              src={screenshot.dataUrl}
              alt={`Step ${index + 1}`}
              style={{
                width: "100%",
                borderRadius: "6px",
                marginTop: "8px",
                border: "1px solid #e2e8f0",
              }}
            />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(action.id);
            }}
            style={{
              marginTop: "8px",
              padding: "4px 12px",
              fontSize: "12px",
              color: "#dc2626",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Delete Step
          </button>
        </div>
      )}
    </div>
  );
}

function App() {
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [bundle, setBundle] = useState<SessionBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");

  const loadSessions = useCallback(async () => {
    const result = await send<RecordingSession[]>({ type: "session:list" });
    if (result.ok && result.data) {
      setSessions(result.data);
    }
  }, []);

  const loadBundle = useCallback(async (sessionId: string) => {
    setLoading(true);
    const result = await send<SessionBundle>({ type: "session:get", sessionId });
    if (result.ok && result.data) {
      setBundle(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (selectedSession) {
      loadBundle(selectedSession);
    }
  }, [selectedSession, loadBundle]);

  const handleExport = async (format: "docx" | "pdf") => {
    if (!bundle) return;
    setExporting(format);
    setStatus(`Generating ${format.toUpperCase()}...`);

    try {
      if (format === "docx") {
        const { generateDocx } = await import("../shared/exportDocx");
        const blob = await generateDocx(bundle);
        const url = URL.createObjectURL(blob);
        const slug = bundle.session.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "q-pros-manual-guide";
        chrome.downloads.download({ url, filename: `${slug}.docx`, saveAs: true });
      } else {
        const { generatePdf } = await import("../shared/exportPdf");
        await generatePdf(bundle);
      }
      setStatus(`${format.toUpperCase()} exported successfully!`);
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : "Export failed"}`);
    }

    setExporting(null);
  };

  const handleDeleteStep = async (actionId: string) => {
    if (!bundle) return;
    await send({ type: "session:delete-step", actionId });
    await loadBundle(bundle.session.id);
    setStatus("Step deleted");
  };

  const handleDeleteSession = async (sessionId: string) => {
    await send({ type: "session:delete", sessionId });
    setSelectedSession(null);
    setBundle(null);
    await loadSessions();
    setStatus("Session deleted");
  };

  return (
    <div style={{ padding: "16px", maxWidth: "400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "20px", padding: "16px", background: "linear-gradient(135deg, #047857, #10b981)", borderRadius: "12px", color: "white" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "4px" }}>Q-PROS Manual Guide</h1>
        <p style={{ fontSize: "12px", opacity: 0.9 }}>by Hussein Zahran</p>
      </div>

      {/* Session Selector */}
      {!selectedSession && (
        <div>
          <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "12px", color: "#334155" }}>
            Select a Recording Session
          </h2>
          {sessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
              <p style={{ fontSize: "14px" }}>No recordings yet</p>
              <p style={{ fontSize: "12px", marginTop: "8px" }}>
                Click the extension icon and start recording to create your first session
              </p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                style={{
                  padding: "12px",
                  background: "white",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  marginBottom: "8px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onClick={() => setSelectedSession(session.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#047857";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(4,120,87,0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: "13px", color: "#1e293b" }}>
                    {session.title}
                  </span>
                  <span style={{
                    fontSize: "11px",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    background: session.status === "recording" ? "#dcfce7" : "#f1f5f9",
                    color: session.status === "recording" ? "#16a34a" : "#64748b",
                  }}>
                    {session.status}
                  </span>
                </div>
                <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>
                  {session.actionCount} steps · {new Date(session.updatedAt).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Session Detail */}
      {selectedSession && bundle && (
        <div>
          {/* Back button */}
          <button
            onClick={() => { setSelectedSession(null); setBundle(null); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
              color: "#047857",
              background: "none",
              border: "none",
              cursor: "pointer",
              marginBottom: "12px",
              padding: "4px 0",
            }}
          >
            ← Back to sessions
          </button>

          {/* Session header */}
          <div style={{
            padding: "12px",
            background: "white",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            marginBottom: "12px",
          }}>
            <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b", marginBottom: "4px" }}>
              {bundle.session.title}
            </h2>
            <p style={{ fontSize: "11px", color: "#94a3b8" }}>
              {bundle.actions.length} steps · Started {new Date(bundle.session.createdAt).toLocaleString()}
            </p>
          </div>

          {/* Export buttons */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <button
              onClick={() => handleExport("docx")}
              disabled={exporting !== null}
              style={{
                flex: 1,
                padding: "10px",
                background: exporting === "docx" ? "#94a3b8" : "#047857",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: exporting !== null ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {exporting === "docx" ? "Generating..." : "📄 Export Word"}
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={exporting !== null}
              style={{
                flex: 1,
                padding: "10px",
                background: exporting === "pdf" ? "#94a3b8" : "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: exporting !== null ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {exporting === "pdf" ? "Generating..." : "📕 Export PDF"}
            </button>
          </div>

          {/* Status */}
          {status && (
            <div style={{
              padding: "8px 12px",
              background: status.includes("Error") ? "#fef2f2" : "#f0fdf4",
              color: status.includes("Error") ? "#dc2626" : "#047857",
              borderRadius: "6px",
              fontSize: "12px",
              marginBottom: "12px",
              border: `1px solid ${status.includes("Error") ? "#fecaca" : "#bbf7d0"}`,
            }}>
              {status}
            </div>
          )}

          {/* Steps list */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
              Loading steps...
            </div>
          ) : (
            bundle.actions.map((action, index) => (
              <StepCard
                key={action.id}
                action={action}
                screenshot={bundle.screenshots.find((s) => s.actionId === action.id)}
                index={index}
                onDelete={handleDeleteStep}
              />
            ))
          )}

          {/* Delete session */}
          <button
            onClick={() => handleDeleteSession(selectedSession)}
            style={{
              width: "100%",
              padding: "8px",
              marginTop: "16px",
              fontSize: "12px",
              color: "#dc2626",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Delete Session
          </button>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
