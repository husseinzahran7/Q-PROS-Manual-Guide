import type { ActionPayload, RecordedAction } from "./types";

function targetName(action: Pick<RecordedAction | ActionPayload, "target">) {
  return action.target.ariaLabel || action.target.placeholder || action.target.text || action.target.name || action.target.id || action.target.selector;
}

function inputValue(
  action: Pick<RecordedAction | ActionPayload, "value" | "valuePolicy" | "sensitive">
): string | undefined {
  if (action.sensitive) return undefined;
  if (action.value && action.valuePolicy !== "runtime" && action.valuePolicy !== "masked") return action.value;
  return undefined;
}

function safeValueLabel(
  action: Pick<RecordedAction | ActionPayload, "valueLabel" | "sensitive">
): string | undefined {
  if (action.sensitive) return undefined;
  return action.valueLabel;
}

export function generatedTitle(action: ActionPayload, stepNumber: number) {
  const target = targetName(action);
  if (action.type === "input") {
    const val = inputValue(action);
    return val ? `Enter "${val}" in ${target}` : `Enter value in ${target}`;
  }
  if (action.type === "change") {
    const label = safeValueLabel(action) ? ` to ${safeValueLabel(action)}` : "";
    return `Change ${target}${label}`;
  }
  if (action.type === "submit") return `Submit ${target}`;
  if (action.type === "keydown") return `Press ${action.key || "key"} on ${target}`;
  if (action.type === "navigation") return `Navigate to ${action.page.domain}`;
  if (action.type === "note") return action.value?.trim() || "Manual note";
  if (action.type === "wait") return `Wait ${action.value || "2"}s`;
  if (action.type === "paste") return `Paste content into ${target}`;
  if (action.type === "upload") return `Upload file into ${target}`;
  if (action.type === "rightclick") return `Right-click ${target}`;
  if (action.type === "doubleclick") return `Double-click ${target}`;
  if (action.type === "dragstart") return `Begin dragging ${target}`;
  if (action.type === "drop") return `Drop onto ${target}`;
  if (action.type === "toggle") return `${action.key === "close" ? "Close" : "Open"} ${target}`;
  if (action.type === "dialog") {
    const kind = action.dialog?.kind ?? "alert";
    if (kind === "prompt") return `Respond to browser prompt`;
    if (kind === "confirm") return `${action.dialog?.accepted ? "Accept" : "Dismiss"} browser confirm`;
    if (kind === "print") return `Open print dialog`;
    if (kind === "beforeunload") return `Page tried to navigate away`;
    return `Browser alert appeared`;
  }
  return `Click ${target || `step ${stepNumber}`}`;
}

export function generatedDescription(action: ActionPayload) {
  const target = targetName(action);
  if (action.type === "input") {
    const val = inputValue(action);
    return val ? `Type "${val}" into ${target}.` : `Type the required value into ${target}.`;
  }
  if (action.type === "change") {
    const label = safeValueLabel(action) ? ` (${safeValueLabel(action)})` : "";
    return `Set ${target}${label} to the recorded state.`;
  }
  if (action.type === "submit") return `Submit the form from ${action.page.title || action.page.url}.`;
  if (action.type === "keydown") return `Press ${action.key || "the recorded key"} while focused on ${target}.`;
  if (action.type === "navigation") return `Open ${action.page.url}.`;
  if (action.type === "note") return action.value?.trim() || "Manual note for the operator.";
  if (action.type === "wait") return `Pause for ${action.value || "2"} seconds before continuing.`;
  if (action.type === "paste") return `Paste the required content into ${target}.`;
  if (action.type === "upload") return `Provide the file(s) for ${target}.`;
  if (action.type === "rightclick") return `Open the context menu for ${target}.`;
  if (action.type === "doubleclick") return `Double-click ${target}.`;
  if (action.type === "dragstart") return `Start a drag from ${target}.`;
  if (action.type === "drop") return `Drop the dragged item onto ${target}.`;
  if (action.type === "toggle") return `${action.key === "close" ? "Collapse" : "Expand"} ${target}.`;
  if (action.type === "dialog") {
    const kind = action.dialog?.kind ?? "alert";
    const message = action.dialog?.message ? ` "${action.dialog.message}"` : "";
    if (kind === "prompt") return `Provide the prompt response${message}.`;
    if (kind === "confirm") return `${action.dialog?.accepted ? "Accept" : "Dismiss"} the browser confirm${message}.`;
    if (kind === "print") return `Open the browser print dialog.`;
    if (kind === "beforeunload") return `Confirm leaving the page.`;
    return `Acknowledge the browser alert${message}.`;
  }
  return `Select ${target}.`;
}

// Privacy: stored titles/descriptions may embed cleartext captured before a
// step was marked Sensitive (e.g. `Enter "s3cr3t" in Token`). Exporters must
// never emit those — regenerate from a value-stripped copy so the secret
// can't leak via intent, comments, filenames, or env-var names.
interface ExportableAction {
  type: ActionPayload["type"];
  target: ActionPayload["target"];
  page: ActionPayload["page"];
  value?: ActionPayload["value"];
  valueLabel?: ActionPayload["valueLabel"];
  valuePolicy: ActionPayload["valuePolicy"];
  sensitive?: boolean | null;
  key?: ActionPayload["key"];
  dialog?: ActionPayload["dialog"];
  title?: string;
  description?: string;
}

function sanitizedCopy(action: ExportableAction): ActionPayload {
  const base = action as ActionPayload & { title?: string; description?: string };
  if (!action.sensitive) return base as ActionPayload;
  return {
    ...base,
    value: undefined,
    valueLabel: undefined,
    dialog: base.dialog
      ? { kind: base.dialog.kind, message: base.dialog.message, response: undefined, accepted: base.dialog.accepted }
      : undefined
  } as ActionPayload;
}

export function safeTitle(action: ExportableAction, stepNumber: number): string {
  if (!action.sensitive) return action.title || generatedTitle(action as ActionPayload, stepNumber);
  return generatedTitle(sanitizedCopy(action), stepNumber);
}

export function safeDescription(action: ExportableAction): string {
  if (!action.sensitive) return action.description || generatedDescription(action as ActionPayload);
  return generatedDescription(sanitizedCopy(action));
}
