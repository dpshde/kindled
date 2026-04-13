import { createSignal, Suspense, onMount } from "solid-js";
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
  | { kind: "note"; blockId: string; displayRef: string }
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
    <Suspense fallback={<LoadingScreen />}>
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
              <PassageView
                blockId={currentId}
                index={s.index}
                total={s.blockIds.length}
                onAction={handleRitualAction}
                onNote={(blockId, displayRef) =>
                  navigate({ kind: "note", blockId, displayRef })
                }
                onBack={() => navigate({ kind: "threshold" })}
              />
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
              />
            );

          case "capture":
            return (
              <ScriptureCapture
                onBack={() => navigate({ kind: "threshold" })}
                onSaved={() => navigate({ kind: "threshold" })}
              />
            );

          case "note":
            return (
              <NoteCapture
                blockId={s.blockId}
                displayRef={s.displayRef}
                onBack={() => navigate({ kind: "threshold" })}
                onSaved={() => navigate({ kind: "threshold" })}
              />
            );
        }
      })()}
    </Suspense>
  );
}

function LoadingScreen() {
  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        "min-height": "100vh",
        color: "var(--color-text-secondary)",
        "font-family": "var(--font-ui)",
      }}
    >
      Kindling...
    </div>
  );
}
