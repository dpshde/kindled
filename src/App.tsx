import { createSignal, onMount, Show } from "solid-js";
import { Threshold } from "./ritual/Threshold";
import { GardenView } from "./garden/GardenView";
import { PassageView } from "./garden/PassageView";
import { QuietClose } from "./ritual/QuietClose";
import { ScriptureCapture } from "./capture/ScriptureCapture";
import { NoteCapture } from "./capture/NoteCapture";
import { loadBibleData } from "./scripture/BibleLoader";
import { consumeCaptureRefFromWindow } from "./navigation/capture-deep-link";

type Screen =
  | { kind: "threshold" }
  | { kind: "quietClose" }
  | { kind: "library" }
  | { kind: "capture"; initialRef?: string }
  | {
      kind: "note";
      passageId: string;
      displayRef: string;
      returnToPassageId?: string;
    }
  | {
      kind: "passage";
      passageId: string;
      /** Daily kindling queue; omitted when opened from the library */
      kindling?: { queueIds: string[]; index: number };
    };

function initialScreen(): Screen {
  const ref = consumeCaptureRefFromWindow();
  if (ref) return { kind: "capture", initialRef: ref };
  return { kind: "threshold" };
}

export default function App() {
  const [screen, setScreen] = createSignal<Screen>(initialScreen());

  onMount(() => {
    loadBibleData().catch(() => {});
  });

  const navigate = (s: Screen) => setScreen(s);

  const handleBeginKindling = (passageIds: string[]) => {
    const first = passageIds[0];
    if (!first) return;
    navigate({
      kind: "passage",
      passageId: first,
      kindling: { queueIds: passageIds, index: 0 },
    });
  };

  const handleKindlingAdvance = () => {
    const s = screen();
    if (s.kind !== "passage" || !s.kindling) return;
    const { queueIds, index } = s.kindling;
    if (index + 1 >= queueIds.length) {
      navigate({ kind: "quietClose" });
    } else {
      navigate({
        kind: "passage",
        passageId: queueIds[index + 1]!,
        kindling: { queueIds, index: index + 1 },
      });
    }
  };

  const handleFinishRitual = () => {
    navigate({ kind: "threshold" });
  };

  return (
    <>
      {(() => {
        const s = screen();
        switch (s.kind) {
          case "threshold":
            return (
              <Threshold
                onBegin={handleBeginKindling}
                onLibrary={() => navigate({ kind: "library" })}
                onCapture={() => navigate({ kind: "capture" })}
              />
            );

          case "passage": {
            if (!s.passageId) {
              navigate({ kind: "threshold" });
              return null;
            }
            const inKindling = !!s.kindling;
            return (
              <Show when={s.passageId} keyed>
                {(id) => (
                  <PassageView
                    passageId={id}
                    kindlingProgress={
                      s.kindling
                        ? {
                            index: s.kindling.index,
                            total: s.kindling.queueIds.length,
                          }
                        : undefined
                    }
                    onKindlingAdvance={
                      inKindling ? handleKindlingAdvance : undefined
                    }
                    onBack={() =>
                      navigate(inKindling ? { kind: "threshold" } : { kind: "library" })
                    }
                    onNavigate={
                      inKindling
                        ? () => {}
                        : (passageId) => navigate({ kind: "passage", passageId })
                    }
                    onDeleted={() =>
                      navigate(inKindling ? { kind: "threshold" } : { kind: "library" })
                    }
                    onNote={(passageId, displayRef) =>
                      navigate(
                        inKindling
                          ? { kind: "note", passageId, displayRef }
                          : {
                              kind: "note",
                              passageId,
                              displayRef,
                              returnToPassageId: passageId,
                            },
                      )
                    }
                  />
                )}
              </Show>
            );
          }

          case "quietClose":
            return <QuietClose onClose={handleFinishRitual} />;

          case "library":
            return (
              <GardenView
                onBack={() => navigate({ kind: "threshold" })}
                onCapture={() => navigate({ kind: "capture" })}
                onSelect={(passageId) => navigate({ kind: "passage", passageId })}
              />
            );

          case "capture":
            return (
              <ScriptureCapture
                initialRef={s.initialRef}
                onBack={() => navigate({ kind: "threshold" })}
                onSaved={() => navigate({ kind: "threshold" })}
              />
            );

          case "note": {
            const noteBack =
              s.returnToPassageId !== undefined
                ? () =>
                    navigate({
                      kind: "passage",
                      passageId: s.returnToPassageId!,
                    })
                : () => navigate({ kind: "threshold" });
            return (
              <NoteCapture
                passageId={s.passageId}
                displayRef={s.displayRef}
                onBack={noteBack}
                onSaved={noteBack}
              />
            );
          }
        }
      })()}
    </>
  );
}
