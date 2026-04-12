import { createSignal } from "solid-js";
import { updateBlockContent, incrementNotes, getBlock } from "../db";
import { IconArrowLeft, IconCheck } from "../ui/Icons";
import styles from "./NoteCapture.module.css";

export function NoteCapture(props: {
  blockId: string;
  displayRef: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  const handleSave = async () => {
    if (!text().trim()) {
      props.onBack();
      return;
    }
    setSaving(true);
    try {
      const block = await getBlock(props.blockId);
      if (block) {
        const existing = block.content;
        const note = `\n\n[${new Date().toLocaleDateString()}] ${text().trim()}`;
        await updateBlockContent(block.id, existing + note);
        await incrementNotes(block.id);
      }
      props.onSaved();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div class={styles.view}>
      <div class={styles.header}>
        <button class={styles.backBtn} onClick={props.onBack}>
          <IconArrowLeft size={20} />
        </button>
        <h1 class={styles.title}>Reflection on {props.displayRef}</h1>
        <div style={{ width: "20px" }} />
      </div>

      <div class={styles.body}>
        <textarea
          placeholder="What is the Lord showing you in this passage?"
          value={text()}
          onInput={(e) => setText(e.currentTarget.value)}
          class={styles.textarea}
          rows={6}
        />
        <p class={styles.hint}>
          Use [[double brackets]] to link to people, places, or themes.
        </p>
        <button
          class={styles.saveBtn}
          onClick={handleSave}
          disabled={saving()}
        >
          <IconCheck size={16} /> {saving() ? "Saving..." : "Save Reflection"}
        </button>
      </div>
    </div>
  );
}
