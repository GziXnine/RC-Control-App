export const RECONNECT_BACKOFF_MS = [600, 1200, 2000, 3500, 5000] as const;

export function getReconnectDelayMs(attempt: number): number {
  if (attempt <= 0) {
    return RECONNECT_BACKOFF_MS[0] ?? 600;
  }

  const index = Math.min(attempt, RECONNECT_BACKOFF_MS.length - 1);
  return RECONNECT_BACKOFF_MS[index] ?? RECONNECT_BACKOFF_MS[RECONNECT_BACKOFF_MS.length - 1] ?? 5000;
}

export function hasTelemetryTimedOut(lastTelemetryAt: number, now: number, timeoutMs: number): boolean {
  if (lastTelemetryAt <= 0) {
    return false;
  }

  return now - lastTelemetryAt > timeoutMs;
}
