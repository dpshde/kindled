import type { JSX } from "solid-js";
import type { AppScreen } from "./app-screen";
import type { AppRootModel } from "./app-model";
import { HearthView } from "../hearth/hearth-view";
import { PassageView } from "../hearth/passage-view";
import { NoteCaptureView } from "../capture/note-capture-view";
import { ScriptureCaptureView } from "../capture/scripture-capture-view";
import { QuietCloseView } from "../ritual/quiet-close-view";
import { ThresholdView } from "../ritual/threshold-view";
import { ShareView } from "../share/share-view";

export type RootContext = {
  app: AppRootModel;
  navigate: (s: AppScreen) => void;
};

export function RenderRoot(props: {
  app: AppRootModel;
  navigate: (s: AppScreen) => void;
}): JSX.Element {
  const screen = () => props.app.screen();

  return (
    <>
      {(() => {
        const s = screen();
        switch (s.kind) {
          case "threshold":
            return (
              <ThresholdView
                onBegin={(ids) => {
                  const next = screenAfterBeginKindling(ids);
                  if (next) props.navigate(next);
                }}
                onLibrary={() => props.navigate({ kind: "library" })}
                onCapture={() => props.navigate({ kind: "capture" })}
              />
            );
          case "quietClose":
            return (
              <QuietCloseView
                onClose={() => props.navigate({ kind: "threshold" })}
              />
            );
          case "library":
            return (
              <HearthView
                onCapture={() => props.navigate({ kind: "capture" })}
                onSelect={(passageId) =>
                  props.navigate({ kind: "passage", passageId })
                }
                onNavigateHome={() => props.navigate({ kind: "threshold" })}
              />
            );
          case "capture":
            return (
              <ScriptureCaptureView
                initialRef={s.initialRef}
                onBack={() => props.navigate({ kind: "threshold" })}
                onNavigateHome={() => props.navigate({ kind: "threshold" })}
                onSaved={() => props.navigate({ kind: "threshold" })}
              />
            );
          case "share":
            return (
              <ShareView
                initialRef={s.initialRef}
                onNavigateHome={() => props.navigate({ kind: "threshold" })}
                onSaved={(passageId) => props.navigate({ kind: "passage", passageId })}
              />
            );
          case "note":
            return (
              <NoteCaptureView
                passageId={s.passageId}
                displayRef={s.displayRef}
                reflectionId={s.reflectionId}
                onEditReflection={(id) => {
                  props.navigate({
                    ...s,
                    reflectionId: id,
                  });
                }}
                onNavigate={(passageId) => {
                  props.app.bumpPassageReload();
                  props.navigate({ kind: "passage", passageId });
                }}
                onBack={
                  s.returnToPassageId !== undefined
                    ? () => {
                        props.app.bumpPassageReload();
                        props.navigate({
                          kind: "passage",
                          passageId: s.returnToPassageId!,
                        });
                      }
                    : () => props.navigate({ kind: "threshold" })
                }
                onNavigateHome={() => props.navigate({ kind: "threshold" })}
                onSaved={
                  s.returnToPassageId !== undefined
                    ? () => {
                        props.app.bumpPassageReload();
                        props.navigate({
                          kind: "passage",
                          passageId: s.returnToPassageId!,
                        });
                      }
                    : () => props.navigate({ kind: "threshold" })
                }
              />
            );
          case "passage":
            if (!s.passageId) {
              props.navigate({ kind: "threshold" });
              return <></>;
            }
            const inKindling = !!s.kindling;
            return (
              <PassageView
                app={props.app}
                passageId={s.passageId}
                kindlingProgress={
                  s.kindling
                    ? { index: s.kindling.index, total: s.kindling.queueIds.length }
                    : undefined
                }
                onKindlingAdvance={
                  inKindling
                    ? () => {
                        const next = screenAfterKindlingAdvance(
                          props.app.screen(),
                        );
                        if (next) props.navigate(next);
                      }
                    : undefined
                }
                onBack={() =>
                  props.navigate(
                    inKindling ? { kind: "threshold" } : { kind: "library" },
                  )
                }
                onNavigateHome={() => props.navigate({ kind: "threshold" })}
                onNavigate={
                  inKindling
                    ? () => {}
                    : (passageId) =>
                        props.navigate({ kind: "passage", passageId })
                }
                onDeleted={() =>
                  props.navigate(
                    inKindling ? { kind: "threshold" } : { kind: "library" },
                  )
                }
                onNote={(opts) =>
                  props.navigate(noteScreenFromPassageAction(inKindling, opts))
                }
              />
            );
        }
      })()}
    </>
  );
}

function screenAfterBeginKindling(
  passageIds: string[],
): AppScreen | null {
  const first = passageIds[0];
  if (!first) return null;
  return {
    kind: "passage",
    passageId: first,
    kindling: { queueIds: passageIds, index: 0 },
  };
}

function screenAfterKindlingAdvance(screen: AppScreen): AppScreen | null {
  if (screen.kind !== "passage" || !screen.kindling) return null;
  const { queueIds, index } = screen.kindling;
  if (index + 1 >= queueIds.length) return { kind: "quietClose" };
  return {
    kind: "passage",
    passageId: queueIds[index + 1]!,
    kindling: { queueIds, index: index + 1 },
  };
}

type PassageNoteAction = {
  passageId: string;
  displayRef: string;
  reflectionId?: string;
};

function noteScreenFromPassageAction(
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
