import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties, type DragEvent, type MouseEvent } from "react";
import { createRoot } from "react-dom/client";
import { FileDown, FileText, Plus, Clock, StickyNote, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trash2, X, ImagePlus } from "lucide-react";
import "../styles.css";
import { isOk, sendMessage } from "../shared/messages";
import { runtimeVariableName } from "../shared/sanitize";
import { t } from "../shared/i18n";
import type { ExportType, RecordedAction, RecordingSession, ScreenshotRecord, SessionBundle, StorageEstimate } from "../shared/types";
import { AzurePushPanel } from "../shared/AzurePushPanel";

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function resizeDataUrl(dataUrl: string, maxDim = 1280): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim) { resolve(dataUrl); return; }
      if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
      else { width = Math.round(width * maxDim / height); height = maxDim; }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

type ExportResponse = {
  record: { filename: string };
  content?: string;
  base64?: string;
  mimeType?: string;
};

function download(filename: string, content: string | Blob, type = "text/markdown") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function mimeForFilename(filename: string) {
  if (filename.endsWith(".ts")) return "text/typescript";
  if (filename.endsWith(".json")) return "application/json";
  return "text/markdown";
}

function blobFromBase64(base64: string, type: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type });
}

function Toast({ message, kind, onDone }: { message: string; kind: "error" | "success"; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, kind === "error" ? 6000 : 5000);
    return () => clearTimeout(timer);
  }, [kind, onDone]);
  return (
    <div className={`toast toast--${kind}`}>
      <span>{message}</span>
      <button className="toastClose" onClick={onDone}><X size={14} /></button>
    </div>
  );
}

