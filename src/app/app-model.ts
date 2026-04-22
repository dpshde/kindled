import { createSignal } from "solid-js";
import type { AppScreen } from "./app-screen";

export type AppRootModel = {
  screen: () => AppScreen;
  setScreen: (s: AppScreen) => void;
  passageReloadTick: () => number;
  bumpPassageReload: () => void;
};

export function createAppModel(initial: AppScreen): AppRootModel {
  const [screen, setScreen] = createSignal(initial);
  const [passageReloadTick, setTick] = createSignal(0);
  return {
    screen,
    setScreen: (s: AppScreen) => setScreen(s),
    passageReloadTick,
    bumpPassageReload: () => setTick((t) => t + 1),
  };
}
