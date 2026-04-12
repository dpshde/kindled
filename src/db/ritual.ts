import { getDb } from "./connection";
import type { LifeStage, LifeStageRecord } from "./types";

const STAGE_SCHEDULE: Record<LifeStage, { waterDays: number; transplantDays: number }> = {
  seed: { waterDays: 3, transplantDays: 7 },
  sprout: { waterDays: 7, transplantDays: 7 },
  mature: { waterDays: 30, transplantDays: 90 },
  ember: { waterDays: 365, transplantDays: 365 },
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
    planted_at: r.planted_at,
    last_watered: r.last_watered ?? undefined,
    next_watering: r.next_watering,
    watering_count: parseInt(r.watering_count, 10),
    settledness: parseInt(r.settledness, 10),
    linger_seconds: parseFloat(r.linger_seconds),
    notes_added: parseInt(r.notes_added, 10),
    connections_made: parseInt(r.connections_made, 10),
  };
}

export async function waterBlock(blockId: string): Promise<LifeStage> {
  const stage = await getLifeStage(blockId);
  if (!stage) throw new Error(`No life stage for block ${blockId}`);

  const now = new Date();

  // Transition logic: seed → sprout after first watering
  let newStage: LifeStage = stage.stage;
  if (stage.stage === "seed") {
    newStage = "sprout";
  } else if (stage.stage === "sprout" && stage.watering_count >= 3) {
    newStage = "mature";
  }

  const newSchedule = STAGE_SCHEDULE[newStage];
  const nextWatering = addDays(now, newSchedule.waterDays);

  const db = await getDb();
  await db.run(
    `UPDATE life_stages SET stage = ?, last_watered = ?, next_watering = ?, watering_count = watering_count + 1, settledness = MIN(100, settledness + 5) WHERE block_id = ?`,
    newStage,
    now.toISOString(),
    nextWatering,
    blockId,
  );

  return newStage;
}

export async function transplantBlock(blockId: string): Promise<void> {
  const stage = await getLifeStage(blockId);
  if (!stage) throw new Error(`No life stage for block ${blockId}`);

  const now = new Date();
  const schedule = STAGE_SCHEDULE[stage.stage];

  // Transplant keeps the stage but brings it back sooner
  let newStage: LifeStage = stage.stage;
  if (stage.stage === "seed") {
    newStage = "sprout";
  }

  const nextWatering = addDays(now, schedule.transplantDays);

  const db = await getDb();
  await db.run(
    `UPDATE life_stages SET stage = ?, last_watered = ?, next_watering = ?, watering_count = watering_count + 1 WHERE block_id = ?`,
    newStage,
    now.toISOString(),
    nextWatering,
    blockId,
  );
}

export async function harvestBlock(blockId: string): Promise<void> {
  const db = await getDb();
  const now = new Date();

  // Harvest moves to mature with a long next_watering
  await db.run(
    `UPDATE life_stages SET stage = 'mature', last_watered = ?, next_watering = ?, watering_count = watering_count + 1, settledness = MIN(100, settledness + 20) WHERE block_id = ?`,
    now.toISOString(),
    addDays(now, 90),
    blockId,
  );
}

export async function emberBlock(blockId: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE life_stages SET stage = 'ember', next_watering = ? WHERE block_id = ?`,
    addDays(new Date(), 365),
    blockId,
  );
}

export async function recordLinger(
  blockId: string,
  seconds: number,
): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE life_stages SET linger_seconds = linger_seconds + ? WHERE block_id = ?`,
    seconds,
    blockId,
  );
}

export async function incrementNotes(blockId: string): Promise<void> {
  const db = await getDb();
  await db.run(
    `UPDATE life_stages SET notes_added = notes_added + 1 WHERE block_id = ?`,
    blockId,
  );
}

export async function getDailyKindling(limit = 5): Promise<string[]> {
  const db = await getDb();
  const now = new Date().toISOString();

  // Priority: seeds needing water → connected to recently watered → low familiarity → random
  const rows = await db.query<Record<string, string>>(
    `SELECT b.id,
       ls.stage,
       ls.watering_count,
       ls.settledness,
       ls.connections_made,
       (SELECT COUNT(*) FROM links l WHERE l.from_block = b.id) as link_count
     FROM blocks b
     JOIN life_stages ls ON b.id = ls.block_id
     WHERE ls.stage != 'ember'
       AND ls.next_watering <= '${now}'
     ORDER BY
       CASE ls.stage
         WHEN 'seed' THEN 1
         WHEN 'sprout' THEN 2
         WHEN 'mature' THEN 3
         ELSE 4
       END,
       ls.settledness ASC,
       link_count DESC,
       RANDOM()
     LIMIT ${limit}`,
  );

  return rows.map((r) => r.id);
}
