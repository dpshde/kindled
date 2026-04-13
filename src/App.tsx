import { createSignal, onMount, Show } from "solid-js";
import { Threshold } from "./ritual/Threshold";
import { GardenView } from "./garden/GardenView";
import { BlockDetail } from "./garden/BlockDetail";
import { PassageView } from "./ritual/PassageView";
import { QuietClose } from "./ritual/QuietClose";
import { ScriptureCapture } from "./capture/ScriptureCapture";
import { NoteCapture } from "./capture/NoteCapture";
import { loadBibleData } from "./scripture/BibleLoader";

type Screen =
  | { kind: "threshold" }
  | { kind: "kindling"; blockIds: string[]; index: number }
  | { kind: "quietClose" }
  | { kind: "library" }
  | { kind: "capture" }
  | { kind: "note"; blockId: string; displayRef: string; returnToBlockDetail?: string }
  | { kind: "blockDetail"; blockId: string };

export default function App() {
  const [screen, setScreen] = createSignal<Screen>({ kind: "threshold" });

  onMount(() => {
    loadBibleData().catch(() => {});
  });

  const navigate = (s: Screen) => setScreen(s);

  const handleBeginKindling = (blockIds: string[]) => {
    navigate({ kind: "kindling", blockIds, index: 0 });
  };

  const handleRitualAction = (
    _blockId: string,
    _action: "water" | "transplant" | "harvest",
  ) => {
    const s = screen();
    if (s.kind !== "kindling") return;

    if (s.index + 1 >= s.blockIds.length) {
      navigate({ kind: "quietClose" });
    } else {
      navigate({ kind: "kindling", blockIds: s.blockIds, index: s.index + 1 });
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

          case "kindling": {
            const currentId = s.blockIds[s.index];
            if (!currentId) {
              navigate({ kind: "quietClose" });
              return null;
            }
            return (
              <Show when={currentId} keyed>
                {(id) => (
                  <PassageView
                    blockId={id}
                    index={s.index}
                    total={s.blockIds.length}
                    onAction={handleRitualAction}
                    onNote={(blockId, displayRef) =>
                      navigate({ kind: "note", blockId, displayRef })
                    }
                    onBack={() => navigate({ kind: "threshold" })}
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
                onSelect={(blockId) => navigate({ kind: "blockDetail", blockId })}
              />
            );

          case "blockDetail":
            return (
              <BlockDetail
                blockId={s.blockId}
                onBack={() => navigate({ kind: "library" })}
                onNavigate={(blockId) => navigate({ kind: "blockDetail", blockId })}
                onDeleted={() => navigate({ kind: "library" })}
                onNote={(blockId, displayRef) =>
                  navigate({
                    kind: "note",
                    blockId,
                    displayRef,
                    returnToBlockDetail: blockId,
                  })
                }
              />
            );

          case "capture":
            return (
              <ScriptureCapture
                onBack={() => navigate({ kind: "threshold" })}
                onSaved={() => navigate({ kind: "threshold" })}
              />
            );

          case "note": {
            const noteBack =
              s.returnToBlockDetail !== undefined
                ? () =>
                    navigate({
                      kind: "blockDetail",
                      blockId: s.returnToBlockDetail!,
                    })
                : () => navigate({ kind: "threshold" });
            return (
              <NoteCapture
                blockId={s.blockId}
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
