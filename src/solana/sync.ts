import { getDb } from "../db/connection";
import {
  createBlock,
  findScriptureBlockByCanonicalRef,
  findAnyBlockByCanonicalRef,
} from "../db/blocks";
import { invalidateClientKindlingIdsCache } from "../db/ritual";
import {
  fetchMemoHistory,
  fetchMemoHistoryIncremental,
  replayMemoLog,
  storeMemoSyncCursor,
} from "./history";
import { getConnectedAddress } from "./wallet";
import { resolvePassage } from "../scripture/RouteBibleClient";
import { OSIS_BOOK_NAMES, tryParsePassage, type OsisBookCode } from "grab-bcv";

function displayRefFromOsis(osisRef: string): string {
  const parts = osisRef.split(".");
  const book = OSIS_BOOK_NAMES[parts[0] as OsisBookCode] ?? parts[0];
  const chapter = parts[1] ?? "";
  const verse = parts[2] ?? "";
  if (verse) return `${book} ${chapter}:${verse}`;
  if (chapter) return `${book} ${chapter}`;
  return book;
}

function isValidOsisRef(ref: string): boolean {
  return tryParsePassage(ref).ok;
}

export async function syncLocalDbWithMemoLog(): Promise<{
  added: number;
  removed: number;
  newestSignature: string | null;
}> {
  const walletAddress = getConnectedAddress();
  if (!walletAddress) {
    throw new Error("No wallet connected.");
  }

  let { events, newestSignature } =
    await fetchMemoHistoryIncremental(walletAddress);
  console.log(
    `[SolanaSync] Incremental events: ${events.length}, newestSig: ${newestSignature ? newestSignature.slice(0, 8) + "..." : "none"}`,
  );

  const db = await getDb();
  const localRows = await db.query<{ scripture_ref: string }>(
    `SELECT scripture_ref FROM blocks WHERE type = 'scripture' AND scripture_ref IS NOT NULL AND archived_at IS NULL`,
  );
  const localRefs = new Set(localRows.map((r) => r.scripture_ref));
  console.log(`[SolanaSync] Local scripture blocks: ${localRefs.size}`);

  // Safety hatch: if DB is empty but incremental returned nothing,
  // the cursor may be stale (e.g. DB was wiped). Do a full fetch.
  if (localRefs.size === 0 && events.length === 0) {
    console.log(
      "[SolanaSync] DB empty & no incremental events — doing full fetch",
    );
    events = await fetchMemoHistory(walletAddress, { limit: 50 });
    newestSignature = events.length > 0 ? events[0].signature : newestSignature;
    console.log(`[SolanaSync] Full fetch returned ${events.length} events`);
  }

  const chainRefs = replayMemoLog(events);
  console.log(`[SolanaSync] Chain refs after replay: ${chainRefs.size}`);

  // Noise resistance: only accept valid OSIS refs
  const validRefs = new Set(
    [...chainRefs].filter((ref) => isValidOsisRef(ref)),
  );
  const rejected = chainRefs.size - validRefs.size;
  if (rejected > 0) {
    console.log(`[SolanaSync] Rejected ${rejected} invalid/malformed refs`);
  }
  console.log(`[SolanaSync] Valid refs to consider: ${validRefs.size}`);

  let added = 0;
  let skippedArchived = 0;
  let skippedExisting = 0;
  for (const ref of validRefs) {
    if (localRefs.has(ref)) {
      skippedExisting++;
      continue;
    }
    const existing = await findScriptureBlockByCanonicalRef(ref);
    if (existing) {
      skippedExisting++;
      continue;
    }

    // Check if this passage was previously archived (user deleted it)
    const archived = await findAnyBlockByCanonicalRef(ref);
    if (archived?.archived_at) {
      skippedArchived++;
      continue;
    }

    const resolved = await resolvePassage(ref, "BSB");
    await createBlock({
      type: "scripture",
      content: resolved?.verses.map((v) => v.text).join(" ") ?? "",
      scripture_ref: ref,
      scripture_display_ref: displayRefFromOsis(ref),
      scripture_translation: "BSB",
      scripture_verses: resolved?.verses ?? [],
      source: "memo-sync",
      tags: [],
    });
    added++;
  }

  console.log(
    `[SolanaSync] Results — added: ${added}, skippedExisting: ${skippedExisting}, skippedArchived: ${skippedArchived}`,
  );

  if (added > 0) {
    invalidateClientKindlingIdsCache();
  }

  // Persist cursor so next sync is incremental
  storeMemoSyncCursor(walletAddress, newestSignature);
  // Drop any legacy global cursor from older builds
  try {
    localStorage.removeItem("kindled.solana.lastMemoSig");
  } catch {
    /* ignore */
  }

  return { added, removed: 0, newestSignature };
}
