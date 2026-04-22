import { getDb } from "./connection";
import type { LifeStage, LifeStageRecord } from "./types";

const STAGE_SCHEDULE: Record<
  LifeStage,
  { reviewIntervalDays: number; nudgeIntervalDays: number }
> = {
  spark: { reviewIntervalDays: 3, nudgeIntervalDays: 7 },
  flame: { reviewIntervalDays: 7, nudgeIntervalDays: 7 },
  steady: { reviewIntervalDays: 30, nudgeIntervalDays: 90 },
  ember: { reviewIntervalDays: 365, nudgeIntervalDays: 365 },
};

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function getLifeStage(blockId: string): Promise<LifeStageRecord | null> {
  const db = await getDb();
  const safeId = blockId.replace(/'/g, "''");
  const rows = await db.query<Record<string, string>>(
    `SELECT * FROM life_stages WHERE block_id = '${safeId}'`,
  );
  if (rows.length === 0) return null;

  const r = rows[0];
  return {
    block_id: r.block_id,
    stage: r.stage as LifeStage,
    kindled_at: r.kindled_at,
    last_reviewed: r.last_reviewed ?? undefined,
    next_review_at: r.next_review_at,
    review_count: parseInt(r.review_count, 10),
    settledness: parseInt(r.settledness, 10),
    linger_seconds: parseFloat(r.linger_seconds),
    notes_added: parseInt(r.notes_added, 10),
    connections_made: parseInt(r.connections_made, 10),
  };
}

/** Ensures a `life_stages` row exists (e.g. older blocks created without rhythm data). */
export async function ensureLifeStage(blockId: string): Promise<LifeStageRecord> {
  const existing = await getLifeStage(blockId);
  if (existing) return existing;

  const db = await getDb();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO life_stages (block_id, stage, kindled_at, next_review_at, updated_at) VALUES (?, 'spark', ?, ?, ?)`,
    blockId,
    now,
    now,
    now,
  );
  const created = await getLifeStage(blockId);
  if (!created) throw new Error(`Failed to create life stage for ${blockId}`);
  return created;
}

/** Record a review (“Review later”) — advances rhythm and may promote spark → flame → steady. */
export async function stokeBlock(blockId: string): Promise<LifeStage> {
  const stage = await getLifeStage(blockId);
  if (!stage) throw new Error(`No life stage for block ${blockId}`);

  const now = new Date();

  let newStage: LifeStage = stage.stage;
  if (stage.stage === "spark") {
    newStage = "flame";
  } else if (stage.stage === "flame" && stage.review_count >= 3) {
    newStage = "steady";
  }

  const newSchedule = STAGE_SCHEDULE[newStage];
  const nextReviewAt = addDays(now, newSchedule.reviewIntervalDays);

  const db = await getDb();
  await db.run(
    `UPDATE life_stages SET stage = ?, last_reviewed = ?, next_review_at = ?, review_count = review_count + 1, settledness = MIN(100, settledness + 5), updated_at = ? WHERE block_id = ?`,
    newStage,
    now.toISOString(),
    nextReviewAt,
    now.toISOString(),
    blockId,
  );

  return newStage;
}

/** Bring a passage back sooner (same ritual as a full review for scheduling). */
export async function nudgeBlock(blockId: string): Promise<void> {
  const stage = await getLifeStage(blockId);
  if (!stage) throw new Error(`No life stage for block ${blockId}`);

  const now = new Date();
  const schedule = STAGE_SCHEDULE[stage.stage];

  let newStage: LifeStage = stage.stage;
  if (stage.stage === "spark") {
    newStage = "flame";
  }

  const nextReviewAt = addDays(now, schedule.nudgeIntervalDays);

  const db = await getDb();
  await db.run(
    `UPDATE life_stages SET stage = ?, last_reviewed = ?, next_review_at = ?, review_count = review_count + 1, updated_at = ? WHERE block_id = ?`,
    newStage,
    now.toISOString(),
    nextReviewAt,
    now.toISOString(),
    blockId,
  );
}

/** “Mastered” — settle into a steady flame with a long next review. */
export async function deepenBlock(blockId: string): Promise<void> {
  const db = await getDb();
  const now = new Date();

  await db.run(
    `UPDATE life_stages SET stage = 'steady', last_reviewed = ?, next_review_at = ?, review_count = review_count + 1, settledness = MIN(100, settledness + 20), updated_at = ? WHERE block_id = ?`,
    now.toISOString(),
    addDays(now, 90),
    now.toISOString(),
    blockId,
  );
}

export async function emberBlock(blockId: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.run(
    `UPDATE life_stages SET stage = 'ember', next_review_at = ?, updated_at = ? WHERE block_id = ?`,
    addDays(new Date(), 365),
    now,
    blockId,
  );
}

export async function recordLinger(
  blockId: string,
  seconds: number,
): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE life_stages SET linger_seconds = linger_seconds + ?, updated_at = ? WHERE block_id = ?`,
    seconds,
    new Date().toISOString(),
    blockId,
  );
}

export async function incrementNotes(blockId: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE life_stages SET notes_added = notes_added + 1, updated_at = ? WHERE block_id = ?`,
    new Date().toISOString(),
    blockId,
  );
}

export async function snoozeBlock(blockId: string, untilDate: Date): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE life_stages SET next_review_at = ?, updated_at = ? WHERE block_id = ?`,
    untilDate.toISOString(),
    new Date().toISOString(),
    blockId,
  );
}

/** Move block to the front of the review queue (e.g. same passage added again). */
export async function prioritizeBlockForReview(blockId: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.run(
    `UPDATE life_stages SET next_review_at = ?, stage = CASE WHEN stage = 'ember' THEN 'spark' ELSE stage END, updated_at = ? WHERE block_id = ?`,
    now,
    now,
    blockId,
  );
}

/** Session cache for home-screen kindling IDs (invalidated when saved passages change). */
let clientKindlingIdsCache: string[] | null = null;

export function peekClientKindlingIdsCache(): string[] | null {
  return clientKindlingIdsCache;
}

export function setClientKindlingIdsCache(ids: string[]): void {
  clientKindlingIdsCache = ids;
}

export function invalidateClientKindlingIdsCache(): void {
  clientKindlingIdsCache = null;
}

export async function getDailyKindling(limit = 5): Promise<string[]> {
  const db = await getDb();
  const now = new Date().toISOString();

  const rows = await db.query<Record<string, string>>(
    `SELECT b.id,
       ls.stage,
       ls.review_count,
       ls.settledness,
       ls.connections_made,
       (SELECT COUNT(*) FROM links l WHERE l.from_block = b.id) as link_count
     FROM blocks b
     JOIN life_stages ls ON b.id = ls.block_id
     WHERE ls.stage != 'ember'
       AND ls.next_review_at <= '${now}'
     ORDER BY
       CASE ls.stage
         WHEN 'spark' THEN 1
         WHEN 'flame' THEN 2
         WHEN 'steady' THEN 3
         ELSE 4
       END,
       ls.settledness ASC,
       link_count DESC,
       RANDOM()
     LIMIT ${limit}`,
  );

  return rows.map((r) => r.id);
}
