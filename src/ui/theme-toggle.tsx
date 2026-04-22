import { createSignal, createEffect, type JSX } from "solid-js";
import { getCurrentTheme, toggleTheme, type Theme } from "./theme";
import { hapticLight } from "../haptics";

export function ThemeToggle(props: {
  class?: string;
}): JSX.Element {
  const [theme, setTheme] = createSignal<Theme>(getCurrentTheme());

  createEffect(() => {
    // Re-read when component mounts or re-mounts
    setTheme(getCurrentTheme());
  });

  function handleToggle() {
    hapticLight();
    const next = toggleTheme();
    setTheme(next);
  }

  const isDark = () => theme() === "dark";

  return (
    <button
      type="button"
      class={props.class}
      onClick={handleToggle}
      aria-label={isDark() ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark() ? "Light mode" : "Dark mode"}
    >
      {isDark() ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 256 256"
          fill="none"
          stroke="currentColor"
          stroke-width="20"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="128" cy="128" r="60" />
          <line x1="128" y1="36" x2="128" y2="16" />
          <line x1="128" y1="240" x2="128" y2="220" />
          <line x1="36" y1="128" x2="16" y2="128" />
          <line x1="240" y1="128" x2="220" y2="128" />
          <line x1="62.9" y1="62.9" x2="48.8" y2="48.8" />
          <line x1="207.2" y1="207.2" x2="193.1" y2="193.1" />
          <line x1="62.9" y1="193.1" x2="48.8" y2="207.2" />
          <line x1="207.2" y1="48.8" x2="193.1" y2="62.9" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 256 256"
          fill="none"
          stroke="currentColor"
          stroke-width="20"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M216 112 A80 80 0 0 1 112 16" />
          <path d="M152 216 A96 96 0 0 1 40 104" />
          <circle cx="128" cy="128" r="8" fill="currentColor" stroke="none" />
        </svg>
      )}
    </button>
  );
}
