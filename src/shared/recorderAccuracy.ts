// Pure correlation helpers for the content recorder (thread 4).
//
// These decide when a navigation / change / submit step is redundant with an
// already-recorded click or input step. They touch only DOM queries and
// timestamps — no chrome.* access — so they stay unit-testable under jsdom.
// The stateful recorder in src/content/recorder.ts wires them up.

export const CLICK_NAV_SUPPRESS_MS = 2000;
export const NAV_COALESCE_MS = 120;
export const SUBMIT_CLICK_SUPPRESS_MS = 500;
export const CHANGE_INPUT_SUPPRESS_MS = 1500;

export function isSameNavigationUrl(a: string, b: string): boolean {
  return a === b;
}

/**
 * True when clicking this element can plausibly cause a navigation, so a
 * navigation step arriving right after the click is likely the click's
 * consequence (suppress it). Clicks on non-navigating controls (checkbox,
 * text field, plain div) must NOT suppress a following navigation.
 */
export function isNavigationTrigger(target: Element): boolean {
  const tag = target.tagName.toLowerCase();
  if (tag === "a") return target.hasAttribute("href");
  if (tag === "button") return true;
  if (tag === "summary") return true;
  if (target instanceof HTMLInputElement) {
    return ["button", "submit", "image"].includes(target.type);
  }
  const role = target.getAttribute("role");
  if (role && /^(link|button|tab|menuitem)$/i.test(role)) return true;
  return false;
}

export function shouldSuppressNavigation(opts: {
  lastClickAt: number;
  lastClickWasNavTrigger: boolean;
  now: number;
  windowMs?: number;
}): boolean {
  const windowMs = opts.windowMs ?? CLICK_NAV_SUPPRESS_MS;
  if (!opts.lastClickWasNavTrigger) return false;
  return opts.now - opts.lastClickAt < windowMs;
}

export function shouldSuppressChange(opts: {
  clickedRecently: boolean;
  inputRecordedRecently: boolean;
}): boolean {
  // change after click (checkbox/radio handled by click) or after a flushed
  // input (typing + blur, incl. CJK commit + blur) would double-record.
  return opts.clickedRecently || opts.inputRecordedRecently;
}

export function isClickInsideForm(form: Element, clickTarget: Element | null): boolean {
  if (!clickTarget) return false;
  if (form === clickTarget) return true;
  try {
    return form.contains(clickTarget);
  } catch {
    return false;
  }
}

export function shouldSuppressSubmit(opts: {
  lastClickAt: number;
  now: number;
  clickInsideForm: boolean;
  windowMs?: number;
}): boolean {
  const windowMs = opts.windowMs ?? SUBMIT_CLICK_SUPPRESS_MS;
  if (!opts.clickInsideForm) return false;
  return opts.now - opts.lastClickAt < windowMs;
}

export function wasRecently(timestamp: number | undefined, now: number, windowMs: number): boolean {
  return timestamp !== undefined && now - timestamp < windowMs;
}
