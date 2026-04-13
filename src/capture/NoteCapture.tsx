import { createSignal } from "solid-js";
import { updateBlockContent, incrementNotes, getBlock, createLink, createBlock } from "../db";
import { parseWikiLinks, getSurroundingContext } from "../links/WikiLinkParser";
import { findOrCreateEntity } from "../links/EntityResolver";
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
        const noteText = text().trim();
        const existing = block.content;
        const note = `\n\n[${new Date().toLocaleDateString()}] ${noteText}`;
        await updateBlockContent(block.id, existing + note);
        await incrementNotes(block.id);

        // Process [[wiki links]] → create entities + links
        const parsed = parseWikiLinks(noteText);
        for (const link of parsed) {
          const entity = await findOrCreateEntity(link.text);
          // Create a block for the entity if it doesn't have one
          const entityBlockId = `ent_blk_${entity.id}`;
          const existingBlock = await getBlock(entityBlockId);
          if (!existingBlock) {
            await createBlock({
              id: entityBlockId,
              type: entity.type === "person" ? "person" : entity.type === "place" ? "place" : entity.type === "event" ? "event" : "theme",
              content: entity.description || entity.name,
              entity_type: entity.type,
              entity_id: entity.id,
              entity_name: entity.name,
              entity_aliases: entity.aliases,
              source: "auto",
              tags: [],
            });
          }
          const context = getSurroundingContext(noteText, link.text);
          await createLink({
            from_block: block.id,
            to_block: entityBlockId,
            link_text: link.text,
            context,
            is_entity_link: true,
          });
        }
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
