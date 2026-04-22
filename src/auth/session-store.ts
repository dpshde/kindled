import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client";

type SessionListener = (session: Session | null) => void;

const listeners = new Set<SessionListener>();
let currentSession: Session | null = null;
let initPromise: Promise<Session | null> | null = null;
let authSubBound = false;

function emit(session: Session | null): void {
  currentSession = session;
  for (const listener of listeners) listener(session);
}

function bindAuthListener(): void {
  if (authSubBound || !isSupabaseConfigured()) return;
  authSubBound = true;
  const supabase = getSupabaseClient();
  supabase.auth.onAuthStateChange((_event, session) => {
    emit(session);
  });
}

export async function initSessionStore(): Promise<Session | null> {
  if (!isSupabaseConfigured()) {
    emit(null);
    return null;
  }
  if (!initPromise) {
    const supabase = getSupabaseClient();
    bindAuthListener();
    initPromise = supabase.auth.getSession().then(({ data, error }) => {
      if (error) throw error;
      emit(data.session ?? null);
      return data.session ?? null;
    });
  }
  return initPromise;
}

export function getCurrentSession(): Session | null {
  return currentSession;
}

export function onSessionChange(listener: SessionListener): () => void {
  listeners.add(listener);
  listener(currentSession);
  return () => listeners.delete(listener);
}

export async function sendEmailOtp(email: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
}

export async function verifyEmailOtp(email: string, token: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) throw error;
}

export async function signOutSession(): Promise<void> {
  if (!isSupabaseConfigured()) {
    emit(null);
    return;
  }
  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  emit(null);
}