function Editor() {
  const initialSession = new URLSearchParams(location.search).get("session") || undefined;
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(initialSession);
  const [bundle, setBundle] = useState<SessionBundle | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [storage, setStorage] = useState<StorageEstimate | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [deleted, setDeleted] = useState<RecordedAction[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: "error" | "success" } | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [manualScreenshot, setManualScreenshot] = useState<string | null>(null);
  const [insertAfterId, setInsertAfterId] = useState<string | null>(null);

  function showError(msg: string) {
    setError(msg);
    setToast({ message: msg, kind: "error" });
  }

  async function loadStorage() {
    const response = await sendMessage<StorageEstimate>({ type: "storage:estimate" });
    if (isOk(response)) setStorage(response.data);
  }

  const screenshots = useMemo(() => new Map((bundle?.screenshots || []).map((shot) => [shot.actionId, shot])), [bundle]);

  async function loadSessions() {
    const response = await sendMessage<RecordingSession[]>({ type: "session:list" });
    if (isOk(response)) {
      setSessions(response.data);
      if (!selectedId && response.data[0]) setSelectedId(response.data[0].id);
    }
  }

  async function loadBundle(sessionId: string) {
    setLoading(true);
    setError("");
    const response = await sendMessage<SessionBundle>({ type: "session:get", sessionId });
    if (isOk(response)) setBundle(response.data);
    else showError(response.error);
    const del = await sendMessage<RecordedAction[]>({ type: "session:deleted-steps", sessionId });
    if (isOk(del)) setDeleted(del.data);
    setLoading(false);
  }

  async function restoreStep(actionId: string) {
    const response = await sendMessage({ type: "session:restore-step", actionId });
    if (!response.ok) {
      showError(response.error);
      return;
    }
    if (bundle) await loadBundle(bundle.session.id);
  }

  async function insertStep(kind: "note" | "wait") {
    if (!bundle) return;
    const response = await sendMessage<SessionBundle>({ type: "session:insert-step", sessionId: bundle.session.id, kind, value: kind === "wait" ? "2" : "" });
    if (isOk(response)) setBundle(response.data);
    else showError(response.error);
  }

  async function insertManualStep() {
    if (!bundle || !manualTitle.trim()) return;
    try {
      const resized = manualScreenshot ? await resizeDataUrl(manualScreenshot) : undefined;
      const response = await sendMessage<SessionBundle>({
        type: "session:insert-manual-step",
        sessionId: bundle.session.id,
        title: manualTitle.trim(),
        description: manualDesc.trim(),
        screenshotDataUrl: resized,
        insertAfterActionId: insertAfterId ?? undefined
      });
      if (isOk(response)) {
        setBundle(response.data);
        setManualTitle("");
        setManualDesc("");
        setManualScreenshot(null);
        setShowManualForm(false);
        setInsertAfterId(null);
        setToast({ message: "Manual step added", kind: "success" });
      } else {
        showError(response.error);
      }
    } catch (err) {
      console.error("[Q-PROS] insertManualStep error:", err);
      showError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleManualScreenshot(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setManualScreenshot(reader.result as string);
    reader.readAsDataURL(file);
  }

  function openManualFormAfter(actionId: string | null) {
    setInsertAfterId(actionId);
    setShowManualForm(true);
    setManualTitle("");
    setManualDesc("");
    setManualScreenshot(null);
  }

  useEffect(() => {
    void loadSessions();
    void loadStorage();
  }, []);

  useEffect(() => {
    if (selectedId) void loadBundle(selectedId);
  }, [selectedId]);

  async function updateMeta(patch: Partial<Pick<RecordingSession, "title" | "summary" | "successCriteria">>) {
    if (!bundle) return;
    const response = await sendMessage({ type: "session:update-meta", sessionId: bundle.session.id, patch });
    if (!response.ok) {
      showError(response.error);
      return;
    }
    setBundle({ ...bundle, session: { ...bundle.session, ...patch } });
    await loadSessions();
  }

  async function patchStep(action: RecordedAction, patch: Partial<RecordedAction>) {
    const response = await sendMessage<RecordedAction>({ type: "session:update-step", actionId: action.id, patch });
    if (!response.ok) showError(response.error);
    if (bundle) await loadBundle(bundle.session.id);
  }

  async function deleteStep(action: RecordedAction) {
    const response = await sendMessage({ type: "session:delete-step", actionId: action.id });
    if (!response.ok) showError(response.error);
    if (bundle) await loadBundle(bundle.session.id);
  }

  async function reorder(ids: string[]) {
    if (!bundle) return;
    const response = await sendMessage<SessionBundle>({ type: "session:reorder-steps", sessionId: bundle.session.id, actionIds: ids });
    if (isOk(response)) setBundle(response.data);
    else showError(response.error);
  }

  async function moveStep(index: number, direction: -1 | 1) {
    if (!bundle) return;
    const target = index + direction;
    if (target < 0 || target >= bundle.actions.length) return;
    const ids = bundle.actions.map((action) => action.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await reorder(ids);
  }

  // Drag-and-drop reordering. Move the dragged step to the drop slot and keep
  // the rest in order.
  async function dropStep(targetIndex: number) {
    const from = dragIndex;
    setDragIndex(null);
    setOverIndex(null);
    if (from === null || from === targetIndex || !bundle) return;
    const ids = bundle.actions.map((action) => action.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(targetIndex, 0, moved);
    await reorder(ids);
  }

  async function clearAll() {
    if (!confirm(t("editor.confirmClearAll"))) return;
    const response = await sendMessage({ type: "storage:clear" });
    if (!response.ok) {
      showError(response.error);
      return;
    }
    setSelectedId(undefined);
    setBundle(null);
    await loadSessions();
    await loadStorage();
  }

  async function deleteSessionAt(sessionId: string) {
    if (!confirm(t("editor.confirmDeleteSession"))) return;
    const response = await sendMessage({ type: "session:delete", sessionId });
    if (!response.ok) {
      showError(response.error);
      return;
    }
    if (selectedId === sessionId) {
      setSelectedId(undefined);
      setBundle(null);
    }
    await loadSessions();
    await loadStorage();
  }

  async function exportBundle(exportType: ExportType) {
    if (!bundle) return;
    const response = await sendMessage<ExportResponse>({ type: "export:create", sessionId: bundle.session.id, exportType });
    if (!response.ok) {
      showError(response.error);
      return;
    }
    if (response.data.content !== undefined) {
      download(response.data.record.filename, response.data.content, mimeForFilename(response.data.record.filename));
    } else if (response.data.base64) {
      download(response.data.record.filename, blobFromBase64(response.data.base64, response.data.mimeType || "application/zip"), "application/zip");
    }
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="topbarTitle">
          <span className="kicker">{t("editor.kicker")}</span>
          <h1>{bundle ? bundle.session.title : t("editor.title")}</h1>
          <span className="topbarCredit">by Q-PROS</span>
        </div>
        <div className="topbarActions">
          <button disabled={!bundle} onClick={() => openManualFormAfter(null)}><ImagePlus size={14} /> {t("editor.addManual")}</button>
          <button disabled={!bundle} onClick={() => void exportBundle("docx")}><FileText size={14} /> {t("editor.export.docx")}</button>
          <button disabled={!bundle} onClick={() => void exportBundle("pdf")}><FileDown size={14} /> {t("editor.export.pdf")}</button>
        </div>
      </header>
      <section className="layout">
        <aside className="sidebar">
          <strong>{t("editor.recordings")}</strong>
          <div className="sessionList">
            {sessions.map((session) => {
              const perSession = storage?.perSession.find((entry) => entry.sessionId === session.id);
              return (
                <div key={session.id} className={`sessionRow ${session.id === selectedId ? "active" : ""}`}>
                  <button className="sessionButton" onClick={() => setSelectedId(session.id)}>
                    <span>{session.title}</span>
                    <span className="muted">
                      {t("editor.sessionMeta", { n: session.actionCount })}{perSession ? ` · ${formatBytes(perSession.screenshotBytes)}` : ""}
                    </span>
                  </button>
                  <button className="danger small" title={t("editor.deleteRecording")} onClick={() => void deleteSessionAt(session.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
          {storage ? (
            <div className="storageInfo muted">
              <span>
                {t("editor.storage", { n: storage.sessionCount, usage: formatBytes(storage.usageBytes) })}
                {storage.quotaBytes ? ` / ${formatBytes(storage.quotaBytes)}` : ""}
              </span>
              {storage.sessionCount > 0 ? (
                <button className="danger small" onClick={() => void clearAll()}><Trash2 size={12} /> {t("editor.clearAll")}</button>
              ) : null}
            </div>
          ) : null}
          {bundle ? (
            <details className="azurePush" style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", fontSize: 12 }}>{t("azure.title")}</summary>
              <AzurePushPanel sessionId={bundle.session.id} sessionTitle={bundle.session.title} />
            </details>
          ) : null}
        </aside>
        <section className="content">
          {error ? <p className="errorBanner">{error}</p> : null}
          {toast ? <Toast message={toast.message} kind={toast.kind} onDone={() => setToast(null)} /> : null}
          {loading && !bundle ? (
            <SkeletonSteps />
          ) : !bundle ? (
            <EmptyState kicker={t("empty.shelf.kicker")} title={t("empty.shelf.title")} body={t("empty.shelf.body")} />
          ) : (
            <>
              <WorkflowCard session={bundle.session} onChange={(patch) => void updateMeta(patch)} />
              {bundle.actions.length === 0 ? (
                <EmptyState kicker={t("empty.steps.kicker")} title={t("empty.steps.title")} body={t("empty.steps.body")} />
              ) : (
                <div className="steps">
                  {bundle.actions.map((action, index) => (
                    <div key={action.id} className="stepSlot">
                      <StepCard
                        action={action}
                        index={index}
                        screenshot={screenshots.get(action.id)}
                        total={bundle.actions.length}
                        dragging={dragIndex === index}
                        isDropTarget={overIndex === index && dragIndex !== null && dragIndex !== index}
                        onPatch={(patch) => void patchStep(action, patch)}
                        onDelete={() => void deleteStep(action)}
                        onMove={(direction) => void moveStep(index, direction)}
                        onDragStart={() => setDragIndex(index)}
                        onDragEnter={() => setOverIndex(index)}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setOverIndex(null);
                        }}
                        onDrop={() => void dropStep(index)}
                        onZoom={() => setLightbox(index)}
                      />
                      <button className="insertBetween" onClick={() => openManualFormAfter(action.id)}>
                        <Plus size={12} /> Add step here
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="insertBar">
                <span className="insertLabel">{t("insert.title")}</span>
                <button onClick={() => void insertStep("note")}><StickyNote size={14} /> {t("insert.note")}</button>
                <button onClick={() => void insertStep("wait")}><Clock size={14} /> {t("insert.wait")}</button>
                <span className="insertHint muted">{t("insert.hint")}</span>
              </div>
              {deleted.length ? (
                <div className="deletedSection">
                  <button className="deletedToggle" onClick={() => setShowDeleted((value) => !value)}>
                    {t("deleted.toggle", { n: deleted.length })}
                  </button>
                  {showDeleted ? (
                    <ul className="deletedList">
                      {deleted.map((action) => (
                        <li key={action.id}>
                          <span className="deletedTitle">{action.title}</span>
                          <button className="small" onClick={() => void restoreStep(action.id)}>{t("deleted.restore")}</button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </section>
      </section>
      {lightbox !== null && bundle ? (() => {
        const stepsWithScreenshots = bundle.actions
          .map((a, i) => ({ action: a, idx: i }))
          .filter(({ action }) => screenshots.get(action.id));
        const currentEntry = stepsWithScreenshots.find(e => e.idx === lightbox);
        const currentPos = stepsWithScreenshots.findIndex(e => e.idx === lightbox);
        if (!currentEntry) return null;
        const screenshot = screenshots.get(currentEntry.action.id)!;
        const alt = currentEntry.action.title || `Step ${currentEntry.idx + 1}`;
        const prev = currentPos > 0 ? stepsWithScreenshots[currentPos - 1] : null;
        const next = currentPos < stepsWithScreenshots.length - 1 ? stepsWithScreenshots[currentPos + 1] : null;
        return (
          <div className="lightboxOverlay" onClick={() => setLightbox(null)}>
            <div className="lightbox" onClick={(e) => e.stopPropagation()}>
              {prev ? (
                <button className="lightboxNav lightboxPrev" onClick={() => setLightbox(prev.idx)} title="Previous screenshot">
                  <ArrowLeft size={24} />
                </button>
              ) : null}
              <img src={screenshot.dataUrl} alt={alt} />
              {next ? (
                <button className="lightboxNav lightboxNext" onClick={() => setLightbox(next.idx)} title="Next screenshot">
                  <ArrowRight size={24} />
                </button>
              ) : null}
              <button className="lightboxClose" aria-label={t("lightbox.close")} onClick={() => setLightbox(null)}><X size={20} /></button>
              <div className="lightboxCounter">{currentPos + 1} / {stepsWithScreenshots.length}</div>
            </div>
          </div>
        );
      })() : null}
      {showManualForm && (
        <div className="modalOverlay" onClick={() => { setShowManualForm(false); setInsertAfterId(null); setManualTitle(""); setManualDesc(""); setManualScreenshot(null); }}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <h3>{insertAfterId ? "Insert step here" : "Add manual step"}</h3>
            <p className="muted" style={{ margin: "0 0 12px", fontSize: 12 }}>
              Add a step with your own screenshot (e.g. from Postman, desktop app, database, etc.)
            </p>
            <label className="manualField">
              <span>Title *</span>
              <input
                value={manualTitle}
                onChange={(event) => setManualTitle(event.target.value)}
                placeholder="e.g. Verify API response in Postman"
              />
            </label>
            <label className="manualField">
              <span>Description</span>
              <textarea
                value={manualDesc}
                onChange={(event) => setManualDesc(event.target.value)}
                placeholder="Describe what this step covers..."
              />
            </label>
            <label className="manualField">
              <span>Screenshot (optional)</span>
              <input type="file" accept="image/*" onChange={handleManualScreenshot} />
            </label>
            {manualScreenshot && (
              <div className="manualPreview">
                <img src={manualScreenshot} alt="Preview" />
                <button className="danger small" onClick={() => setManualScreenshot(null)}><Trash2 size={12} /> Remove</button>
              </div>
            )}
            <div className="manualActions">
              <button className="primary" disabled={!manualTitle.trim()} onClick={() => void insertManualStep()}>
                <Plus size={14} /> Add Step
              </button>
              <button onClick={() => { setShowManualForm(false); setInsertAfterId(null); setManualTitle(""); setManualDesc(""); setManualScreenshot(null); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StepCard({
  action,
  index,
  screenshot,
  total,
  dragging,
  isDropTarget,
  onPatch,
  onDelete,
  onMove,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onDrop,
  onZoom
}: {
  action: RecordedAction;
  index: number;
  screenshot?: ScreenshotRecord;
  total: number;
  dragging: boolean;
  isDropTarget: boolean;
  onPatch: (patch: Partial<RecordedAction>) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
  onZoom: () => void;
}) {
  const runtimeName = action.runtimeVariable?.name || runtimeVariableName(action.title, index + 1).toUpperCase();
  const confidence = Math.round(action.target.selectorConfidence * 100);
  const alt = `Step ${index + 1}: ${action.title}`;
  const manual = action.type === "note" || action.type === "wait";
  const className = `step${dragging ? " dragging" : ""}${isDropTarget ? " dropTarget" : ""}`;

  const dragHandle = (
    <button
      className="dragHandle"
      title={t("step.dragHandle")}
      aria-label={t("step.dragHandle")}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <circle cx="5" cy="3" r="1.3" /><circle cx="11" cy="3" r="1.3" />
        <circle cx="5" cy="8" r="1.3" /><circle cx="11" cy="8" r="1.3" />
        <circle cx="5" cy="13" r="1.3" /><circle cx="11" cy="13" r="1.3" />
      </svg>
    </button>
  );

  const actions = (
    <div className="stepActions">
      <button disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={14} /> {t("step.moveUp")}</button>
      <button disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown size={14} /> {t("step.moveDown")}</button>
      <button className="danger" onClick={onDelete}><Trash2 size={14} /> {t("step.delete")}</button>
    </div>
  );

  const dragProps = {
    onDragOver: (event: DragEvent) => {
      if (dragging) return;
      event.preventDefault();
      onDragEnter();
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      onDrop();
    }
  };

  // Manual note / wait steps with no screenshot get the simplified view.
  // Manual steps WITH a screenshot render as full steps (like recorded ones).
  if (manual && !screenshot) {
    return (
      <article className={className} style={{ "--index": index } as CSSProperties} {...dragProps}>
        {dragHandle}
        <div className="manualChip">{action.type === "wait" ? t("step.wait") : t("step.note")}</div>
        <div className="stepFields">
        <div className="muted">{t("step.label", { n: index + 1, type: manual ? "manual" : action.type })}</div>
          {action.type === "wait" ? (
            <label className="waitField">
              <span>{t("step.waitSeconds")}</span>
              <input
                type="number"
                min={0}
                value={action.value ?? "2"}
                onChange={(event) => {
                  const seconds = event.target.value;
                  onPatch({ value: seconds, title: `Wait ${seconds || "0"}s`, description: `Pause for ${seconds || "0"} seconds before continuing.` });
                }}
              />
            </label>
          ) : (
            <textarea
              value={action.value ?? ""}
              placeholder={t("step.notePlaceholder")}
              onChange={(event) => onPatch({ value: event.target.value, title: event.target.value || "Manual note", description: event.target.value || "Manual note for the operator." })}
            />
          )}
          {actions}
        </div>
      </article>
    );
  }

  return (
    <article className={className} style={{ "--index": index } as CSSProperties} {...dragProps}>
      {dragHandle}
      <div>
        {screenshot ? (
          <button className="shotButton" onClick={onZoom} title={t("step.zoom")}>
            <img src={screenshot.dataUrl} alt={alt} />
          </button>
        ) : (
          <div className="shotEmpty">{t("step.noShot")}</div>
        )}
      </div>
      <div className="stepFields">
        <div className="muted">{t("step.label", { n: index + 1, type: action.type })}</div>
        <input value={action.title} onChange={(event) => onPatch({ title: event.target.value })} />
        <textarea value={action.description} onChange={(event) => onPatch({ description: event.target.value })} />
        <div className="flags">
          <label>
            <input
              type="checkbox"
              checked={action.valuePolicy === "runtime"}
              onChange={(event) =>
                onPatch({
                  valuePolicy: event.target.checked ? "runtime" : action.sensitive ? "masked" : "literal",
                  runtimeVariable: event.target.checked ? { name: runtimeName } : undefined
                })
              }
            />
            {t("step.runtime")}
          </label>
          <label>
            <input type="checkbox" checked={action.sensitive} onChange={(event) => onPatch({ sensitive: event.target.checked, valuePolicy: event.target.checked ? "masked" : action.valuePolicy })} />
            {t("step.sensitive")}
          </label>
          <label>
            <input type="checkbox" checked={action.highRisk} onChange={(event) => onPatch({ highRisk: event.target.checked })} />
            {t("step.highRisk")}
          </label>
        </div>
        {action.valuePolicy === "runtime" ? <input value={runtimeName} onChange={(event) => onPatch({ runtimeVariable: { name: event.target.value } })} /> : null}
        <dl className="meta">
          <div>
            <dt>{t("step.url")}</dt>
            <dd>{action.page.url}</dd>
          </div>
          <div>
            <dt>{t("step.confidence")}</dt>
            <dd>
              <span className="confidence">
                <span className="bar">
                  <i style={{ width: `${confidence}%` }} />
                </span>
                {confidence}%
                {confidence < 70 ? <em className="lowConf">{t("step.lowConf")}</em> : null}
              </span>
            </dd>
          </div>
        </dl>
        <LocatorEditor action={action} onPatch={onPatch} />
        {actions}
      </div>
    </article>
  );
}

// F — editable locator. Power users can fix a wrong/low-confidence selector or
// xpath; a manual edit marks the locator user-confirmed (confidence 1). The
// recorded candidate alternatives stay visible for reference.
function LocatorEditor({ action, onPatch }: { action: RecordedAction; onPatch: (patch: Partial<RecordedAction>) => void }) {
  const [selector, setSelector] = useState(action.target.selector);
  const [xpath, setXpath] = useState(action.target.xpath);

  useEffect(() => {
    setSelector(action.target.selector);
    setXpath(action.target.xpath);
  }, [action.id, action.target.selector, action.target.xpath]);

  function commit(next: { selector: string; xpath: string }) {
    if (next.selector === action.target.selector && next.xpath === action.target.xpath) return;
    if (!next.selector.trim() || !next.xpath.trim()) return;
    onPatch({ target: { ...action.target, selector: next.selector, xpath: next.xpath, selectorConfidence: 1 } });
  }

  return (
    <details className="locator">
      <summary>{t("locator.title")}</summary>
      <div className="locatorBody">
        <label className="locatorField">
          <span>{t("locator.css")}</span>
          <input className="mono" value={selector} onChange={(event) => setSelector(event.target.value)} onBlur={() => commit({ selector, xpath })} />
        </label>
        <label className="locatorField">
          <span>{t("locator.xpath")}</span>
          <input className="mono" value={xpath} onChange={(event) => setXpath(event.target.value)} onBlur={() => commit({ selector, xpath })} />
        </label>
        {action.target.candidates.length ? (
          <div className="candidates">
            <span className="candidatesLabel">{t("locator.alternatives")}</span>
            {action.target.candidates.map((candidate, i) => (
              <span className="candidate" key={i}>
                <code>{candidate.kind}</code> {candidate.value}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function WorkflowCard({
  session,
  onChange
}: {
  session: RecordingSession;
  onChange: (patch: Partial<Pick<RecordingSession, "title" | "summary" | "successCriteria">>) => void;
}) {
  // Local buffers so typing stays smooth; commit to the store on blur.
  const [title, setTitle] = useState(session.title);
  const [summary, setSummary] = useState(session.summary ?? "");
  const [criteria, setCriteria] = useState(session.successCriteria ?? "");

  // Re-sync when a different recording is selected.
  useEffect(() => {
    setTitle(session.title);
    setSummary(session.summary ?? "");
    setCriteria(session.successCriteria ?? "");
  }, [session.id]);

  function commit(field: "title" | "summary" | "successCriteria", value: string) {
    const current = field === "title" ? session.title : field === "summary" ? session.summary ?? "" : session.successCriteria ?? "";
    if (value === current) return;
    if (field === "title" && !value.trim()) {
      setTitle(session.title);
      return;
    }
    onChange({ [field]: value } as Partial<Pick<RecordingSession, "title" | "summary" | "successCriteria">>);
  }

  return (
    <section className="workflowCard">
      <span className="popupKicker">{t("wf.kicker")}</span>
      <input
        className="workflowTitle"
        value={title}
        placeholder={t("wf.namePlaceholder")}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => commit("title", title)}
      />
      <div className="workflowField">
        <label htmlFor="wf-goal">{t("wf.goal")}</label>
        <textarea
          id="wf-goal"
          value={summary}
          placeholder={t("wf.goalPlaceholder")}
          onChange={(event) => setSummary(event.target.value)}
          onBlur={() => commit("summary", summary)}
        />
      </div>
      <div className="workflowField">
        <label htmlFor="wf-criteria">{t("wf.criteria")}</label>
        <textarea
          id="wf-criteria"
          value={criteria}
          placeholder={t("wf.criteriaPlaceholder")}
          onChange={(event) => setCriteria(event.target.value)}
          onBlur={() => commit("successCriteria", criteria)}
        />
      </div>
    </section>
  );
}

function EmptyState({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div className="empty">
      <span className="glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="14" rx="2.5" />
          <path d="M3 8h18" />
          <circle cx="12" cy="13" r="2.4" />
        </svg>
      </span>
      <span className="popupKicker">{kicker}</span>
      <h1>{title}</h1>
      <p className="muted">{body}</p>
    </div>
  );
}

function SkeletonSteps() {
  return (
    <div className="steps" aria-busy="true" aria-label="Loading recording">
      {[0, 1, 2].map((row) => (
        <div className="skeletonStep" key={row}>
          <div className="sk shot" />
          <div className="skeletonFields">
            <div className="sk line sm" />
            <div className="sk line lg" />
            <div className="sk line" />
            <div className="sk line" style={{ width: "85%" }} />
            <div className="sk line sm" />
          </div>
        </div>
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Editor />);
