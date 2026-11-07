export type TimeParseErrorCode =
  | 'EMPTY'
  | 'INVALID_FORMAT'
  | 'NON_NUMERIC'
  | 'MINUTES_OVER_59'
  | 'SECONDS_OVER_59'
  | 'NON_POSITIVE'
  | 'EXCEEDS_RUNTIME';

/**
 * Computes `resume.seconds / (runtimeMinutes * 60)` clamped to [0, 1].
 */
export function computeResumeRatio(
  seconds: number | null | undefined,
  runtimeMinutes: number | null | undefined,
): number {
  if (!seconds || seconds <= 0) return 0;
  if (!runtimeMinutes || runtimeMinutes <= 0) return 0;
  return Math.min(1, Math.max(0, seconds / (runtimeMinutes * 60)));
}

/**
 * Parses `h:mm:ss` or `mm:ss` into total seconds.
 * Validates against optional `runtimeMinutes` when known.
 */
export function parseTimeInput(
  input: string,
  runtimeMinutes?: number | null,
): { ok: true; seconds: number } | { ok: false; code: TimeParseErrorCode; maxMinutes?: number } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, code: 'EMPTY' };
  }

  const parts = trimmed.split(':');
  if (parts.length !== 2 && parts.length !== 3) {
    return { ok: false, code: 'INVALID_FORMAT' };
  }

  if (parts.some((p) => !/^\d+$/.test(p))) {
    return { ok: false, code: 'NON_NUMERIC' };
  }

  let hours = 0;
  let minutes: number;
  let seconds: number;

  if (parts.length === 2) {
    minutes = Number(parts[0]);
    seconds = Number(parts[1]);
  } else {
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
    seconds = Number(parts[2]);
    if (minutes >= 60) {
      return { ok: false, code: 'MINUTES_OVER_59' };
    }
  }

  if (seconds >= 60) {
    return { ok: false, code: 'SECONDS_OVER_59' };
  }

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  if (totalSeconds <= 0) {
    return { ok: false, code: 'NON_POSITIVE' };
  }

  if (runtimeMinutes && runtimeMinutes > 0) {
    const maxSeconds = runtimeMinutes * 60;
    if (totalSeconds > maxSeconds) {
      return {
        ok: false,
        code: 'EXCEEDS_RUNTIME',
        maxMinutes: runtimeMinutes,
      };
    }
  }

  return { ok: true, seconds: totalSeconds };
}

/**
 * Formats seconds into `h:mm:ss` or `mm:ss`.
 */
export function formatSeconds(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
