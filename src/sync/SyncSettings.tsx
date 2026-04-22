/**
 * Sync settings popover — attach/detach a local JSON file for cross-device sync.
 */

import {
  createSignal,
  type JSX,
} from "solid-js";
import {
  attachFile,
  createFile,
  detachFile,
  getSyncState,
  grantPermission,
  onSyncStateChange,
  type SyncState,
} from "../sync/file-sync";
import { isTauriRuntime } from "./tauri-file-store";
import { IconFileCloud, IconCheck, IconPlus, IconX } from "../ui/icons/icons";
import { ICON_PX } from "../ui/icon-sizes";
import { hapticLight, hapticMedium, hapticWarning } from "../haptics";
import styles from "./SyncSettings.module.css";

export function SyncSettingsView(props: {
  onClose: () => void;
  onSynced: () => void;
}): JSX.Element {
  const [sync, setSync] = createSignal<SyncState>(getSyncState());
  const [error, setError] = createSignal<string | null>(null);

  const unsub = onSyncStateChange((s) => {
    setSync({ ...s });
  });

  function close() {
    unsub();
    hapticLight();
    props.onClose();
  }

  return (
    <div class={styles.overlay} onClick={close} role="dialog" aria-label="Sync settings">
      <div class={styles.panel} onClick={(e) => e.stopPropagation()}>
        <header class={styles.header}>
          <div class={styles.headerTitle}>
            <IconFileCloud size={ICON_PX.inline} /> Sync
          </div>
          <button type="button" class={styles.closeBtn} onClick={close} aria-label="Close">
            <IconX size={ICON_PX.inline} />
          </button>
        </header>

        <div class={styles.body}>
          <SyncStatus sync={sync()} />
          <SyncActions
            sync={sync()}
            error={error()}
            setError={setError}
            setSync={setSync}
            onClose={props.onClose}
            onSynced={props.onSynced}
          />
          {error() && <p class={styles.error}>{error()}</p>}
        </div>
      </div>
    </div>
  );
}

function SyncStatus(props: { sync: SyncState }): JSX.Element {
  const s = props.sync;

  if (s.status === "unsupported") {
    return (
      <p class={styles.hint}>
        Your browser doesn't support local file sync. Try Chrome or Edge on desktop.
      </p>
    );
  }

  if (s.status === "idle") {
    const hint = isTauriRuntime()
      ? "Choose a sync file in shared storage (like iCloud Drive or Files) so this device can stay in sync with your others."
      : "Attach a local file (e.g. on iCloud Drive) to sync your data across devices. All your blocks, reflections, and life stages will be kept in that file.";
    return <p class={styles.hint}>{hint}</p>;
  }

  const statusLine =
    s.status === "attached" ? (
      <span class={styles.statusOk}>
        <IconCheck size={ICON_PX.inline} /> {s.fileName}
      </span>
    ) : (
      <span class={styles.statusWarn}>
        Permission needed for {s.fileName}
      </span>
    );

  const lastSync = s.lastSyncedAt ? (
    <span class={styles.lastSync}>
      Last synced {formatRelative(s.lastSyncedAt)}
    </span>
  ) : (
    <></>
  );

  return (
    <div class={styles.statusBlock}>
      {statusLine}
      {lastSync}
    </div>
  );
}

function SyncActions(props: {
  sync: SyncState;
  error: string | null;
  setError: (v: string | null) => void;
  setSync: (v: SyncState) => void;
  onClose: () => void;
  onSynced: () => void;
}): JSX.Element {
  const s = props.sync;

  async function handleAttach() {
    hapticLight();
    props.setError(null);
    try {
      const result = await attachFile();
      props.setSync({ ...result });
      if (result.status === "attached") {
        props.onSynced();
      }
    } catch (e) {
      props.setError(e instanceof Error ? e.message : "Failed to attach file");
    }
  }

  async function handleCreate() {
    hapticMedium();
    props.setError(null);
    try {
      const result = await createFile();
      props.setSync({ ...result });
    } catch (e) {
      props.setError(e instanceof Error ? e.message : "Failed to create file");
    }
  }

  async function handleGrantPermission() {
    props.setError(null);
    try {
      const result = await grantPermission();
      props.setSync({ ...result });
    } catch (e) {
      props.setError(e instanceof Error ? e.message : "Permission denied");
    }
  }

  async function handleDetach() {
    hapticWarning();
    props.setError(null);
    try {
      await detachFile();
      props.setSync({ ...getSyncState() });
    } catch (e) {
      props.setError(e instanceof Error ? e.message : "Detach failed");
    }
  }

  if (s.status === "unsupported") {
    return <></>;
  }

  if (s.status === "idle") {
    return (
      <div class={styles.actionsRow}>
        <button type="button" class={styles.actionBtn} onClick={() => void handleCreate()}>
          <IconPlus size={ICON_PX.inline} /> Create File
        </button>
        <button type="button" class={styles.actionBtn} onClick={() => void handleAttach()}>
          <IconFileCloud size={ICON_PX.inline} /> Browse for File
        </button>
      </div>
    );
  }

  if (s.status === "needs-permission") {
    return (
      <button type="button" class={styles.actionBtn} onClick={() => void handleGrantPermission()}>
        Grant Permission
      </button>
    );
  }

  return (
    <button type="button" class={styles.detachBtn} onClick={() => void handleDetach()}>
      Detach
    </button>
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
