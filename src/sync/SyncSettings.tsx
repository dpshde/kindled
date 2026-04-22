import { createSignal, onCleanup, type JSX } from "solid-js";
import {
  getSyncState,
  onSyncStateChange,
  requestEmailCode,
  signOutHostedSync,
  syncNow,
  type SyncState,
  verifyEmailCode,
} from "./hosted-sync";
import { isSupabaseConfigured } from "../auth/supabase-client";
import { IconCheck, IconFileCloud, IconPlus, IconUser, IconX } from "../ui/icons/icons";
import { ICON_PX } from "../ui/icon-sizes";
import { hapticLight, hapticMedium, hapticWarning } from "../haptics";
import styles from "./SyncSettings.module.css";

type BusyAction = "send" | "verify" | "signout" | null;

function isSignedIn(status: SyncState["status"]): boolean {
  return (
    status === "provisioning" ||
    status === "syncing" ||
    status === "connected" ||
    status === "offline-pending" ||
    status === "error"
  );
}

function statusLabel(sync: SyncState): string {
  switch (sync.status) {
    case "provisioning":
      return "Preparing your vault";
    case "syncing":
      return "Syncing in the background";
    case "offline-pending":
      return "Changes will sync when you're back online";
    case "error":
      return "Sync hit a problem";
    case "connected":
      return "Connected";
    default:
      return "Sign in";
  }
}

export function SyncSettingsView(props: {
  onClose: () => void;
  onSynced: () => void;
}): JSX.Element {
  const initial = getSyncState();
  const [sync, setSync] = createSignal<SyncState>(initial);
  const [email, setEmail] = createSignal(initial.email ?? "");
  const [code, setCode] = createSignal("");
  const [busy, setBusy] = createSignal<BusyAction>(null);
  const [localMessage, setLocalMessage] = createSignal<string | null>(null);
  const [localError, setLocalError] = createSignal<string | null>(null);

  const unsub = onSyncStateChange((next) => {
    setSync({ ...next });
    if (next.email) setEmail(next.email);
  });
  onCleanup(() => unsub());

  function close() {
    hapticLight();
    props.onClose();
  }

  function clearFeedback() {
    setLocalError(null);
    setLocalMessage(null);
  }

  async function handleSendCode() {
    hapticLight();
    setBusy("send");
    clearFeedback();
    try {
      await requestEmailCode(email().trim());
      setLocalMessage(`We sent a 6-digit code to ${email().trim()}.`);
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Could not send sign-in code.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleVerify() {
    hapticMedium();
    setBusy("verify");
    clearFeedback();
    try {
      await verifyEmailCode(code().trim(), email().trim());
      setLocalMessage("Code accepted. Finishing sync setup…");
      await syncNow();
      setCode("");
      props.onSynced();
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Could not verify that code.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function handleSignOut() {
    hapticWarning();
    setBusy("signout");
    clearFeedback();
    try {
      await signOutHostedSync();
      setCode("");
      setLocalMessage(null);
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Could not sign out.",
      );
    } finally {
      setBusy(null);
    }
  }

  const detail = () => localError() ?? localMessage() ?? sync().error;

  return (
    <div class={styles.overlay} onClick={close} role="dialog" aria-label="Sync settings">
      <div class={styles.panel} onClick={(event) => event.stopPropagation()}>
        <header class={styles.header}>
          <div class={styles.headerTitle}>
            <IconFileCloud size={ICON_PX.inline} /> Sync
          </div>
          <button type="button" class={styles.closeBtn} onClick={close} aria-label="Close">
            <IconX size={ICON_PX.inline} />
          </button>
        </header>

        <div class={styles.body}>
          {!isSupabaseConfigured() || sync().status === "disabled" ? (
            <p class={styles.hint}>
              Hosted sync isn't configured in this build yet. Set the Supabase public URL and publishable key to enable account sync.
            </p>
          ) : !isSignedIn(sync().status) ? (
            <>
              <div class={styles.statusBlock}>
                <p class={styles.hint}>
                  Sign in with your email to keep Kindled synced across devices. Hosted sync is automatic after sign-in.
                </p>
                <div class={styles.callout}>
                  1. Enter your email and send a code. 2. Paste the 6-digit code below. You never need to wait for the UI to advance.
                </div>
                {detail() && <span class={styles.statusMeta}>{detail()}</span>}
              </div>

              <div class={styles.actionsRow}>
                <label class={styles.field}>
                  <span class={styles.label}>Email</span>
                  <input
                    class={styles.input}
                    type="email"
                    placeholder="you@example.com"
                    value={email()}
                    onInput={(event) => setEmail(event.currentTarget.value)}
                  />
                </label>

                <button
                  type="button"
                  class={styles.actionBtn}
                  onClick={() => void handleSendCode()}
                  disabled={!email().trim() || busy() === "send"}
                >
                  <IconPlus size={ICON_PX.inline} />
                  {busy() === "send" ? "Sending code…" : "Email me a code"}
                </button>

                <label class={styles.field}>
                  <span class={styles.label}>6-digit code</span>
                  <input
                    class={styles.input}
                    type="text"
                    inputMode="numeric"
                    autocomplete="one-time-code"
                    placeholder="123456"
                    value={code()}
                    onInput={(event) => setCode(event.currentTarget.value)}
                  />
                </label>

                <button
                  type="button"
                  class={styles.actionBtn}
                  onClick={() => void handleVerify()}
                  disabled={!email().trim() || !code().trim() || busy() === "verify"}
                >
                  <IconCheck size={ICON_PX.inline} />
                  {busy() === "verify" ? "Verifying…" : "Verify & sync"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div class={styles.statusBlock}>
                <span
                  class={
                    sync().status === "error"
                      ? styles.statusWarn
                      : sync().status === "offline-pending"
                        ? styles.statusPending
                        : styles.statusOk
                  }
                >
                  <IconCheck size={ICON_PX.inline} /> {statusLabel(sync())}
                </span>
                {sync().email && (
                  <span class={styles.accountLine}>
                    <IconUser size={ICON_PX.inline} /> {sync().email}
                  </span>
                )}
                {detail() && <span class={styles.statusMeta}>{detail()}</span>}
                {sync().lastSyncedAt && (
                  <span class={styles.lastSync}>Last synced {formatRelative(sync().lastSyncedAt!)}</span>
                )}
              </div>

              <div class={styles.actionsRow}>
                <button
                  type="button"
                  class={styles.secondaryBtn}
                  onClick={() => void handleSignOut()}
                  disabled={busy() === "signout"}
                >
                  {busy() === "signout" ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
