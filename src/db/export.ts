import { getDb } from "./connection";
import { SCHEMA_VERSION } from "./schema";
import type { Block, Entity, LifeStageRecord, Link, Reflection } from "./types";
import { isTauriRuntime } from "../sync/tauri-file-store";

export interface KindledExport {
  format: "kindled";
  version: 1;
  exported_at: string;
  schema_version: number;
  counts: {
    blocks: number;
    entities: number;
    links: number;
    reflections: number;
    life_stages: number;
  };
  data: {
    blocks: Block[];
    entities: Entity[];
    links: Link[];
    reflections: Reflection[];
    life_stages: LifeStageRecord[];
  };
}

export async function exportAllData(): Promise<KindledExport> {
  const db = await getDb();

  const blockRows = await db.query<Record<string, string>>(
    `SELECT * FROM blocks ORDER BY captured_at ASC`,
  );
  const blocks = blockRows.map(blockFromRow);

  const entityRows = await db.query<Record<string, string>>(
    `SELECT * FROM entities ORDER BY name`,
  );
  const entities = entityRows.map(entityFromRow);

  const linkRows = await db.query<Record<string, string>>(
    `SELECT * FROM links ORDER BY created_at ASC`,
  );
  const links = linkRows.map(linkFromRow);

  const reflectionRows = await db.query<Record<string, string>>(
    `SELECT * FROM reflections ORDER BY created_at ASC`,
  );
  const reflections = reflectionRows.map(reflectionFromRow);

  const stageRows = await db.query<Record<string, string>>(
    `SELECT * FROM life_stages ORDER BY kindled_at ASC`,
  );
  const life_stages = stageRows.map(lifeStageFromRow);

  return {
    format: "kindled",
    version: 1,
    exported_at: new Date().toISOString(),
    schema_version: SCHEMA_VERSION,
    counts: {
      blocks: blocks.length,
      entities: entities.length,
      links: links.length,
      reflections: reflections.length,
      life_stages: life_stages.length,
    },
    data: {
      blocks,
      entities,
      links,
      reflections,
      life_stages,
    },
  };
}

