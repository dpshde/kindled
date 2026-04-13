export type NextReviewPresentation = {
  /** Short label before the date (no deadline language). */
  heading: string;
  dateMedium: string;
  /** True when the suggested date is now or in the past — passage is simply available in the rotation. */
  pastSuggested: boolean;
};

/**
 * Parse timestamps from `life_stages` — values may be JS ISO strings or SQLite `datetime('now')`
 * (`YYYY-MM-DD HH:MM:SS`). The latter is not reliably parsed by `new Date()` in all runtimes.
 */
function parseRhythmInstant(value: string | undefined | null): Date | null {
  if (value == null || typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;

  if (s.includes("T")) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    const d = new Date(s.replace(" ", "T"));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Human-readable copy for `life_stages.next_review_at` (gentle rhythm, not a deadline). */
export function nextReviewPresentation(
  nextReviewAtIso: string,
  now: Date = new Date(),
): NextReviewPresentation {
  const suggested = parseRhythmInstant(nextReviewAtIso);
  if (!suggested) {
    return {
      heading: "Opens again",
      dateMedium: "—",
      pastSuggested: false,
    };
  }

  const pastSuggested = suggested.getTime() <= now.getTime();
  return {
    heading: pastSuggested ? "Ready when you are" : "Opens again",
    dateMedium: suggested.toLocaleDateString(undefined, { dateStyle: "medium" }),
    pastSuggested,
  };
}

/** Human-readable local date/time for block and rhythm timestamps. */
export function formatTimestampMedium(value: string | undefined | null): string {
  const d = parseRhythmInstant(value);
  if (!d) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Total ritual dwell time from `life_stages.linger_seconds`. */
export function formatLingerSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const s = Math.round(seconds % 60);
  const m = Math.floor(seconds / 60) % 60;
  const h = Math.floor(seconds / 3600);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
