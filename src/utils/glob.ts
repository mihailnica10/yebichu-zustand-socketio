import micromatch from "micromatch";

export function matchesGlob(pattern: string, event: string): boolean {
  return micromatch.isMatch(event, pattern);
}

export function getThrottleFps(
  throughput: Record<string, number>,
  event: string
): number {
  let fps = Infinity;

  for (const [pattern, patternFps] of Object.entries(throughput)) {
    if (matchesGlob(pattern, event)) {
      fps = Math.min(fps, patternFps);
    }
  }

  return fps;
}