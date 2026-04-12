import { createSignal } from "solid-js";
import { createBlock } from "../db";
import { resolvePassage } from "../scripture/RouteBibleClient";
import { parseRef } from "../scripture/RefNormalizer";
import { IconArrowLeft, IconBookOpen, IconCheck, IconWarning } from "../ui/Icons";
import styles from "./ScriptureCapture.module.css";

export function ScriptureCapture(props: {
  onBack: () => void;
  onSaved: () => void;
}) {
  const [input, setInput] = createSignal("");
  const [status, setStatus] = createSignal<"idle" | "resolving" | "preview" | "saving" | "saved" | "error">("idle");
  const [preview, setPreview] = createSignal<{
    displayRef: string;
    translation: string;
    text: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = createSignal("");

  const handleResolve = async () => {
    const val = input().trim();
    if (!val) return;

    const parsed = parseRef(val);
    if (!parsed) {
      setStatus("error");
      setErrorMsg(`Could not parse "${val}" as a Bible reference.`);
      return;
    }

    setStatus("resolving");
    try {
      const passage = await resolvePassage(val);
      if (!passage) {
        setStatus("error");
        setErrorMsg("Could not resolve that passage.");
        return;
      }
      setPreview({
        displayRef: passage.displayRef,
        translation: passage.translation,
        text: passage.verses.map((v) => v.text).join(" "),
      });
      setStatus("preview");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Network error");
    }
  };

  const handleSave = async () => {
    const val = input().trim();
    const parsed = parseRef(val);
    if (!parsed || !preview()) return;

    setStatus("saving");
    try {
      const passage = await resolvePassage(val);
      await createBlock({
        type: "scripture",
        content: preview()!.text,
        scripture_ref: parsed.canonical,
        scripture_display_ref: preview()!.displayRef,
        scripture_translation: preview()!.translation,
        scripture_verses: passage?.verses ?? [],
        source: "manual",
        tags: [],
      });
      setStatus("saved");
      setTimeout(() => props.onSaved(), 800);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed to save");
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && status() === "idle") {
      handleResolve();
    }
  };

  return (
    <div class={styles.view}>
      <div class={styles.header}>
        <button class={styles.backBtn} onClick={props.onBack}>
          <IconArrowLeft size={20} />
        </button>
        <h1 class={styles.title}>Capture Passage</h1>
        <div style={{ width: "20px" }} />
      </div>

      <div class={styles.body}>
        <div class={styles.inputGroup}>
          <span class={styles.inputIcon}>
            <IconBookOpen size={16} />
          </span>
          <input
            type="text"
            placeholder="John 3:16, Psalm 23:1-6..."
            value={input()}
            onInput={(e) => {
              setInput(e.currentTarget.value);
              if (status() === "error") setStatus("idle");
            }}
            onKeyDown={handleKeyDown}
            class={styles.input}
            disabled={status() === "resolving" || status() === "saving"}
          />
        </div>

        {status() === "idle" && (
          <button class={styles.resolveBtn} onClick={handleResolve}>
            Resolve Passage
          </button>
        )}

        {status() === "resolving" && (
          <p class={styles.status}>Resolving...</p>
        )}

        {status() === "preview" && preview() && (
          <div class={styles.preview}>
            <h3 class={styles.previewRef}>{preview()!.displayRef}</h3>
            <span class={styles.previewTrans}>{preview()!.translation}</span>
            <p class={styles.previewText}>
              {preview()!.text.slice(0, 300)}
              {preview()!.text.length > 300 ? "..." : ""}
            </p>
            <button class={styles.saveBtn} onClick={handleSave}>
              <IconCheck size={16} /> Plant Seed
            </button>
          </div>
        )}

        {status() === "saving" && (
          <p class={styles.status}>Planting...</p>
        )}

        {status() === "saved" && (
          <div class={styles.saved}>
            <IconCheck size={24} />
            <p>Seed planted in your garden.</p>
          </div>
        )}

        {status() === "error" && (
          <div class={styles.error}>
            <IconWarning size={16} />
            <p>{errorMsg()}</p>
          </div>
        )}
      </div>
    </div>
  );
}
