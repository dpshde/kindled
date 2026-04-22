import { createClient } from "npm:@supabase/supabase-js@2";

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

export function createAdminClient() {
  return createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false },
    },
  );
}

export async function requireUser(req: Request): Promise<AuthenticatedUser> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) throw new Error("Missing bearer token.");

  const supabase = createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error(error?.message ?? "Could not authenticate user.");
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
  };
}
