import "@supabase/functions-js/edge-runtime.d.ts";
import { requireUser } from "../_shared/auth.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { createSessionDatabaseToken, ensureUserVault, recordDeviceHeartbeat } from "../_shared/vault.ts";

interface SyncConfigRequest {
  deviceId?: string;
  platform?: string;
  appVersion?: string;
  lastSyncAt?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await requireUser(req);
    const body = req.method === "POST"
      ? ((await req.json().catch(() => ({}))) as SyncConfigRequest)
      : {};
    const appVersion = body.appVersion ?? req.headers.get("x-kindled-version");
    const vault = await ensureUserVault(user.id, appVersion);
    const authToken = await createSessionDatabaseToken(vault.turso_database_name);

    await recordDeviceHeartbeat({
      userId: user.id,
      deviceId: body.deviceId ?? null,
      platform: body.platform ?? null,
      appVersion: appVersion ?? null,
      lastSyncAt: body.lastSyncAt ?? null,
    });

    return json({
      databaseName: vault.turso_database_name,
      url: vault.turso_primary_url,
      authToken,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
});
