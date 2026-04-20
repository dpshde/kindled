import { html, reactive } from "@arrow-js/core";
import {
  type AppScreen,
  initialAppScreenFromCaptureRef,
  normalizeAppScreen,
} from "./app-screen";
import { consumeCaptureRefFromWindow } from "../navigation/capture-deep-link";
import { renderRoot } from "./render-root";

export function mountApp(root: HTMLElement) {
  const app = reactive({
    screen: normalizeAppScreen(
      initialAppScreenFromCaptureRef(consumeCaptureRefFromWindow()),
    ),
    passageReloadTick: 0,
  });

  const navigate = (s: AppScreen) => {
    app.screen = normalizeAppScreen(s);
  };

  const bumpPassageReload = () => {
    app.passageReloadTick++;
  };

  html`${() => renderRoot({ app, navigate, bumpPassageReload })}`(root);
}
