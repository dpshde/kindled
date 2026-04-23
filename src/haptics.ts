/**
 * Haptic feedback — unified across web, iOS, macOS.
 *
 * Web    → web-haptics (Vibration API + debug audio on non-touch devices)
 * iOS    → @tauri-apps/plugin-haptics
 * macOS  → tauri-plugin-macos-haptics + web-haptics debug audio
 */

import {
  WebHaptics,
  type HapticInput,
  type TriggerOptions,
} from "web-haptics";
import { isTauri } from "@tauri-apps/api/core";

export type HapticStyle = "light" | "medium" | "heavy" | "selection" | "warning";

type Platform = "ios" | "macos" | "web";

let cachedPlatform: Platform | null = null;
/** Promise so concurrent calls share the same detection flight. */
let platformPromise: Promise<Platform> | null = null;
let instance: WebHaptics | null = null;

function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && (isTauri() || "__TAURI_INTERNALS__" in window);
}

function shouldUseDebugAudio(): boolean {
  return (
    typeof document !== "undefined" &&
    typeof window !== "undefined" &&
    (isTauriEnvironment() || !("ontouchstart" in window))
  );
}

function getWebHaptics(): WebHaptics {
  if (!instance) {
    instance = new WebHaptics({ debug: shouldUseDebugAudio() });
  }
  return instance;
}

export function hapticTrigger(
  input?: HapticInput,
  options?: TriggerOptions,
): ReturnType<WebHaptics["trigger"]> {
  return getWebHaptics().trigger(input, options);
}

async function detectPlatform(): Promise<Platform> {
  if (cachedPlatform) return cachedPlatform;

  // Deduplicate: if a detection is already in flight, piggyback on it.
  if (platformPromise) return platformPromise;

  platformPromise = (async () => {
    if (!isTauriEnvironment()) {
      cachedPlatform = "web";
      return "web";
    }

    try {
      const { platform } = await import("@tauri-apps/plugin-os");
      const os = await platform();
      if (os === "ios") {
        cachedPlatform = "ios";
      } else if (os === "macos") {
        cachedPlatform = "macos";
      } else {
        cachedPlatform = "web";
      }
    } catch {
      cachedPlatform = "web";
    }

    return cachedPlatform;
  })();

  return platformPromise;
}

/**
 * Warm up platform detection + WebHaptics instance at app boot.
 *
 * Call once early (e.g. from main.ts) so the first user-triggered haptic
 * doesn't have to await a dynamic import before firing — which would miss
 * the browser's user-activation window and silently fail.
 */
export function initHaptics(): void {
  void detectPlatform();
  // Eagerly construct the WebHaptics instance (cheap; no side effects).
  getWebHaptics();
}

async function triggerIosImpact(style: "light" | "medium" | "heavy"): Promise<void> {
  const { impactFeedback } = await import("@tauri-apps/plugin-haptics");
  await impactFeedback(style);
}

async function triggerIosNotification(kind: "success" | "warning"): Promise<void> {
  const { notificationFeedback } = await import("@tauri-apps/plugin-haptics");
  await notificationFeedback(kind);
}

async function triggerMacosHaptic(style: HapticStyle | "success"): Promise<void> {
  const {
    perform,
    HapticFeedbackPattern,
    PerformanceTime,
    isSupported,
  } = await import("tauri-plugin-macos-haptics-api");

  const supported = await isSupported();
  if (!supported) return;

  switch (style) {
    case "light":
    case "selection":
      await perform(HapticFeedbackPattern.Generic, PerformanceTime.Now);
      break;
    case "medium":
    case "heavy":
    case "warning":
    case "success":
      await perform(HapticFeedbackPattern.LevelChange, PerformanceTime.Now);
      break;
  }
}

function mapStyleToWebPreset(style: HapticStyle | "success"): HapticInput {
  switch (style) {
    case "light":
      return "light";
    case "medium":
      return "medium";
    case "heavy":
      return "heavy";
    case "selection":
      return "selection";
    case "warning":
      return "warning";
    case "success":
      return "success";
  }
}

async function triggerFeedback(style: HapticStyle | "success"): Promise<void> {
  // Fire the web-haptics path *immediately* (synchronous) so it lands inside
  // the browser's user-activation window.  The native Tauri path is async and
  // runs in parallel — if the platform hasn't been detected yet we fire the
  // web fallback first and let the native path catch up on the next call.
  const preset = mapStyleToWebPreset(style);
  const webP = hapticTrigger(preset);

  // Kick off native haptics alongside web.  Even if detectPlatform is still
  // resolving for the very first call, the web path above already fired.
  const nativeP = (async () => {
    try {
      const platform = await detectPlatform();

      if (platform === "ios") {
        if (style === "warning") {
          await triggerIosNotification("warning");
          return;
        }
        if (style === "success") {
          await triggerIosNotification("success");
          return;
        }
        if (style === "selection") {
          await triggerIosImpact("light");
          return;
        }
        await triggerIosImpact(style);
        return;
      }

      if (platform === "macos") {
        await triggerMacosHaptic(style);
        return;
      }
    } catch {
      // Gracefully degrade
    }
  })();

  await Promise.allSettled([webP, nativeP]);
}

export const hapticLight = () => triggerFeedback("light");
export const hapticMedium = () => triggerFeedback("medium");
export const hapticHeavy = () => triggerFeedback("heavy");
export const hapticSelection = () => triggerFeedback("selection");
export const hapticWarning = () => triggerFeedback("warning");
export const hapticSuccess = () => triggerFeedback("success");
export const hapticSave = () => triggerFeedback("success");
