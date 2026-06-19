type ThrottledFn<T extends (...args: any[]) => void> = (...args: Parameters<T>) => void;

export function createThrottle<T extends (...args: any[]) => void>(
  fn: T,
  fps: number
): ThrottledFn<T> {
  if (fps === Infinity) return fn;

  const minInterval = 1000 / fps;
  let lastRun = 0;
  let pendingArgs: Parameters<T> | null = null;
  let rafId: number | null = null;

  const schedule = () => {
    if (rafId !== null) return;
    const now = performance.now();
    const elapsed = now - lastRun;
    if (elapsed >= minInterval) {
      lastRun = now - (elapsed % minInterval);
      if (pendingArgs !== null) {
        fn(...pendingArgs);
        pendingArgs = null;
      }
      rafId = null;
    } else {
      rafId = requestAnimationFrame(schedule);
    }
  };

  return (...args: Parameters<T>) => {
    const now = performance.now();
    const elapsed = now - lastRun;

    if (elapsed >= minInterval) {
      lastRun = now;
      fn(...args);
    } else {
      pendingArgs = args;
      if (rafId === null) {
        rafId = requestAnimationFrame(schedule);
      }
    }
  };
}

export function createBatchingThrottle<T extends (...args: any[]) => void>(
  fn: T,
  fps: number
): ThrottledFn<T> {
  if (fps === Infinity) return fn;

  const minInterval = 1000 / fps;
  let lastRun = 0;
  let lastArgs: Parameters<T> | null = null;
  let rafId: number | null = null;

  const flush = () => {
    if (lastArgs !== null) {
      fn(...lastArgs);
      lastArgs = null;
    }
    lastRun = performance.now();
    rafId = null;
  };

  return (...args: Parameters<T>) => {
    lastArgs = args;
    if (rafId !== null) return;

    const now = performance.now();
    const elapsed = now - lastRun;

    if (elapsed >= minInterval) {
      flush();
    } else {
      rafId = requestAnimationFrame(flush);
    }
  };
}