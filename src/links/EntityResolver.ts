import { findEntityByName, getAllEntities, createEntity, getEntity } from "../db";
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
    if (text.toLowerCase().includes(entity.name.toLowerCase())) {
      if (!seen.has(entity.id)) {
        seen.add(entity.id);
        mentions.push({ text: entity.name, entity });
      }
    }

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

export async function findOrCreateEntity(name: string): Promise<Entity> {
  const existing = await findEntityByName(name);
  if (existing) return existing;

  const entityId = `ent_t_${name.toLowerCase().replace(/\s+/g, "_")}`;
  await createEntity({
    id: entityId,
    type: "theme",
    name,
    aliases: [],
    description: "",
    key_passages: [],
    familiarity: 0,
  });

  const created = await getEntity(entityId);
  return created!;
}
