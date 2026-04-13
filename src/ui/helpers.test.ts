import { describe, expect, it } from "vitest";
import { formatLingerSeconds, formatTimestampMedium, nextReviewPresentation } from "./helpers";

describe("nextReviewPresentation", () => {
  it("uses soft copy for a future rhythm date", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    const r = nextReviewPresentation("2026-06-15T00:00:00.000Z", now);
    expect(r.pastSuggested).toBe(false);
    expect(r.heading).toBe("Opens again");
  });

  it("uses soft copy when the suggested date has passed", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const r = nextReviewPresentation("2026-06-01T00:00:00.000Z", now);
    expect(r.pastSuggested).toBe(true);
    expect(r.heading).toBe("Ready when you are");
  });

  it("treats same instant as pastSuggested", () => {
    const t = "2026-01-15T08:00:00.000Z";
    const now = new Date(t);
    const r = nextReviewPresentation(t, now);
    expect(r.pastSuggested).toBe(true);
  });

  it("parses SQLite datetime style (space, no T)", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const r = nextReviewPresentation("2026-06-01 08:30:00", now);
    expect(r.dateMedium).not.toMatch(/Invalid/i);
    expect(r.pastSuggested).toBe(true);
  });

  it("uses em dash when the stored value is empty or unparseable", () => {
    expect(nextReviewPresentation("", new Date()).dateMedium).toBe("—");
    expect(nextReviewPresentation("not-a-date", new Date()).dateMedium).toBe("—");
  });
});

describe("formatTimestampMedium", () => {
  it("returns em dash for empty or invalid input", () => {
    expect(formatTimestampMedium("")).toBe("—");
    expect(formatTimestampMedium(null)).toBe("—");
    expect(formatTimestampMedium("nope")).toBe("—");
  });

  it("formats ISO and SQLite datetime strings", () => {
    const iso = formatTimestampMedium("2026-04-13T14:30:00.000Z");
    expect(iso).not.toBe("—");
    expect(iso).toMatch(/2026/);
    const sql = formatTimestampMedium("2026-04-13 09:15:00");
    expect(sql).not.toBe("—");
    expect(sql).toMatch(/2026/);
  });
});

describe("formatLingerSeconds", () => {
  it("returns em dash for non-positive", () => {
    expect(formatLingerSeconds(0)).toBe("—");
    expect(formatLingerSeconds(-1)).toBe("—");
  });

  it("formats seconds only under a minute", () => {
    expect(formatLingerSeconds(45)).toBe("45s");
  });

  it("formats minutes", () => {
    expect(formatLingerSeconds(125)).toBe("2m 5s");
  });

  it("formats hours", () => {
    expect(formatLingerSeconds(3725)).toBe("1h 2m");
  });
});
