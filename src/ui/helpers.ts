import type { LifeStage } from "../db";
import { theme } from "./theme";

export function stageColor(stage: LifeStage): string {
  return theme.stage[stage].color;
}

export function stageLabel(stage: LifeStage): string {
  return theme.stage[stage].label;
}
