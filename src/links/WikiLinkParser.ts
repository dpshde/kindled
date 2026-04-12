const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

export interface ParsedLink {
  raw: string;
  text: string;
  index: number;
}

export function parseWikiLinks(content: string): ParsedLink[] {
  const links: ParsedLink[] = [];
  let match: RegExpExecArray | null;

  WIKI_LINK_RE.lastIndex = 0;
  while ((match = WIKI_LINK_RE.exec(content)) !== null) {
    links.push({
      raw: match[0],
      text: match[1].trim(),
      index: match.index,
    });
  }

  return links;
}

export function stripWikiLinks(content: string): string {
  return content.replace(WIKI_LINK_RE, "$1");
}

export function getSurroundingContext(
  content: string,
  linkText: string,
  contextChars = 80,
): string {
  const idx = content.indexOf(`[[${linkText}]]`);
  if (idx === -1) return "";
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(content.length, idx + linkText.length + 4 + contextChars);
  let context = content.slice(start, end).trim();
  if (start > 0) context = "..." + context;
  if (end < content.length) context = context + "...";
  return context;
}
