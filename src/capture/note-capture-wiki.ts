/** Wiki-link `[[...` context at cursor (plain TS). */
export function getWikiLinkContext(
  text: string,
  cursorPos: number,
): { query: string; start: number; end: number } | null {
  const before = text.slice(0, cursorPos);
  const openIdx = before.lastIndexOf("[[");
  if (openIdx === -1) return null;

  const afterOpen = text.slice(openIdx + 2);
  const closeIdx = afterOpen.indexOf("]]");
  if (closeIdx !== -1 && openIdx + 2 + closeIdx < cursorPos) return null;

  const query = text.slice(openIdx + 2, cursorPos);
  return { query, start: openIdx, end: cursorPos };
}

export function getBracketRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  const re = /\[\[[^\]]+\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}
