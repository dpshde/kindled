export const SCHEMA_VERSION = 3;

export const MIGRATIONS: Record<number, string[]> = {
  1: [
    `
CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('scripture', 'person', 'place', 'theme', 'event', 'note', 'image', 'pdf', 'link', 'audio')),
  content TEXT NOT NULL DEFAULT '',

  -- Scripture-specific
  scripture_ref TEXT,
  scripture_display_ref TEXT,
  scripture_translation TEXT,
  scripture_verses TEXT, -- JSON array of {number, text}

  -- Entity-specific
  entity_type TEXT CHECK(entity_type IN ('person', 'place', 'theme', 'event')),
  entity_id TEXT,
  entity_name TEXT,
  entity_aliases TEXT, -- JSON array of strings
  entity_description TEXT,

  -- Metadata
  source TEXT,
  captured_at TEXT NOT NULL DEFAULT (datetime('now')),
  modified_at TEXT NOT NULL DEFAULT (datetime('now')),
  tags TEXT NOT NULL DEFAULT '[]' -- JSON array of strings
);`,

    `
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('person', 'place', 'theme', 'event')),
  name TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]',
  description TEXT NOT NULL DEFAULT '',
  key_passages TEXT NOT NULL DEFAULT '[]',
  mentioned_in TEXT NOT NULL DEFAULT '[]',
  connected_entities TEXT NOT NULL DEFAULT '[]',
  familiarity INTEGER NOT NULL DEFAULT 0,
  last_studied TEXT,
  next_suggested TEXT
);`,

    `
CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  from_block TEXT NOT NULL,
  to_block TEXT NOT NULL,
  link_text TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_entity_link INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (from_block) REFERENCES blocks(id) ON DELETE CASCADE,
  FOREIGN KEY (to_block) REFERENCES blocks(id) ON DELETE CASCADE
);`,

    `
CREATE TABLE IF NOT EXISTS life_stages (
  block_id TEXT PRIMARY KEY,
  stage TEXT NOT NULL DEFAULT 'spark' CHECK(stage IN ('spark', 'flame', 'steady', 'ember')),
  kindled_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_reviewed TEXT,
  next_review_at TEXT NOT NULL DEFAULT (datetime('now')),
  review_count INTEGER NOT NULL DEFAULT 0,
  settledness INTEGER NOT NULL DEFAULT 0,
  linger_seconds REAL NOT NULL DEFAULT 0,
  notes_added INTEGER NOT NULL DEFAULT 0,
  connections_made INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
);`,

    `
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`,

    `CREATE INDEX IF NOT EXISTS idx_blocks_type ON blocks(type);`,
    `CREATE INDEX IF NOT EXISTS idx_blocks_scripture_ref ON blocks(scripture_ref);`,
    `CREATE INDEX IF NOT EXISTS idx_blocks_entity_id ON blocks(entity_id);`,
    `CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);`,
    `CREATE INDEX IF NOT EXISTS idx_links_from ON links(from_block);`,
    `CREATE INDEX IF NOT EXISTS idx_links_to ON links(to_block);`,
    `CREATE INDEX IF NOT EXISTS idx_life_stages_stage ON life_stages(stage);`,
    `CREATE INDEX IF NOT EXISTS idx_life_stages_next_review_at ON life_stages(next_review_at);`,
  ],

  2: [
    `
CREATE TABLE IF NOT EXISTS reflections (
  id TEXT PRIMARY KEY,
  block_id TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
);`,
    `CREATE INDEX IF NOT EXISTS idx_reflections_block ON reflections(block_id);`,
    `CREATE INDEX IF NOT EXISTS idx_reflections_modified ON reflections(modified_at DESC);`,
    `ALTER TABLE links ADD COLUMN reflection_id TEXT;`,
  ],

  /** Bump only — life_stages shape is defined in migration 1 (fresh DBs). Use a new SQLite file name to reset local data. */
  3: [],
};

export function allMigrations(): string[] {
  const versions = Object.keys(MIGRATIONS).map(Number).sort((a, b) => a - b);
  return versions.flatMap((v) => MIGRATIONS[v]);
}
