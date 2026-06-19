import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createThrottle } from "../utils/throttle";

describe("throttle", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", vi.fn((cb: Function) => setTimeout(() => cb(performance.now()), 16)));
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("passes through all events when fps is Infinity", () => {
    const fn = vi.fn();
    const throttled = createThrottle(fn, Infinity);

    throttled("a");
    throttled("b");
    throttled("c");

    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenCalledWith("a");
    expect(fn).toHaveBeenCalledWith("b");
    expect(fn).toHaveBeenCalledWith("c");
  });

  it("returns a callable function", () => {
    const fn = vi.fn();
    const throttled = createThrottle(fn, 60);
    expect(typeof throttled).toBe("function");
  });
});
