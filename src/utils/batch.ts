type FlushCallback = (updates: Map<string, unknown[]>) => void;

export class BatchEngine {
  private buffer = new Map<string, unknown[]>();
  private rafId: number | null = null;
  private flushCallback: FlushCallback | null = null;
  private fps: number;
  private interval: number | null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(config: { fps?: number; interval?: number } = {}) {
    this.fps = config.fps ?? 60;
    this.interval = config.interval ?? null;
  }

  bufferAdd(key: string, data: unknown): void {
    if (!this.buffer.has(key)) {
      this.buffer.set(key, []);
    }
    this.buffer.get(key)!.push(data);
  }

  onFlush(callback: FlushCallback): () => void {
    this.flushCallback = callback;
    return () => {
      if (this.flushCallback === callback) {
        this.flushCallback = null;
      }
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    if (this.interval !== null) {
      this.intervalId = setInterval(() => this.flush(), this.interval!);
    } else {
      this.scheduleRaf();
    }
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  flush(): void {
    if (this.buffer.size === 0 || !this.flushCallback) return;
    const snapshot = new Map(this.buffer);
    this.buffer.clear();
    this.flushCallback(snapshot);
  }

  private scheduleRaf = (): void => {
    if (!this.running) return;
    const minInterval = 1000 / this.fps;
    const loop = (timestamp: number) => {
      if (!this.running) return;
      this.flush();
      const delay = Math.max(0, minInterval - 16);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  };

  get isRunning(): boolean {
    return this.running;
  }
}