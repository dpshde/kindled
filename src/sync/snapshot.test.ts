import { describe, expect, it } from "vitest";
import { mergeSnapshots, type SyncSnapshot } from "./snapshot";

function emptySnapshot(): SyncSnapshot {
  return {
    blocks: [],
    entities: [],
    links: [],
    reflections: [],
    life_stages: [],
    deleted_records: [],
  };
}

describe("mergeSnapshots", () => {
  it("prefers the newer block version by modified_at", () => {
    const local = emptySnapshot();
    local.blocks.push({
      id: "blk_1",
      type: "note",
      content: "Local newer",
      captured_at: "2026-04-22T10:00:00.000Z",
      modified_at: "2026-04-22T10:10:00.000Z",
      tags: [],
    });

    const remote = emptySnapshot();
    remote.blocks.push({
      id: "blk_1",
      type: "note",
      content: "Remote older",
      captured_at: "2026-04-22T10:00:00.000Z",
      modified_at: "2026-04-22T10:05:00.000Z",
      tags: [],
    });

    const merged = mergeSnapshots(local, remote);
    expect(merged.blocks).toHaveLength(1);
    expect(merged.blocks[0]?.content).toBe("Local newer");
  });

  it("removes rows when a newer tombstone exists", () => {
    const local = emptySnapshot();
    local.reflections.push({
      id: "rfl_1",
      block_id: "blk_1",
      body: "hello",
      created_at: "2026-04-22T10:00:00.000Z",
      modified_at: "2026-04-22T10:05:00.000Z",
    });

    const remote = emptySnapshot();
    remote.deleted_records.push({
      table_name: "reflections",
      record_id: "rfl_1",
      deleted_at: "2026-04-22T10:06:00.000Z",
    });

    const merged = mergeSnapshots(local, remote);
    expect(merged.reflections).toHaveLength(0);
    expect(merged.deleted_records).toHaveLength(1);
  });

  it("keeps a row when the tombstone is older than the latest row update", () => {
    const local = emptySnapshot();
    local.life_stages.push({
      block_id: "blk_1",
      stage: "spark",
      kindled_at: "2026-04-22T10:00:00.000Z",
      next_review_at: "2026-04-23T10:00:00.000Z",
      review_count: 1,
      settledness: 5,
      linger_seconds: 0,
      notes_added: 0,
      connections_made: 0,
      updated_at: "2026-04-22T10:10:00.000Z",
    });

    const remote = emptySnapshot();
    remote.deleted_records.push({
      table_name: "life_stages",
      record_id: "blk_1",
      deleted_at: "2026-04-22T10:05:00.000Z",
    });

    const merged = mergeSnapshots(local, remote);
    expect(merged.life_stages).toHaveLength(1);
    expect(merged.life_stages[0]?.block_id).toBe("blk_1");
  });
});
