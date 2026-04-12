import { findEntityByName, getAllEntities } from "../db";
import type { Entity } from "../db";

export interface ResolvedMention {
  text: string;
  entity: Entity;
}

export async function resolveMentions(
  text: string,
): Promise<ResolvedMention[]> {
  const entities = await getAllEntities();
  const mentions: ResolvedMention[] = [];
  const seen = new Set<string>();

  for (const entity of entities) {
    // Check primary name
    if (text.toLowerCase().includes(entity.name.toLowerCase())) {
      if (!seen.has(entity.id)) {
        seen.add(entity.id);
        mentions.push({ text: entity.name, entity });
      }
    }

    // Check aliases
    for (const alias of entity.aliases) {
      if (alias.length < 3) continue;
      if (text.toLowerCase().includes(alias.toLowerCase())) {
        if (!seen.has(entity.id)) {
          seen.add(entity.id);
          mentions.push({ text: alias, entity });
        }
      }
    }
  }

  return mentions;
}

export async function findOrCreateEntity(
  name: string,
): Promise<Entity | null> {
  const existing = await findEntityByName(name);
  return existing;
}
