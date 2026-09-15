import { describe, expect, it, vi } from "vitest";
import { InputDebouncer } from "./inputDebounce";

describe("InputDebouncer", () => {
  it("debounces repeated events for the same target", () => {
    vi.useFakeTimers();
    const debouncer = new InputDebouncer<object>();
    const target = {};
    const callback = vi.fn();

    debouncer.schedule(target, 450, callback);
    debouncer.schedule(target, 450, callback);
    vi.advanceTimersByTime(449);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("keeps independent targets on independent timers", () => {
    vi.useFakeTimers();
    try {
      const debouncer = new InputDebouncer<object>();
      const first = {};
      const second = {};
      const firstCb = vi.fn();
      const secondCb = vi.fn();

      debouncer.schedule(first, 5000, firstCb);
      debouncer.schedule(second, 5000, secondCb);
      vi.advanceTimersByTime(5000);
      expect(firstCb).toHaveBeenCalledTimes(1);
      expect(secondCb).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rescheduling resets the window so only the tail commit fires", () => {
    // Models CJK-style commit bursts: each commit reschedules, one step fires.
    vi.useFakeTimers();
    try {
      const debouncer = new InputDebouncer<object>();
      const target = {};
      const callback = vi.fn();

      debouncer.schedule(target, 5000, callback);
      vi.advanceTimersByTime(4000);
      debouncer.schedule(target, 5000, callback);
      vi.advanceTimersByTime(4000);
      expect(callback).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
