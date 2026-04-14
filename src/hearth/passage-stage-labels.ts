import type { LifeStage } from "../db/types";

export const PASSAGE_STAGE_LABEL: Record<LifeStage, string> = {
  spark: "Spark",
  flame: "Flame",
  steady: "Steady",
  ember: "Ember",
};
