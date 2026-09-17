import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, FileText, FileDown, ChevronDown, ChevronUp, Trash2, Loader2 } from "lucide-react";
import type { RecordingSession, RecordedAction, ScreenshotRecord, SessionBundle } from "../shared/types";
import { AzurePushPanel } from "../shared/AzurePushPanel";
import "./styles.css";

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
      case "click": return "\u{1F5B1}\uFE0F";
      case "input": return "\u2328\uFE0F";
      case "keydown": return "\U0001F511";
      case "navigation": return "\U0001F517";
      case "change": return "\U0001F4DD";
      case "submit": return "\U0001F4E4";
      case "note": return "\U0001F4CC";
      case "wait": return "\u23F1\uFE0F";
      default: return "\u25B6\uFE0F";
    }
  };

  return (
    <div className="sp-step-card">
      <div
        className={`sp-step-header${expanded ? " sp-step-header--expanded" : ""}`}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="sp-step-badge">{index + 1}</span>
        <span className="sp-step-icon">{actionIcon()}</span>
        <span className="sp-step-title">{action.title}</span>
        <span className="sp-step-chevron">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </div>

      {expanded && (
        <div className="sp-step-body">
          <p className="sp-step-desc">{action.description}</p>
          <p className="sp-step-url">URL: {action.page.url}</p>
          <p className="sp-step-time">Time: {new Date(action.createdAt).toLocaleString()}</p>
          {screenshot && (
            <img
              src={screenshot.dataUrl}
              alt={`Step ${index + 1}`}
              className="sp-step-img"
            />
          )}
          <button
            className="sp-delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(action.id);
            }}
          >
            <Trash2 size={12} /> Delete Step
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
      const result = await send<{ success?: boolean; error?: string }>({
        type: "export:create",
        sessionId: bundle.session.id,
        exportType: format
      });
      if (result.ok && result.data?.success) {
        setStatus(`${format.toUpperCase()} exported successfully!`);
      } else {
        setStatus(`Error: ${result.data?.error || result.error || "Export failed"}`);
      }
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
    <div className="sp-root">
      {/* Header */}
      <div className="sp-header">
        <h1>Q-PROS Manual Guide</h1>
        <p>by Q-PROS</p>
      </div>

      {/* Session Selector */}
      {!selectedSession && (
        <div>
          <h2 className="sp-section-title">Select a Recording Session</h2>
          {sessions.length === 0 ? (
            <div className="sp-empty">
              <p>No recordings yet</p>
              <p>
                Click the extension icon and start recording to create your first session
              </p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className="sp-session-card"
                onClick={() => setSelectedSession(session.id)}
              >
                <div className="sp-session-top">
                  <span className="sp-session-title">{session.title}</span>
                  <span className={`sp-badge ${session.status === "recording" ? "sp-badge--recording" : "sp-badge--idle"}`}>
                    {session.status}
                  </span>
                </div>
                <p className="sp-session-meta">
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
            className="sp-back"
            onClick={() => { setSelectedSession(null); setBundle(null); }}
          >
            <ArrowLeft size={14} /> Back to sessions
          </button>

          {/* Session header */}
          <div className="sp-detail-header">
            <h2>{bundle.session.title}</h2>
            <p>
              {bundle.actions.length} steps · Started {new Date(bundle.session.createdAt).toLocaleString()}
            </p>
          </div>

          {/* Export buttons */}
          <div className="sp-export-row">
            <button
              className="sp-export-btn sp-export-btn--docx"
              onClick={() => handleExport("docx")}
              disabled={exporting !== null}
            >
              {exporting === "docx" ? <><Loader2 size={14} className="spin" /> Generating...</> : <><FileText size={14} /> Export Word</>}
            </button>
            <button
              className="sp-export-btn sp-export-btn--pdf"
              onClick={() => handleExport("pdf")}
              disabled={exporting !== null}
            >
              {exporting === "pdf" ? <><Loader2 size={14} className="spin" /> Generating...</> : <><FileDown size={14} /> Export PDF</>}
            </button>
          </div>

          <AzurePushPanel sessionId={bundle.session.id} sessionTitle={bundle.session.title} />

          {/* Status */}
          {status && (
            <div className={`sp-status ${status.includes("Error") ? "sp-status--error" : "sp-status--success"}`}>
              {status}
            </div>
          )}

          {/* Steps list */}
          {loading ? (
            <div className="sp-loading">Loading steps...</div>
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
            className="sp-delete-session"
            onClick={() => handleDeleteSession(selectedSession)}
          >
            <Trash2 size={14} /> Delete Session
          </button>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
