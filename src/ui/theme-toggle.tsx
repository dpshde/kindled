import { createSignal, createEffect, type JSX } from "solid-js";
import { getCurrentTheme, toggleTheme, type Theme } from "./theme";
import { IconSun, IconMoon } from "./icons/icons";
import { hapticLight } from "../haptics";

export function ThemeToggle(props: {
  class?: string;
}): JSX.Element {
  const [theme, setTheme] = createSignal<Theme>(getCurrentTheme());

  createEffect(() => {
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
      {isDark() ? <IconSun size={20} /> : <IconMoon size={20} />}
    </button>
  );
}
