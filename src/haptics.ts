import {
  WebHaptics,
  type HapticInput,
  type TriggerOptions,
} from "web-haptics";

const debug =
  typeof document !== "undefined" && !("ontouchstart" in window);

let instance: WebHaptics | null = null;

function getWebHaptics(): WebHaptics {
  if (!instance) {
    instance = new WebHaptics({ debug });
  }
  return instance;
}

/**
 * Framework-agnostic helper; React apps use `const { trigger } = useWebHaptics()` from `web-haptics/react`.
 */
export function hapticTrigger(
  input?: HapticInput,
  options?: TriggerOptions,
): ReturnType<WebHaptics["trigger"]> {
  return getWebHaptics().trigger(input, options);
}
