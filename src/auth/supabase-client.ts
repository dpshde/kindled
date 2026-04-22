import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return !!SUPABASE_URL && !!SUPABASE_PUBLISHABLE_KEY;
}

export function getSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
  }

  if (!client) {
    client = createClient(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "kindled.supabase.auth",
      },
    });
  }

  return client;
}

export function getSupabaseUrl(): string | null {
  return SUPABASE_URL ?? null;
}
