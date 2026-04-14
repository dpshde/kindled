import { html, type ArrowTemplate } from "@arrow-js/core";
import {
  type AppScreen,
  noteScreenFromPassageAction,
  screenAfterBeginKindling,
  screenAfterKindlingAdvance,
} from "./app-screen";
import type { AppRootModel } from "./app-model";
import { hearthView } from "../hearth/hearth-view";
import { passageView } from "../hearth/passage-view";
import { noteCaptureView } from "../capture/note-capture-view";
import { scriptureCaptureView } from "../capture/scripture-capture-view";
import { quietCloseView } from "../ritual/quiet-close-view";
import { thresholdView } from "../ritual/threshold-view";

export type RootContext = {
  app: AppRootModel;
  navigate: (s: AppScreen) => void;
  bumpPassageReload: () => void;
};

export function renderRoot(ctx: RootContext): ArrowTemplate {
  const s = ctx.app.screen;
  switch (s.kind) {
    case "threshold":
      return thresholdScreen(ctx);
    case "quietClose":
      return quietCloseScreen(ctx);
    case "library":
      return libraryScreen(ctx);
    case "capture":
      return captureScreen(ctx, s.initialRef);
    case "note":
      return noteScreen(ctx, s);
    case "passage":
      return passageScreen(ctx, s);
  }
}

function thresholdScreen(ctx: RootContext): ArrowTemplate {
  return thresholdView({
    onBegin: (ids) => {
      const next = screenAfterBeginKindling(ids);
      if (next) ctx.navigate(next);
    },
    onLibrary: () => ctx.navigate({ kind: "library" }),
    onCapture: () => ctx.navigate({ kind: "capture" }),
  });
}

function quietCloseScreen(ctx: RootContext): ArrowTemplate {
  return quietCloseView({
    onClose: () => ctx.navigate({ kind: "threshold" }),
  });
}

function libraryScreen(ctx: RootContext): ArrowTemplate {
  return hearthView({
    onBack: () => ctx.navigate({ kind: "threshold" }),
    onCapture: () => ctx.navigate({ kind: "capture" }),
    onSelect: (passageId) => ctx.navigate({ kind: "passage", passageId }),
  });
}

function captureScreen(ctx: RootContext, initialRef?: string): ArrowTemplate {
  return scriptureCaptureView({
    initialRef,
    onBack: () => ctx.navigate({ kind: "threshold" }),
    onSaved: () => ctx.navigate({ kind: "threshold" }),
  });
}

function noteScreen(
  ctx: RootContext,
  s: Extract<AppScreen, { kind: "note" }>,
): ArrowTemplate {
  const back =
    s.returnToPassageId !== undefined
      ? () => {
          ctx.bumpPassageReload();
          ctx.navigate({ kind: "passage", passageId: s.returnToPassageId! });
        }
      : () => ctx.navigate({ kind: "threshold" });
  return noteCaptureView({
    passageId: s.passageId,
    displayRef: s.displayRef,
    reflectionId: s.reflectionId,
    onBack: back,
    onSaved: back,
  });
}

function passageScreen(
  ctx: RootContext,
  s: Extract<AppScreen, { kind: "passage" }>,
): ArrowTemplate {
  if (!s.passageId) {
    ctx.navigate({ kind: "threshold" });
    return html``;
  }
  const inKindling = !!s.kindling;
  const kindlingProgress = s.kindling
    ? { index: s.kindling.index, total: s.kindling.queueIds.length }
    : undefined;
  return passageView({
    app: ctx.app,
    passageId: s.passageId,
    kindlingProgress,
    onKindlingAdvance: inKindling
      ? () => {
          const next = screenAfterKindlingAdvance(ctx.app.screen);
          if (next) ctx.navigate(next);
        }
      : undefined,
    onBack: () =>
      ctx.navigate(inKindling ? { kind: "threshold" } : { kind: "library" }),
    onNavigate: inKindling
      ? () => {}
      : (passageId) => ctx.navigate({ kind: "passage", passageId }),
    onDeleted: () =>
      ctx.navigate(inKindling ? { kind: "threshold" } : { kind: "library" }),
    onNote: (opts) =>
      ctx.navigate(noteScreenFromPassageAction(inKindling, opts)),
  });
}
