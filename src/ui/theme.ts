/**
 * Theme toggle — persisted in localStorage, respects system preference as default.
 *
 * Priority:
 *   1. Explicit user choice in localStorage ("light" | "dark")
 *   2. System preference via prefers-color-scheme
 *   3. Light (fallback)
 */

const STORAGE_KEY = "kindled-theme";
const DARK = "dark";
const LIGHT = "light";

export type Theme = "light" | "dark";

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);

  // Update theme-color meta for mobile status bar
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === DARK ? "#1a1816" : "#f7f5f0");
  }
}

export function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === DARK || stored === LIGHT) return stored;
  } catch {
    // localStorage unavailable
  }
  return null;
}

export function getCurrentTheme(): Theme {
  return getStoredTheme() ?? (systemPrefersDark() ? DARK : LIGHT);
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable
  }
  applyTheme(theme);
}

export function toggleTheme(): Theme {
  const next = getCurrentTheme() === DARK ? LIGHT : DARK;
  setTheme(next);
  return next;
}

/** Call once at app boot to apply persisted/system preference. */
export function initTheme(): void {
  const stored = getStoredTheme();
  if (stored) {
    applyTheme(stored);
  } else if (systemPrefersDark()) {
    applyTheme(DARK);
  }

  // Listen for system preference changes (only when user hasn't explicitly chosen)
  if (typeof window !== "undefined") {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        if (!getStoredTheme()) {
          applyTheme(e.matches ? DARK : LIGHT);
        }
      });
  }
}
