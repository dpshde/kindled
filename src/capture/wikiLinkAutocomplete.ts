/**
 * Applies a wiki-link autocomplete pick. When `]]` already exists after `[[` (e.g. cursor
 * was left before the closer after a previous pick), only the inner span is replaced so
 * we do not splice `[[x]]` in front of the existing `]]`.
 */
export function applyWikiLinkSuggestion(
  fullText: string,
  linkStart: number,
  queryEnd: number,
  insertText: string,
): { text: string; cursor: number } {
  const openIdx = linkStart;
  const afterOpen = fullText.slice(openIdx + 2);
  const relClose = afterOpen.indexOf("]]");
  const cursor = openIdx + 2 + insertText.length;

  if (relClose !== -1) {
    const closeStart = openIdx + 2 + relClose;
    return {
      text: fullText.slice(0, openIdx + 2) + insertText + fullText.slice(closeStart),
      cursor,
    };
  }

  const before = fullText.slice(0, openIdx);
  const after = fullText.slice(queryEnd);
  return {
    text: `${before}[[${insertText}]]${after}`,
    cursor,
  };
}
