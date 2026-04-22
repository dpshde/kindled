import {
  Show,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
} from "solid-js";
import {
  invalidateClientKindlingIdsCache,
  saveScripturePassageFromCapture,
  type Verse,
} from "../db";
import { hapticLight, hapticMedium } from "../haptics";
import passageStyles from "../hearth/PassageView.module.css";
import { isTauriRuntime } from "../sync/tauri-file-store";
import shell from "../ui/app-shell.module.css";
import { ICON_PX } from "../ui/icon-sizes";
import {
  IconArrowSquareUpRight,
  IconCopy,
  IconFire,
  IconPlus,
} from "../ui/icons/icons";
import {
  resolvePassage,
  routeBibleHandoffUrl,
  type ResolvedPassage,
} from "../scripture/RouteBibleClient";
import styles from "./ShareView.module.css";

type ShareStatus = "resolving" | "ready" | "saving" | "error";

export function ShareView(props: {
  initialRef: string;
  onNavigateHome: () => void;
  onSaved: (passageId: string) => void;
}): JSX.Element {
  const [status, setStatus] = createSignal<ShareStatus>("resolving");
  const [passage, setPassage] = createSignal<ResolvedPassage | null>(null);
  const [errorMsg, setErrorMsg] = createSignal("");
  const [copied, setCopied] = createSignal(false);

  let resolveSeq = 0;

  createEffect(() => {
    const ref = props.initialRef.trim();
    const seq = ++resolveSeq;
    setPassage(null);
    setErrorMsg("");

    if (!ref) {
      setStatus("error");
      setErrorMsg("No passage reference was provided.");
      return;
    }

    setStatus("resolving");
    void resolvePassage(ref)
      .then((resolved) => {
        if (seq !== resolveSeq) return;
        if (!resolved) {
          setStatus("error");
          setErrorMsg(`Could not resolve "${ref}".`);
          return;
        }
        if (resolved.verses.length === 0) {
          setStatus("error");
          setErrorMsg(`No verse text was available for ${resolved.displayRef}.`);
          return;
        }
        setPassage(resolved);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (seq !== resolveSeq) return;
        setStatus("error");
        setErrorMsg(error instanceof Error ? error.message : "Could not load passage.");
      });
  });

  const handoffUrl = createMemo(() => {
    const resolved = passage();
    if (!resolved) return null;
    return routeBibleHandoffUrl({
      scripture_ref: resolved.ref,
      scripture_display_ref: resolved.displayRef,
      scripture_translation: resolved.translation,
    });
  });

  async function openRouteBible(url: string) {
    hapticLight();
    if (isTauriRuntime()) {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  function passageShareText(): string {
    const p = passage();
    if (!p) return "";
    const ref = p.displayRef;
    const text = p.verses.map((v) => v.text).join(" ");
    return `${ref}\n${text}`;
  }

  async function handleCopy() {
    const text = passageShareText();
    if (!text) return;
    hapticLight();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard not available */
    }
  }

  async function handleSave() {
    const resolved = passage();
    if (!resolved || status() === "saving") return;

    hapticMedium();
    setErrorMsg("");
    setStatus("saving");

    try {
      const saved = await saveScripturePassageFromCapture({
        content: versesToContent(resolved.verses),
        scripture_ref: resolved.ref,
        scripture_display_ref: resolved.displayRef,
        scripture_translation: resolved.translation,
        scripture_verses: resolved.verses,
        source: "manual",
        tags: [],
      });
      invalidateClientKindlingIdsCache();
      props.onSaved(saved.blockId);
    } catch (error) {
      setStatus("ready");
      setErrorMsg(error instanceof Error ? error.message : "Could not add this passage.");
    }
  }

  return (
    <div class={shell.view}>
      <div class={shell.shell}>
        <header class={shell.header}>
          <div class={shell.headerNav}>
            <button
              type="button"
              class={shell.logoBtn}
              onClick={() => {
                hapticLight();
                props.onNavigateHome();
              }}
              aria-label="Home"
            >
              <IconFire size={ICON_PX.header} />
            </button>
          </div>
          <div class={shell.headerCenter}>
            <h1 class={shell.headerTitle}>Share</h1>
          </div>
          <div class={shell.headerActions}>
            <Show when={passage()}>
              <button
                type="button"
                class={shell.headerBtn}
                onClick={() => void handleCopy()}
                aria-label="Copy passage"
                title="Copy passage"
              >
                <Show when={copied()} fallback={<IconCopy size={ICON_PX.header} />}>
                  <span class={styles.copiedCheck}>✓</span>
                </Show>
              </button>
            </Show>
          </div>
        </header>
        <div class={shell.main}>
          <Show
            when={passage() && status() !== "error"}
            fallback={<ShareState status={status()} errorMsg={errorMsg()} />}
          >
            <ShareReady
              passage={passage()!}
              handoffUrl={handoffUrl()}
              status={status()}
              errorMsg={errorMsg()}
              onOpenRouteBible={openRouteBible}
              onSave={() => void handleSave()}
            />
          </Show>
        </div>
      </div>
    </div>
  );
}

function ShareReady(props: {
  passage: ResolvedPassage;
  handoffUrl: string | null;
  status: ShareStatus;
  errorMsg: string;
  onOpenRouteBible: (url: string) => Promise<void>;
  onSave: () => void;
}): JSX.Element {
  return (
    <div class={styles.shareContent}>
      <div class={styles.reading}>
        <div class={passageStyles.refHead}>
          <h2 class={passageStyles.ref}>{props.passage.displayRef}</h2>
          <span class={passageStyles.translation}>{props.passage.translation}</span>
        </div>
        <div class={styles.textBlock}>
          {props.passage.verses.map((verse) => (
            <p class={styles.verse}>
              <span class={styles.verseNum}>{verse.number}</span>
              <span class={styles.verseText}>{verse.text}</span>
            </p>
          ))}
        </div>
      </div>

      <div class={styles.actions}>
        <button
          type="button"
          class={styles.primaryBtn}
          onClick={props.onSave}
          disabled={props.status === "saving"}
        >
          <IconPlus size={18} />
          <span>{props.status === "saving" ? "Adding…" : "Add to hearth"}</span>
        </button>
        <Show when={props.handoffUrl}>
          <button
            type="button"
            class={styles.contextBtn}
            onClick={() => void props.onOpenRouteBible(props.handoffUrl!)}
          >
            <IconArrowSquareUpRight size={ICON_PX.inline} />
            <span>Open on route.bible</span>
          </button>
        </Show>
        <Show when={props.errorMsg}>
          <p class={styles.inlineError}>{props.errorMsg}</p>
        </Show>
      </div>
    </div>
  );
}

function ShareState(props: {
  status: ShareStatus;
  errorMsg: string;
}): JSX.Element {
  return (
    <div class={`${shell.shellContent} ${styles.stateShell}`}>
      <div class={styles.stateCard}>
        <Show
          when={props.status === "error"}
          fallback={<p class={styles.stateText}>Loading passage…</p>}
        >
          <>
            <h2 class={styles.stateTitle}>Couldn't load that passage</h2>
            <p class={styles.stateText}>{props.errorMsg || "Try again from route.bible."}</p>
          </>
        </Show>
      </div>
    </div>
  );
}

function versesToContent(verses: Verse[]): string {
  return verses.map((verse) => verse.text).join(" ");
}
