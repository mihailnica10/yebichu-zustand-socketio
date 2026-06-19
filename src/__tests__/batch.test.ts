import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BatchEngine } from "../utils/batch";

describe("BatchEngine", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", vi.fn((cb: Function) => setTimeout(() => cb(performance.now()), 16)));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("accumulates data in buffer", () => {
    const engine = new BatchEngine({ fps: 60 });
    const flush = vi.fn();
    engine.onFlush(flush);
    engine.start();

    engine.bufferAdd("ticks", { price: 100 });
    engine.bufferAdd("ticks", { price: 101 });
    engine.bufferAdd("orders", { id: 1 });

    expect(engine.isRunning).toBe(true);
    engine.stop();
  });

  it("calls flush callback on interval", () => {
    const engine = new BatchEngine({ interval: 100 });
    const flush = vi.fn();
    engine.onFlush(flush);
    engine.start();

    engine.bufferAdd("ticks", { price: 100 });

    vi.advanceTimersByTime(100);
    expect(flush).toHaveBeenCalledTimes(1);

    engine.stop();
  });

  it("returns unsubscribe function", () => {
    const engine = new BatchEngine({ interval: 100 });
    const flush = vi.fn();
    const unsub = engine.onFlush(flush);

    engine.start();
    engine.bufferAdd("x", 1);

    unsub();
    vi.advanceTimersByTime(100);

    expect(flush).not.toHaveBeenCalled();
    engine.stop();
  });
});
