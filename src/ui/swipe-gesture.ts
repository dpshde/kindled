/**
 * Lightweight swipe gesture detector for mobile navigation.
 *
 * Attaches touchstart/touchmove/touchend listeners to an element
 * and fires callbacks when a horizontal swipe exceeds the threshold.
 *
 * Design goals:
 * - Ignore vertical scrolls (tracks axis lock)
 * - Ignore short swipes and slow drags
 * - Coexist with tap handlers (requires minimum distance)
 * - Edge-only trigger for "back" swipe (left 28px start zone)
 * - Any-position trigger for "forward" swipe in kindling
 */

export type SwipeDirection = "back" | "forward";

export type SwipeGestureOptions = {
  /** Called when a rightward edge swipe completes. */
  onBack?: () => void;
  /** Called when a leftward swipe completes (e.g. kindling advance). */
  onForward?: () => void;
  /** Min px from left edge for a "back" swipe to start. Default 28. */
  edgeWidth?: number;
  /** Min px travel to count as a swipe. Default 50. */
  threshold?: number;
  /** Max ms for the gesture. Default 400. */
  maxDuration?: number;
  /** Enable forward swipes from anywhere (not edge-gated). Default false. */
  forwardAnywhere?: boolean;
};

export type SwipeGestureHandle = {
  destroy: () => void;
};

export function createSwipeGesture(
  el: HTMLElement,
  opts: SwipeGestureOptions,
): SwipeGestureHandle {
  const edgeWidth = opts.edgeWidth ?? 28;
  const threshold = opts.threshold ?? 50;
  const maxDuration = opts.maxDuration ?? 400;
  const forwardAnywhere = opts.forwardAnywhere ?? false;

  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let axisLocked: "h" | "v" | null = null;
  let eligible = false;

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0]!;
    startX = t.clientX;
    startY = t.clientY;
    startTime = Date.now();
    axisLocked = null;
    // Back swipe: must start within edge zone
    // Forward swipe: can start anywhere if forwardAnywhere
    eligible = false;
    if (startX <= edgeWidth) eligible = true; // back swipe candidate
    if (forwardAnywhere) eligible = true;
    else if (startX >= (el.offsetWidth - edgeWidth)) eligible = true; // forward from right edge
  }

  function onTouchMove(e: TouchEvent) {
    if (!eligible || e.touches.length !== 1) return;
    const t = e.touches[0]!;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    // Axis lock: once we know the dominant direction, stick to it
    if (axisLocked === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      axisLocked = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }

    // If locked to vertical, kill eligibility
    if (axisLocked === "v") {
      eligible = false;
    }
  }

  function onTouchEnd(e: TouchEvent) {
    if (!eligible) return;
    const t = e.changedTouches[0]!;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const dt = Date.now() - startTime;

    if (dt > maxDuration) return;
    if (axisLocked !== "h") return;
    if (Math.abs(dx) < threshold) return;
    if (Math.abs(dy) > Math.abs(dx) * 0.6) return; // too diagonal

    if (dx > 0 && startX <= edgeWidth && opts.onBack) {
      // Rightward swipe from left edge → back
      opts.onBack();
    } else if (dx < 0 && (forwardAnywhere || startX >= el.offsetWidth - edgeWidth) && opts.onForward) {
      // Leftward swipe → forward
      opts.onForward();
    }
  }

  el.addEventListener("touchstart", onTouchStart, { passive: true });
  el.addEventListener("touchmove", onTouchMove, { passive: true });
  el.addEventListener("touchend", onTouchEnd, { passive: true });

  return {
    destroy() {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    },
  };
}
