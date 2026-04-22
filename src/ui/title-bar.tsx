import type { JSX } from "solid-js";
import { ICON_PX } from "./icon-sizes";
import { IconArrowLeft, IconX, IconMinimize, IconMaximize } from "./icons/icons";
import { hapticLight } from "../haptics";
import styles from "./TitleBar.module.css";

export type TitleBarVariant = "default" | "passage" | "capture" | "library";

export interface TitleBarProps {
  title?: string;
  variant?: TitleBarVariant;
  showBack?: boolean;
  onBack?: () => void;
  leading?: JSX.Element;
  trailing?: JSX.Element;
  isTauri?: boolean;
  platform?: "macos" | "windows" | "linux" | "web" | "ios" | "android";
}

export function titleBar(props: TitleBarProps): JSX.Element {
  const {
    title,
    variant = "default",
    showBack = false,
    onBack,
    leading,
    trailing,
    isTauri = false,
    platform = "web",
  } = props;

  const isMacOS = platform === "macos";
  const isTauriDesktop = isTauri && platform !== "web";

  return (
    <div
      class={`${styles.titleBar} ${styles[variant]} ${isMacOS ? styles.macos : ""}`}
      data-tauri-drag-region={isTauri ? "true" : "false"}
    >
      <div class={styles.leading}>
        {leading ??
          (showBack && onBack ? (
            <button
              type="button"
              class={styles.backBtn}
              onClick={() => {
                hapticLight();
                onBack();
              }}
              aria-label="Back"
            >
              <IconArrowLeft size={ICON_PX.header} />
            </button>
          ) : (
            <></>
          ))}
      </div>

      <div class={styles.center}>
        {title ? (
          <h1 class={styles.title}>{title}</h1>
        ) : (
          <div class={styles.titlePlaceholder} />
        )}
      </div>

      <div class={styles.trailing}>
        {trailing ??
          (isTauriDesktop && !isMacOS ? (
            <div class={styles.windowControls}>
              <button
                type="button"
                class={styles.windowControl}
                onClick={() => void minimizeWindow()}
                aria-label="Minimize"
              >
                <IconMinimize size={14} />
              </button>
              <button
                type="button"
                class={styles.windowControl}
                onClick={() => void maximizeWindow()}
                aria-label="Maximize"
              >
                <IconMaximize size={14} />
              </button>
              <button
                type="button"
                class={`${styles.windowControl} ${styles.closeControl}`}
                onClick={() => void closeWindow()}
                aria-label="Close"
              >
                <IconX size={14} />
              </button>
            </div>
          ) : (
            <></>
          ))}
      </div>
    </div>
  );
}

async function minimizeWindow() {
  if ("__TAURI_INTERNALS__" in window) {
    const mod = await import("@tauri-apps/api/window");
    await mod.getCurrentWindow().minimize();
  }
}

async function maximizeWindow() {
  if ("__TAURI_INTERNALS__" in window) {
    const mod = await import("@tauri-apps/api/window");
    const w = mod.getCurrentWindow();
    const isMaximized = await w.isMaximized();
    if (isMaximized) {
      await w.unmaximize();
    } else {
      await w.maximize();
    }
  }
}

async function closeWindow() {
  if ("__TAURI_INTERNALS__" in window) {
    const mod = await import("@tauri-apps/api/window");
    await mod.getCurrentWindow().close();
  }
}

export function detectPlatform(): TitleBarProps["platform"] {
  const ua = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if ("__TAURI_INTERNALS__" in window) {
    if (ua.includes("macintosh") || ua.includes("mac os")) return "macos";
    if (ua.includes("windows")) return "windows";
    return "linux";
  }
  return "web";
}
