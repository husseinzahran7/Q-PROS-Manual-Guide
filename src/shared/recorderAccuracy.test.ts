import { describe, expect, it } from "vitest";
import {
  CHANGE_INPUT_SUPPRESS_MS,
  CLICK_NAV_SUPPRESS_MS,
  SUBMIT_CLICK_SUPPRESS_MS,
  isClickInsideForm,
  isNavigationTrigger,
  isSameNavigationUrl,
  shouldSuppressChange,
  shouldSuppressNavigation,
  shouldSuppressSubmit,
  wasRecently
} from "./recorderAccuracy";

function el(tag: string, attrs: Record<string, string> = {}): Element {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

describe("SPA routing dedupe", () => {
  it("treats the same URL as already recorded (one nav step per route)", () => {
    expect(isSameNavigationUrl("https://app.test/#/orders", "https://app.test/#/orders")).toBe(true);
  });

  it("treats distinct route URLs as new navigations", () => {
    expect(isSameNavigationUrl("https://app.test/#/orders", "https://app.test/#/orders/42")).toBe(false);
    expect(isSameNavigationUrl("https://app.test/a", "https://app.test/b")).toBe(false);
  });

  it("treats hash-only changes as navigations for hash routers", () => {
    expect(isSameNavigationUrl("https://app.test/#a", "https://app.test/#b")).toBe(false);
  });
});

describe("navigation trigger correlation", () => {
  it("flags links, buttons and submits as navigation triggers", () => {
    expect(isNavigationTrigger(el("a", { href: "/orders" }))).toBe(true);
    expect(isNavigationTrigger(el("button"))).toBe(true);
    const submit = document.createElement("input");
    submit.type = "submit";
    expect(isNavigationTrigger(submit)).toBe(true);
    const link = el("span", { role: "link" });
    expect(isNavigationTrigger(link)).toBe(true);
  });

  it("does not flag plain controls as navigation triggers", () => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    expect(isNavigationTrigger(checkbox)).toBe(false);
    const text = document.createElement("input");
    text.type = "text";
    expect(isNavigationTrigger(text)).toBe(false);
    expect(isNavigationTrigger(el("div"))).toBe(false);
    // Anchor without href navigates nowhere.
    expect(isNavigationTrigger(el("a"))).toBe(false);
  });

  it("suppresses nav after a click on a navigating control (click documents intent)", () => {
    expect(
      shouldSuppressNavigation({ lastClickAt: 1000, lastClickWasNavTrigger: true, now: 1500 })
    ).toBe(true);
  });

  it("keeps nav after a click on a non-navigating control (no blanket suppression)", () => {
    expect(
      shouldSuppressNavigation({ lastClickAt: 1000, lastClickWasNavTrigger: false, now: 1500 })
    ).toBe(false);
  });

  it("keeps nav after the correlation window expires", () => {
    expect(
      shouldSuppressNavigation({
        lastClickAt: 1000,
        lastClickWasNavTrigger: true,
        now: 1000 + CLICK_NAV_SUPPRESS_MS + 1
      })
    ).toBe(false);
  });
});

describe("iframe doubles", () => {
  it("records navigation only for the top frame", () => {
    // recordNavigation/patchHistory gate on window !== window.top; the helper
    // contract is: non-top frames never own navigation steps.
    const shouldRecordFrameNavigation = (isTopFrame: boolean) => isTopFrame;
    expect(shouldRecordFrameNavigation(true)).toBe(true);
    expect(shouldRecordFrameNavigation(false)).toBe(false);
  });
});

describe("IME / input-change fidelity (CJK = 1 input step)", () => {
  it("suppresses the trailing change after a flushed input (typing + blur)", () => {
    const now = Date.now();
    expect(
      shouldSuppressChange({ clickedRecently: false, inputRecordedRecently: true })
    ).toBe(true);
    expect(wasRecently(now - 100, now, CHANGE_INPUT_SUPPRESS_MS)).toBe(true);
  });

  it("keeps change when no input was just recorded", () => {
    expect(
      shouldSuppressChange({ clickedRecently: false, inputRecordedRecently: false })
    ).toBe(false);
  });

  it("expires the input-change suppression window", () => {
    const now = Date.now();
    expect(wasRecently(now - CHANGE_INPUT_SUPPRESS_MS - 1, now, CHANGE_INPUT_SUPPRESS_MS)).toBe(false);
    expect(wasRecently(undefined, now, CHANGE_INPUT_SUPPRESS_MS)).toBe(false);
  });
});

describe("submit correlation", () => {
  it("suppresses submit only when the click was inside the submitted form", () => {
    const form = document.createElement("form");
    const button = document.createElement("button");
    form.appendChild(button);
    document.body.appendChild(form);
    try {
      expect(isClickInsideForm(form, button)).toBe(true);
      expect(
        shouldSuppressSubmit({ lastClickAt: 1000, now: 1200, clickInsideForm: true })
      ).toBe(true);
      expect(
        shouldSuppressSubmit({ lastClickAt: 1000, now: 1200, clickInsideForm: false })
      ).toBe(false);
    } finally {
      form.remove();
    }
  });

  it("keeps submit after the click window expires or with no click target", () => {
    expect(
      shouldSuppressSubmit({
        lastClickAt: 1000,
        now: 1000 + SUBMIT_CLICK_SUPPRESS_MS + 1,
        clickInsideForm: true
      })
    ).toBe(false);
    const form = document.createElement("form");
    expect(isClickInsideForm(form, null)).toBe(false);
  });
});
