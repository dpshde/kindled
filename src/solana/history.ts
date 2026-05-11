import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL =
  import.meta.env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const MEMO_REGEX = /RB1:(save|del):(\S+)/;
const LEGACY_JSON_REGEX = /kindled-soul\/memo-v1:(\{.*\})/;
const LAST_SYNC_SIG_PREFIX = "kindled.solana.lastMemoSig:";

interface LegacyMemoPayload {
  v?: number;
  kind?: string;
  action?: string;
  osisRef?: string;
}

function parseMemo(
  raw: string,
): { action: "save" | "del"; osisRef: string } | null {
  const m = MEMO_REGEX.exec(raw);
  if (m) return { action: m[1] as "save" | "del", osisRef: m[2] };

  const legacy = LEGACY_JSON_REGEX.exec(raw);
  if (legacy) {
    try {
      const payload = JSON.parse(legacy[1]) as LegacyMemoPayload;
      if (payload.kind === "passage" && payload.osisRef) {
        const action: "save" | "del" =
          payload.action === "delete" ? "del" : "save";
        return { action, osisRef: payload.osisRef };
      }
    } catch {
      /* ignore malformed legacy memo */
    }
  }
  return null;
}

function cursorKey(walletAddress: string): string {
  return `${LAST_SYNC_SIG_PREFIX}${walletAddress}`;
}

function getConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

export interface MemoEvent {
  signature: string;
  slot: number;
  memo: string;
  action: "save" | "del";
  osisRef: string;
}

export async function fetchMemoHistory(
  walletAddress: string,
  options?: { before?: string; limit?: number },
): Promise<MemoEvent[]> {
  const connection = getConnection();
  const pubKey = new PublicKey(walletAddress);

  const signatures = await connection.getSignaturesForAddress(pubKey, {
    limit: options?.limit ?? 50,
    before: options?.before,
  });

  console.log(
    `[SolanaSync] Found ${signatures.length} signature(s) for ${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`,
  );

  const events: MemoEvent[] = [];
  for (const sigInfo of signatures) {
    if (sigInfo.err) continue;
    if (!sigInfo.memo) continue;

    // sigInfo.memo is formatted as "[len] memo_text" — supports RB1 and legacy JSON
    const parsed = parseMemo(sigInfo.memo);
    if (!parsed) continue;

    events.push({
      signature: sigInfo.signature,
      slot: sigInfo.slot,
      memo: sigInfo.memo,
      action: parsed.action,
      osisRef: parsed.osisRef,
    });
  }

  console.log(`[SolanaSync] Parsed ${events.length} memo event(s)`);
  return events;
}

export function replayMemoLog(events: MemoEvent[]): Set<string> {
  const saved = new Set<string>();
  // getSignaturesForAddress returns newest first; replay oldest → newest
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.action === "save") saved.add(event.osisRef);
    else if (event.action === "del") saved.delete(event.osisRef);
  }
  return saved;
}

/** Fetch only new memos since the last sync cursor (stored in localStorage). */
export async function fetchMemoHistoryIncremental(
  walletAddress: string,
): Promise<{ events: MemoEvent[]; newestSignature: string | null }> {
  const all = await fetchMemoHistory(walletAddress, { limit: 50 });
  const lastSig = localStorage.getItem(cursorKey(walletAddress));

  if (!lastSig || all.length === 0) {
    return {
      events: all,
      newestSignature: all.length > 0 ? all[0].signature : null,
    };
  }

  const lastIndex = all.findIndex((e) => e.signature === lastSig);
  if (lastIndex === -1) {
    // Last synced signature fell out of the 50-window.
    // Process what we got; caller may want to paginate deeper.
    return {
      events: all,
      newestSignature: all[0].signature,
    };
  }

  // all[0] is newest. Slice up to (but not including) lastIndex gives the new ones.
  const fresh = all.slice(0, lastIndex);
  return {
    events: fresh,
    newestSignature: all[0].signature,
  };
}

export function storeMemoSyncCursor(
  walletAddress: string,
  signature: string | null,
): void {
  if (signature) {
    localStorage.setItem(cursorKey(walletAddress), signature);
  }
}

export function clearMemoSyncCursor(walletAddress: string): void {
  localStorage.removeItem(cursorKey(walletAddress));
}
