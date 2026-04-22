import "@supabase/functions-js/edge-runtime.d.ts";
import { requireUser } from "../_shared/auth.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { ensureUserVault } from "../_shared/vault.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const user = await requireUser(req);
    const appVersion = req.headers.get("x-kindled-version");
    const vault = await ensureUserVault(user.id, appVersion);
    return json({
      databaseName: vault.turso_database_name,
      url: vault.turso_primary_url,
      provisionedAt: vault.provisioned_at,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
});
