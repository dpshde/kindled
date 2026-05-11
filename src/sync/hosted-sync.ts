import type { Client } from "@libsql/client/web";
import type { Session } from "@supabase/supabase-js";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "../auth/supabase-client";
import {
  getCurrentSession,
  initSessionStore,
  onSessionChange,
  sendEmailOtp,
  signOutSession,
  verifyEmailOtp,
} from "../auth/session-store";
import { onLocalDatabaseChange } from "./local-change-bus";
import {
  ensureRemoteSchema,
  createRemoteVaultClient,
  loadRemoteSnapshot,
  replaceRemoteSnapshot,
  type VaultSyncConfig,
} from "./remote-vault";
import {
  applySnapshotToLocal,
  loadLocalSnapshot,
  mergeSnapshots,
  snapshotChecksum,
} from "./snapshot";

// Temporarily disabled in favor of Solana memo-based sync.
const HOSTED_SYNC_ENABLED = false;

export function isHostedSyncEnabled(): boolean {
  return HOSTED_SYNC_ENABLED;
}

export type SyncStatus =
  | "disabled"
  | "signed-out"
  | "sending-code"
  | "awaiting-code"
  | "verifying"
  | "provisioning"
  | "syncing"
  | "connected"
  | "offline-pending"
  | "error";

export interface SyncState {
  status: SyncStatus;
  email: string | null;
  lastSyncedAt: string | null;
  syncing: boolean;
  dirty: boolean;
  error: string | null;
}

interface SyncConfigResponse {
  databaseName: string;
  url: string;
  authToken: string;
}

function appVersion(): string {
  return import.meta.env.VITE_APP_VERSION ?? "dev";
}

function deviceId(): string {
  const key = "kindled.device_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = crypto.randomUUID();
  localStorage.setItem(key, next);
  return next;
}

function currentPlatform(): string {
  return document.documentElement.dataset.platform ?? "web";
}

const listeners = new Set<(state: SyncState) => void>();
const dataAppliedListeners = new Set<() => void>();

let snapshot: SyncState = {
  status: isSupabaseConfigured() ? "signed-out" : "disabled",
  email: null,
  lastSyncedAt: null,
  syncing: false,
  dirty: false,
  error: null,
};
let initPromise: Promise<void> | null = null;
let pendingEmail: string | null = null;
let syncPromise: Promise<void> | null = null;
let syncTimer: ReturnType<typeof setTimeout> | undefined;
let remoteClient: Client | null = null;
let remoteUserId: string | null = null;

function emit(update: Partial<SyncState>): void {
  snapshot = { ...snapshot, ...update };
  for (const listener of listeners) listener({ ...snapshot });
}

function emitDataApplied(): void {
  for (const listener of dataAppliedListeners) listener();
}

function currentEmail(session: Session | null): string | null {
  return session?.user.email ?? pendingEmail ?? null;
}

function clearRemoteClient(): void {
  remoteClient?.close();
  remoteClient = null;
  remoteUserId = null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hasNetworkError(error: unknown): boolean {
  const message = errorMessage(error);
  return /fetch|network|connection|timed out|offline/i.test(message);
}

function isOtpResendCooldownError(error: unknown): boolean {
  return /only request this after|security purposes|rate limit|wait/i.test(
    errorMessage(error),
  );
}

function resetSignedOutState(): void {
  clearRemoteClient();
  pendingEmail = null;
  emit({
    status: isSupabaseConfigured() ? "signed-out" : "disabled",
    email: null,
    syncing: false,
    dirty: false,
    error: null,
  });
}

async function invokeFunction<T>(
  name: string,
  accessToken: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-kindled-version": appVersion(),
    },
  });
  if (error) throw error;
  return data as T;
}

async function ensureRemoteClient(session: Session): Promise<Client> {
  if (remoteClient && remoteUserId === session.user.id) return remoteClient;

  emit({
    status: "provisioning",
    email: currentEmail(session),
    error: null,
  });

  await invokeFunction("provision-vault", session.access_token, {});
  const config = await invokeFunction<SyncConfigResponse>(
    "get-sync-config",
    session.access_token,
    {
      deviceId: deviceId(),
      platform: currentPlatform(),
      appVersion: appVersion(),
      lastSyncAt: snapshot.lastSyncedAt,
    },
  );

  const nextClient = createRemoteVaultClient(config as VaultSyncConfig);
  await ensureRemoteSchema(nextClient);
  clearRemoteClient();
  remoteClient = nextClient;
  remoteUserId = session.user.id;
  return nextClient;
}

function scheduleSync(delayMs = 1500): void {
  if (!getCurrentSession()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void syncNow();
  }, delayMs);
}

