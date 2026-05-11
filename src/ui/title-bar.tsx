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
  isNative?: boolean;
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
    isNative = false,
    platform = "web",
  } = props;

  const isMacOS = platform === "macos";
  const isNativeDesktop = isNative && platform !== "web";

  return (
    <div
      class={`${styles.titleBar} ${styles[variant]} ${isMacOS ? styles.macos : ""}`}
      data-drag-region={isNative ? "true" : "false"}
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
          (isNativeDesktop && !isMacOS ? (
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
  if (window.zero) {
    await window.zero.windows.minimize();
  }
}

async function maximizeWindow() {
  if (window.zero) {
    const maximized = await window.zero.windows.isMaximized();
    if (maximized) {
      await window.zero.windows.unmaximize();
    } else {
      await window.zero.windows.maximize();
    }
  }
}

async function closeWindow() {
  if (window.zero) {
    await window.zero.windows.close("main");
  }
}

export function detectPlatform(): TitleBarProps["platform"] {
  const ua = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (window.zero !== undefined) {
    if (ua.includes("macintosh") || ua.includes("mac os")) return "macos";
    if (ua.includes("windows")) return "windows";
    return "linux";
  }
  return "web";
}
