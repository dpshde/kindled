/**
 * Top-level app navigation state (client-side only; not URL-routed).
 */

export type AppScreen =
  | { kind: "threshold" }
  | { kind: "quietClose" }
  | { kind: "library" }
  | { kind: "capture"; initialRef?: string }
  | {
      kind: "note";
      passageId: string;
      displayRef: string;
      returnToPassageId?: string;
      reflectionId?: string;
    }
  | {
      kind: "passage";
      passageId: string;
      kindling?: { queueIds: string[]; index: number };
    };

export function initialAppScreenFromCaptureRef(ref: string | null): AppScreen {
  const t = ref?.trim();
  if (t) return { kind: "capture", initialRef: t };
  return { kind: "threshold" };
}

export function normalizeAppScreen(screen: AppScreen): AppScreen {
  if (screen.kind === "passage" && !screen.passageId) {
    return { kind: "threshold" };
  }
  return screen;
}

export function screenAfterBeginKindling(passageIds: string[]): AppScreen | null {
  const first = passageIds[0];
  if (!first) return null;
  return {
    kind: "passage",
    passageId: first,
    kindling: { queueIds: passageIds, index: 0 },
  };
}

export function screenAfterKindlingAdvance(screen: AppScreen): AppScreen | null {
  if (screen.kind !== "passage" || !screen.kindling) return null;
  const { queueIds, index } = screen.kindling;
  if (index + 1 >= queueIds.length) return { kind: "quietClose" };
  return {
    kind: "passage",
    passageId: queueIds[index + 1]!,
    kindling: { queueIds, index: index + 1 },
  };
}

export type PassageNoteAction = {
  passageId: string;
  displayRef: string;
  reflectionId?: string;
};

export function noteScreenFromPassageAction(
  inKindling: boolean,
  opts: PassageNoteAction,
): AppScreen {
  if (inKindling) {
    return {
      kind: "note",
      passageId: opts.passageId,
      displayRef: opts.displayRef,
      reflectionId: opts.reflectionId,
    };
  }
  return {
    kind: "note",
    passageId: opts.passageId,
    displayRef: opts.displayRef,
    reflectionId: opts.reflectionId,
    returnToPassageId: opts.passageId,
  };
}
