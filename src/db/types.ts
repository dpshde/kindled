export type BlockType =
  | "scripture"
  | "person"
  | "place"
  | "theme"
  | "event"
  | "note"
  | "image"
  | "pdf"
  | "link"
  | "audio";

export type EntityType = "person" | "place" | "theme" | "event";

export type LifeStage = "spark" | "flame" | "steady" | "ember";

export interface Verse {
  number: number;
  text: string;
}

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  scripture_ref?: string;
  scripture_display_ref?: string;
  scripture_translation?: string;
  scripture_verses?: Verse[];
  entity_type?: EntityType;
  entity_id?: string;
  entity_name?: string;
  entity_aliases?: string[];
  entity_description?: string;
  source?: string;
  captured_at: string;
  modified_at: string;
  tags: string[];
}

export interface LifeStageRecord {
  block_id: string;
  stage: LifeStage;
  kindled_at: string;
  last_reviewed?: string;
  next_review_at: string;
  review_count: number;
  settledness: number;
  linger_seconds: number;
  notes_added: number;
  connections_made: number;
}

export interface Link {
  id: string;
  from_block: string;
  to_block: string;
  link_text: string;
  context: string;
  created_at: string;
  is_entity_link: boolean;
  /** When set, link was created from this reflection (passage block is still `from_block`). */
  reflection_id?: string | null;
}

export interface Reflection {
  id: string;
  block_id: string;
  body: string;
  created_at: string;
  modified_at: string;
}

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  aliases: string[];
  description: string;
  key_passages: string[];
  mentioned_in: string[];
  connected_entities: string[];
  familiarity: number;
  last_studied?: string;
  next_suggested?: string;
}