export async function syncNow(): Promise<void> {
  const session = getCurrentSession();
  if (!HOSTED_SYNC_ENABLED || !session || !isSupabaseConfigured()) return;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    emit({
      status: "syncing",
      email: currentEmail(session),
      syncing: true,
      error: null,
    });

    const client = await ensureRemoteClient(session);
    const [local, remote] = await Promise.all([
      loadLocalSnapshot(),
      loadRemoteSnapshot(client),
    ]);
    const merged = mergeSnapshots(local, remote);
    const localStamp = snapshotChecksum(local);
    const mergedStamp = snapshotChecksum(merged);

    if (mergedStamp !== localStamp) {
      await applySnapshotToLocal(merged);
      emitDataApplied();
    }

    await replaceRemoteSnapshot(client, merged);

    emit({
      status: "connected",
      email: currentEmail(session),
      syncing: false,
      dirty: false,
      error: null,
      lastSyncedAt: new Date().toISOString(),
    });
  })()
    .catch((error) => {
      emit({
        status:
          hasNetworkError(error) || !navigator.onLine
            ? "offline-pending"
            : "error",
        email: currentEmail(session),
        syncing: false,
        dirty: true,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    })
    .finally(() => {
      syncPromise = null;
    });

  return syncPromise;
}

function bindWindowListeners(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("online", () => {
    if (getCurrentSession()) void syncNow();
  });
  window.addEventListener("focus", () => {
    if (
      getCurrentSession() &&
      (snapshot.dirty || snapshot.lastSyncedAt === null)
    ) {
      void syncNow();
    }
  });
}

function bindLocalWriteListener(): void {
  onLocalDatabaseChange(() => {
    if (!getCurrentSession()) return;
    emit({
      dirty: true,
      email: currentEmail(getCurrentSession()),
      status: snapshot.syncing ? "syncing" : "offline-pending",
    });
    scheduleSync();
  });
}

async function handleSession(session: Session | null): Promise<void> {
  if (!session) {
    if (pendingEmail) {
      emit({
        status: snapshot.status === "verifying" ? "verifying" : "awaiting-code",
        email: pendingEmail,
      });
      return;
    }

    resetSignedOutState();
    return;
  }

  emit({
    email: currentEmail(session),
    error: null,
    status:
      snapshot.status === "awaiting-code" || snapshot.status === "verifying"
        ? "provisioning"
        : snapshot.status,
  });

  await syncNow();
}

export async function initHostedSync(): Promise<void> {
  if (!HOSTED_SYNC_ENABLED || !isSupabaseConfigured()) {
    emit({
      status: "disabled",
      error: null,
      email: null,
      syncing: false,
      dirty: false,
    });
    return;
  }
  if (!initPromise) {
    bindLocalWriteListener();
    bindWindowListeners();
    onSessionChange((session) => {
      void handleSession(session);
    });
    initPromise = initSessionStore().then(async (session) => {
      if (session) {
        await handleSession(session);
      }
    });
  }
  return initPromise;
}

export async function requestEmailCode(email: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error("Hosted sync is not configured.");
  }
  const normalized = email.trim();
  pendingEmail = normalized;
  emit({ status: "sending-code", email: normalized, error: null });
  try {
    await sendEmailOtp(normalized);
    emit({ status: "awaiting-code", email: normalized, error: null });
  } catch (error) {
    const message = errorMessage(error);
    if (isOtpResendCooldownError(error)) {
      emit({
        status: "awaiting-code",
        email: normalized,
        error: message,
      });
      return;
    }
    pendingEmail = null;
    emit({
      status: "signed-out",
      email: normalized,
      error: message,
      syncing: false,
    });
    throw error;
  }
}

export async function verifyEmailCode(
  code: string,
  emailOverride?: string,
): Promise<void> {
  const email = emailOverride?.trim() || pendingEmail?.trim();
  if (!email) throw new Error("Enter your email first.");
  pendingEmail = email;
  emit({ status: "verifying", email, error: null });
  await verifyEmailOtp(email, code.trim());
  pendingEmail = null;
}

export async function signOutHostedSync(): Promise<void> {
  await signOutSession();
  resetSignedOutState();
}

export function getSyncState(): SyncState {
  return { ...snapshot };
}

export function onSyncStateChange(
  listener: (state: SyncState) => void,
): () => void {
  listeners.add(listener);
  listener({ ...snapshot });
  return () => listeners.delete(listener);
}

export function onSyncDataApplied(listener: () => void): () => void {
  dataAppliedListeners.add(listener);
  return () => dataAppliedListeners.delete(listener);
}
