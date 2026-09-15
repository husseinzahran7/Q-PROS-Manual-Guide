import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { ArrowLeft, ArrowDown, ArrowUp, FileText, FileDown, ChevronDown, ChevronUp, Trash2, Loader2 } from "lucide-react";
import type { ExportType, RecordedAction, RecordingSession, ScreenshotRecord, SessionBundle } from "../shared/types";
import { t } from "../shared/i18n";
import { EXPORT_MENU } from "../shared/exportMenu";
import { blobFromBase64, download, mimeForFilename } from "../shared/download";

function send<T>(message: unknown): Promise<{ ok: boolean; data?: T; error?: string }> {
  return chrome.runtime.sendMessage(message);
}

type ExportResponse = {
  record: { filename: string };
  success?: boolean;
  error?: string;
  content?: string;
  base64?: string;
  mimeType?: string;
};

function exportIcon(type: ExportType) {
  return type === "pdf" || type === "skill-pack" ? <FileDown size={14} /> : <FileText size={14} />;
}

function StepCard({
  action,
  screenshot,
  index,
  total,
  onDelete,
  onMove,
}: {
  action: RecordedAction;
  screenshot?: ScreenshotRecord;
  index: number;
  total: number;
  onDelete: (id: string) => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const confidence = Math.round(action.target.selectorConfidence * 100);

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
          <p className="sp-step-url">{t("sidepanel.url", { url: action.page.url })}</p>
          <p className="sp-step-time">{t("sidepanel.time", { date: new Date(action.createdAt).toLocaleString() })}</p>
          <p className="sp-step-meta">
            {t("step.confidence")}: {confidence}%
            {confidence < 70 ? <em className="sp-low-conf"> {t("step.lowConf")}</em> : null}
          </p>
          {(action.valuePolicy === "runtime" || action.sensitive) && (
            <p className="sp-step-meta">
              {[action.valuePolicy === "runtime" ? t("step.runtime") : null, action.sensitive ? t("step.sensitive") : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <details className="sp-locator">
            <summary>{t("locator.title")}</summary>
            <code className="sp-locator-code">{action.target.selector}</code>
          </details>
          {screenshot && (
            <img
              src={screenshot.dataUrl}
              alt={t("step.label", { n: index + 1, type: action.type })}
              className="sp-step-img"
            />
          )}
          <div className="sp-step-actions">
            <button
              className="sp-mini-btn"
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              <ArrowUp size={12} /> {t("step.moveUp")}
            </button>
            <button
              className="sp-mini-btn"
              disabled={index === total - 1}
              onClick={() => onMove(1)}
            >
              <ArrowDown size={12} /> {t("step.moveDown")}
            </button>
            <button
              className="sp-delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(action.id);
              }}
            >
              <Trash2 size={12} /> {t("sidepanel.deleteStep")}
            </button>
          </div>
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
  const [statusKind, setStatusKind] = useState<"error" | "success" | "">("");

  function showStatus(message: string, kind: "error" | "success") {
    setStatus(message);
    setStatusKind(kind);
  }
  const [deleted, setDeleted] = useState<RecordedAction[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);

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
    const del = await send<RecordedAction[]>({ type: "session:deleted-steps", sessionId });
    if (del.ok && del.data) {
      setDeleted(del.data);
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

  const handleExport = async (format: ExportType) => {
    if (!bundle) return;
    setExporting(format);
    showStatus(t("sidepanel.generating", { format: format.toUpperCase() }), "success");

    try {
      const result = await send<ExportResponse>({
        type: "export:create",
        sessionId: bundle.session.id,
        exportType: format
      });
      if (result.ok && result.data && !result.data.error) {
        // Text formats + Skill Pack come back for the UI to save itself;
        // docx/pdf are saved by the worker via chrome.downloads.
        if (result.data.content !== undefined) {
          download(result.data.record.filename, result.data.content, mimeForFilename(result.data.record.filename));
        } else if (result.data.base64) {
          download(result.data.record.filename, blobFromBase64(result.data.base64, result.data.mimeType || "application/zip"), "application/zip");
        }
        showStatus(t("sidepanel.exported", { format: format.toUpperCase() }), "success");
      } else {
        showStatus(t("sidepanel.exportError", { msg: result.data?.error || result.error || t("sidepanel.exportFailed") }), "error");
      }
    } catch (error) {
      showStatus(t("sidepanel.exportError", { msg: error instanceof Error ? error.message : t("sidepanel.exportFailed") }), "error");
    }

    setExporting(null);
  };

  const handleDeleteStep = async (actionId: string) => {
    if (!bundle) return;
    await send({ type: "session:delete-step", actionId });
    await loadBundle(bundle.session.id);
    showStatus(t("sidepanel.stepDeleted"), "success");
  };

  const handleRestoreStep = async (actionId: string) => {
    if (!bundle) return;
    await send({ type: "session:restore-step", actionId });
    await loadBundle(bundle.session.id);
  };

  const handleMoveStep = async (index: number, direction: -1 | 1) => {
    if (!bundle) return;
    const target = index + direction;
    if (target < 0 || target >= bundle.actions.length) return;
    const ids = bundle.actions.map((action) => action.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    const result = await send<SessionBundle>({ type: "session:reorder-steps", sessionId: bundle.session.id, actionIds: ids });
    if (result.ok && result.data) {
      setBundle(result.data);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm(t("editor.confirmDeleteSession"))) return;
    await send({ type: "session:delete", sessionId });
    setSelectedSession(null);
    setBundle(null);
    setDeleted([]);
    await loadSessions();
    showStatus(t("sidepanel.sessionDeleted"), "success");
  };

  return (
    <div className="sp-root">
      {/* Header */}
      <div className="sp-header">
        <h1>{t("sidepanel.title")}</h1>
        <p>{t("sidepanel.credit")}</p>
      </div>

      {/* Session Selector */}
      {!selectedSession && (
        <div>
          <h2 className="sp-section-title">{t("sidepanel.select")}</h2>
          {sessions.length === 0 ? (
            <div className="sp-empty">
              <p>{t("sidepanel.emptyTitle")}</p>
              <p>
                {t("sidepanel.emptyHint")}
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
                    {session.status === "recording" ? t("sidepanel.status.recording") : t("sidepanel.status.idle")}
                  </span>
                </div>
                <p className="sp-session-meta">
                  {t("editor.sessionMeta", { n: session.actionCount })} · {new Date(session.updatedAt).toLocaleDateString()}
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
            onClick={() => { setSelectedSession(null); setBundle(null); setDeleted([]); }}
          >
            <ArrowLeft size={14} /> {t("sidepanel.back")}
          </button>

          {/* Session header */}
          <div className="sp-detail-header">
            <h2>{bundle.session.title}</h2>
            <p>
              {t("editor.sessionMeta", { n: bundle.actions.length })} · {t("sidepanel.started", { date: new Date(bundle.session.createdAt).toLocaleString() })}
            </p>
          </div>

          {/* Export menu (shared with editor: every format) */}
          <div className="sp-export-grid">
            {EXPORT_MENU.map((option) => (
              <button
                key={option.type}
                className={`sp-export-btn${option.type === "pdf" ? " sp-export-btn--pdf" : " sp-export-btn--docx"}`}
                onClick={() => handleExport(option.type)}
                disabled={exporting !== null}
              >
                {exporting === option.type ? <><Loader2 size={14} className="spin" /> {t("sidepanel.generating", { format: "" }).trim()}</> : <>{exportIcon(option.type)} {t(option.labelKey)}</>}
              </button>
            ))}
          </div>

          {/* Status */}
          {status && (
            <div className={`sp-status ${statusKind === "error" ? "sp-status--error" : "sp-status--success"}`}>
              {status}
            </div>
          )}

          {/* Steps list */}
          {loading ? (
            <div className="sp-loading">{t("sidepanel.loading")}</div>
          ) : (
            bundle.actions.map((action, index) => (
              <StepCard
                key={action.id}
                action={action}
                screenshot={bundle.screenshots.find((s) => s.actionId === action.id)}
                index={index}
                total={bundle.actions.length}
                onDelete={handleDeleteStep}
                onMove={(direction) => handleMoveStep(index, direction)}
              />
            ))
          )}

          {/* Deleted / restore */}
          {deleted.length > 0 && (
            <div className="sp-deleted">
              <button className="sp-mini-btn" onClick={() => setShowDeleted((value) => !value)}>
                {t("deleted.toggle", { n: deleted.length })}
              </button>
              {showDeleted && (
                <ul className="sp-deleted-list">
                  {deleted.map((action) => (
                    <li key={action.id}>
                      <span className="sp-deleted-title">{action.title}</span>
                      <button className="sp-mini-btn" onClick={() => handleRestoreStep(action.id)}>{t("deleted.restore")}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Delete session */}
          <button
            className="sp-delete-session"
            onClick={() => handleDeleteSession(selectedSession)}
          >
            <Trash2 size={14} /> {t("sidepanel.deleteSession")}
          </button>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
