import { createClient as createTursoClient } from "npm:@tursodatabase/api@2";
import { createAdminClient } from "./auth.ts";

export interface UserVaultRecord {
  user_id: string;
  turso_database_name: string;
  turso_primary_url: string;
  provisioned_at: string | null;
  last_seen_app_version: string | null;
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function vaultDatabaseName(userId: string): string {
  return `kindled-${userId.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 26)}`;
}

function createTurso() {
  return createTursoClient({
    org: requiredEnv("TURSO_ORG"),
    token: requiredEnv("TURSO_PLATFORM_TOKEN"),
  });
}

export async function ensureUserVault(userId: string, appVersion?: string | null): Promise<UserVaultRecord> {
  const admin = createAdminClient();
  const existing = await admin
    .from("user_vaults")
    .select("user_id, turso_database_name, turso_primary_url, provisioned_at, last_seen_app_version")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) {
    if (appVersion) {
      await admin
        .from("user_vaults")
        .update({ last_seen_app_version: appVersion })
        .eq("user_id", userId);
    }
    return existing.data as UserVaultRecord;
  }

  const turso = createTurso();
  const databaseName = vaultDatabaseName(userId);
  let hostname: string;
  try {
    const created = await turso.databases.create(databaseName, {
      group: Deno.env.get("TURSO_GROUP") ?? "default",
    });
    hostname = created.hostname;
  } catch (_error) {
    const existingDb = await turso.databases.get(databaseName);
    hostname = existingDb.hostname;
  }

  const now = new Date().toISOString();
  const record = {
    user_id: userId,
    turso_database_name: databaseName,
    turso_primary_url: `libsql://${hostname}`,
    provisioned_at: now,
    last_seen_app_version: appVersion ?? null,
  };

  const inserted = await admin
    .from("user_vaults")
    .upsert(record, { onConflict: "user_id" })
    .select("user_id, turso_database_name, turso_primary_url, provisioned_at, last_seen_app_version")
    .single();
  if (inserted.error) throw inserted.error;
  return inserted.data as UserVaultRecord;
}

export async function createSessionDatabaseToken(databaseName: string): Promise<string> {
  const turso = createTurso();
  const { jwt } = await turso.databases.createToken(databaseName, {
    expiration: "7d",
    authorization: "full-access",
  });
  return jwt;
}

export async function recordDeviceHeartbeat(params: {
  userId: string;
  deviceId?: string | null;
  platform?: string | null;
  appVersion?: string | null;
  lastSyncAt?: string | null;
}): Promise<void> {
  if (!params.deviceId) return;
  const admin = createAdminClient();
  const payload = {
    device_id: params.deviceId,
    user_id: params.userId,
    platform: params.platform ?? "unknown",
    app_version: params.appVersion ?? null,
    last_seen_at: new Date().toISOString(),
    last_sync_at: params.lastSyncAt ?? null,
  };
  const { error } = await admin.from("devices").upsert(payload, { onConflict: "device_id" });
  if (error) throw error;
}
