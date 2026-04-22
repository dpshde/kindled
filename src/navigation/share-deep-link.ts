/** Query keys that open the Share view with a pre-filled reference. */
export const SHARE_REF_QUERY_KEYS = ["ref", "passage", "q"] as const;

/**
 * Read the first non-empty share ref from a query string (e.g. `?ref=John%203:16`).
 * Does not mutate the URL.
 */
export function peekShareRefFromSearch(search: string): string | null {
  const q = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(q);
  for (const key of SHARE_REF_QUERY_KEYS) {
    const v = params.get(key)?.trim();
    if (v) return v;
  }
  return null;
}

/**
 * If the current URL names a passage ref for Share, return it and strip those params via
 * `replaceState` so refresh/back behavior stays clean.
 */
export function consumeShareRefFromWindow(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  let found: string | null = null;
  for (const key of SHARE_REF_QUERY_KEYS) {
    const v = url.searchParams.get(key)?.trim();
    if (v) {
      found = v;
      break;
    }
  }
  if (!found) return null;
  for (const key of SHARE_REF_QUERY_KEYS) {
    url.searchParams.delete(key);
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
  return found;
}
