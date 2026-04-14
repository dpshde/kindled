import type { Reactive } from "@arrow-js/core";
import type { AppScreen } from "./app-screen";

export type AppRootModel = Reactive<{
  screen: AppScreen;
  passageReloadTick: number;
}>;
