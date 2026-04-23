/**
 * SwipeHost — wraps a screen view and attaches swipe gesture navigation.
 *
 * On mobile (touch devices), a right-edge swipe from the left goes back,
 * and (in kindling mode) a leftward swipe advances to the next passage.
 *
 * The host element is a plain div that fills its parent. It does NOT
 * interfere with tap-to-toggle-reading-focus on the passage screen,
 * because the gesture detector requires ≥50px horizontal travel.
 */

import {
  onMount,
  onCleanup,
  type JSX,
} from "solid-js";
import type { AppScreen } from "../app/app-screen";
import type { AppRootModel } from "../app/app-model";
import { createSwipeGesture } from "./swipe-gesture";

export type SwipeHostProps = {
  app: AppRootModel;
  navigate: (s: AppScreen) => void;
  children: JSX.Element;
};

/**
 * Determine the "back" screen for a given screen kind.
 * Returns null if there's nowhere to go back to.
 */
function backScreenFor(current: AppScreen): AppScreen | null {
  switch (current.kind) {
    case "library":
      return { kind: "threshold" };
    case "passage":
      // In kindling → threshold; standalone → library
      return current.kindling ? { kind: "threshold" } : { kind: "library" };
    case "capture":
      return { kind: "threshold" };
    case "note":
      return current.returnToPassageId
        ? { kind: "passage", passageId: current.returnToPassageId }
        : { kind: "threshold" };
    case "share":
      return null; // share is an entry point, no back
    case "quietClose":
      return { kind: "threshold" };
    case "threshold":
    default:
      return null;
  }
}

export function SwipeHost(props: SwipeHostProps): JSX.Element {
  let hostRef!: HTMLDivElement;

  onMount(() => {
    const handle = createSwipeGesture(hostRef, {
      onBack() {
        const back = backScreenFor(props.app.screen());
        if (back) props.navigate(back);
      },
      onForward() {
        const s = props.app.screen();
        if (s.kind === "passage" && s.kindling) {
          const { queueIds, index } = s.kindling;
          if (index + 1 < queueIds.length) {
            props.navigate({
              kind: "passage",
              passageId: queueIds[index + 1]!,
              kindling: { queueIds, index: index + 1 },
            });
          } else {
            props.navigate({ kind: "quietClose" });
          }
        }
      },
      // Forward swipe from anywhere in kindling, right-edge only otherwise
      forwardAnywhere: true,
      edgeWidth: 28,
      threshold: 50,
      maxDuration: 400,
    });

    onCleanup(() => handle.destroy());
  });

  return (
    <div ref={hostRef} style={{ width: "100%", height: "100%", flex: "1 1 0%", "min-height": "0", display: "flex", "flex-direction": "column" }}>
      {props.children}
    </div>
  );
}
