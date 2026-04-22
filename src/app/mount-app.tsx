import { render } from "solid-js/web";
import {
  type AppScreen,
  initialAppScreenFromShareRef,
  normalizeAppScreen,
} from "./app-screen";
import { consumeShareRefFromWindow } from "../navigation/share-deep-link";
import { createAppModel } from "./app-model";
import { RenderRoot } from "./render-root";

export function mountApp(root: HTMLElement) {
  const app = createAppModel(
    normalizeAppScreen(
      initialAppScreenFromShareRef(consumeShareRefFromWindow()),
    ),
  );

  const navigate = (s: AppScreen) => {
    app.setScreen(normalizeAppScreen(s));
  };

  render(() => <RenderRoot app={app} navigate={navigate} />, root);
}