function parseJsonField<T>(val: string | undefined | null, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

function blockFromRow(r: Record<string, string>): Block {
  return {
    id: r.id,
    type: r.type as Block["type"],
    content: r.content,
    scripture_ref: r.scripture_ref || undefined,
    scripture_display_ref: r.scripture_display_ref || undefined,
    scripture_translation: r.scripture_translation || undefined,
    scripture_verses: parseJsonField(r.scripture_verses, []),
    entity_type: (r.entity_type as Block["entity_type"]) || undefined,
    entity_id: r.entity_id || undefined,
    entity_name: r.entity_name || undefined,
    entity_aliases: parseJsonField(r.entity_aliases, []),
    entity_description: r.entity_description || undefined,
    source: r.source || undefined,
    captured_at: r.captured_at,
    modified_at: r.modified_at,
    tags: parseJsonField(r.tags, []),
  };
}

function entityFromRow(r: Record<string, string>): Entity {
  return {
    id: r.id,
    type: r.type as Entity["type"],
    name: r.name,
    aliases: parseJsonField(r.aliases, []),
    description: r.description ?? "",
    key_passages: parseJsonField(r.key_passages, []),
    mentioned_in: parseJsonField(r.mentioned_in, []),
    connected_entities: parseJsonField(r.connected_entities, []),
    familiarity: parseInt(r.familiarity, 10),
    last_studied: r.last_studied || undefined,
    next_suggested: r.next_suggested || undefined,
  };
}

function linkFromRow(r: Record<string, string>): Link {
  return {
    id: r.id,
    from_block: r.from_block,
    to_block: r.to_block,
    link_text: r.link_text,
    context: r.context,
    created_at: r.created_at,
    is_entity_link: r.is_entity_link === "1",
    reflection_id: r.reflection_id || null,
  };
}

function reflectionFromRow(r: Record<string, string>): Reflection {
  return {
    id: r.id,
    block_id: r.block_id,
    body: r.body,
    created_at: r.created_at,
    modified_at: r.modified_at,
  };
}

function lifeStageFromRow(r: Record<string, string>): LifeStageRecord {
  return {
    block_id: r.block_id,
    stage: r.stage as LifeStageRecord["stage"],
    kindled_at: r.kindled_at,
    last_reviewed: r.last_reviewed || undefined,
    next_review_at: r.next_review_at,
    review_count: parseInt(r.review_count, 10),
    settledness: parseInt(r.settledness, 10),
    linger_seconds: parseFloat(r.linger_seconds),
    notes_added: parseInt(r.notes_added, 10),
    connections_made: parseInt(r.connections_made, 10),
  };
}

export type ExportFormat = "json" | "csv" | "markdown" | "text";

function escapeCsvField(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function joinArrayForCsv(arr: string[]): string {
  return arr.join("; ");
}

export function formatAsCsv(payload: KindledExport): string {
  const header = [
    "Title",
    "Type",
    "Content",
    "Scripture Ref",
    "Translation",
    "Tags",
    "Entity Name",
    "Entity Type",
    "Source",
    "Captured At",
    "Life Stage",
    "Review Count",
    "Settledness",
  ].join(",");

  const rows = payload.data.blocks.map((b) => {
    const ls = payload.data.life_stages.find((s) => s.block_id === b.id);
    const title = b.scripture_display_ref ?? b.entity_name ?? "Note";
    const stage = ls?.stage ?? "";
    const reviewCount = ls ? String(ls.review_count) : "";
    const settledness = ls ? String(ls.settledness) : "";
    return [
      escapeCsvField(title),
      escapeCsvField(b.type),
      escapeCsvField(b.content),
      escapeCsvField(b.scripture_ref ?? ""),
      escapeCsvField(b.scripture_translation ?? ""),
      escapeCsvField(joinArrayForCsv(b.tags)),
      escapeCsvField(b.entity_name ?? ""),
      escapeCsvField(b.entity_type ?? ""),
      escapeCsvField(b.source ?? ""),
      escapeCsvField(b.captured_at),
      escapeCsvField(stage),
      reviewCount,
      settledness,
    ].join(",");
  });

  return [header, ...rows].join("\n");
}

export function formatAsMarkdown(payload: KindledExport): string {
  const lines: string[] = [];
  lines.push(`# Kindled Export`);
  lines.push(`_Exported ${payload.exported_at}_`);
  lines.push("");
  lines.push(`${payload.counts.blocks} passages · ${payload.counts.entities} entities · ${payload.counts.reflections} reflections`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const b of payload.data.blocks) {
    const title = b.scripture_display_ref ?? b.entity_name ?? "Note";
    const ls = payload.data.life_stages.find((s) => s.block_id === b.id);
    lines.push(`## ${title}`);
    if (b.scripture_ref) {
      lines.push(`**${b.scripture_ref}** (${b.scripture_translation ?? ""})`);
    }
    if (b.type !== "scripture") {
      lines.push(`_Type: ${b.type}_`);
    }
    lines.push("");
    lines.push(b.content);
    lines.push("");
    if (ls) {
      lines.push(`> Stage: **${ls.stage}** · Reviews: ${ls.review_count} · Settledness: ${ls.settledness}`);
      lines.push("");
    }
    const reflections = payload.data.reflections.filter((r) => r.block_id === b.id);
    for (const r of reflections) {
      lines.push(`### Reflection`);
      lines.push(r.body);
      lines.push("");
    }
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

export function formatAsPlainText(payload: KindledExport): string {
  const lines: string[] = [];
  lines.push(`Kindled Export`);
  lines.push(`Exported ${payload.exported_at}`);
  lines.push("");

  for (const b of payload.data.blocks) {
    const title = b.scripture_display_ref ?? b.entity_name ?? "Note";
    const ls = payload.data.life_stages.find((s) => s.block_id === b.id);
    lines.push(`${title}`);
    if (b.scripture_ref && b.scripture_translation) {
      lines.push(`${b.scripture_ref} (${b.scripture_translation})`);
    }
    lines.push("");
    lines.push(b.content);
    lines.push("");
    if (ls) {
      lines.push(`Stage: ${ls.stage} · Reviews: ${ls.review_count}`);
    }
    const reflections = payload.data.reflections.filter((r) => r.block_id === b.id);
    for (const r of reflections) {
      lines.push("");
      lines.push(`Reflection: ${r.body}`);
    }
    lines.push("────────────────────────────────");
    lines.push("");
  }

  return lines.join("\n");
}

export function formatPayload(payload: KindledExport, format: ExportFormat): string {
  switch (format) {
    case "json":
      return JSON.stringify(payload, null, 2);
    case "csv":
      return formatAsCsv(payload);
    case "markdown":
      return formatAsMarkdown(payload);
    case "text":
      return formatAsPlainText(payload);
  }
}

function fileExtension(format: ExportFormat): string {
  switch (format) {
    case "json": return "json";
    case "csv": return "csv";
    case "markdown": return "md";
    case "text": return "txt";
  }
}

function mimeType(format: ExportFormat): string {
  switch (format) {
    case "json": return "application/json";
    case "csv": return "text/csv";
    case "markdown": return "text/markdown";
    case "text": return "text/plain";
  }
}

function filterName(format: ExportFormat): string {
  switch (format) {
    case "json": return "JSON";
    case "csv": return "CSV";
    case "markdown": return "Markdown";
    case "text": return "Text";
  }
}

export async function downloadExport(payload: KindledExport, format: ExportFormat = "json"): Promise<void> {
  const content = formatPayload(payload, format);
  const ext = fileExtension(format);
  const mime = mimeType(format);
  const filename = `kindled-export-${new Date().toISOString().slice(0, 10)}.${ext}`;

  if (isTauriRuntime()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: filename,
      filters: [{ name: filterName(format), extensions: [ext] }],
    });
    if (!path) return; // user cancelled
    await writeTextFile(path, content);
    return;
  }

  // Browser fallback
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
