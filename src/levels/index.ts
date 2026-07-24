/**
 * Level loading + registry.
 *
 * A "level" is just data (see types.ts Level). To add a new scenario (landing
 * stage, river with flow, other boats, etc.) you:
 *   1. add a JSON file under src/levels/, OR push a Level object into `LEVELS`,
 *   2. (if JSON) import and register it below.
 * The engine and rules are scenario-agnostic, so no code changes are needed.
 */

import type { Level } from "../types";
import openWaterPoc from "./open-water-poc.json";

// JSON imports need a module declaration; see src/vite-env.d.ts / tsconfig.
const openWater = openWaterPoc as Level;

/** Registry of all available levels. Order here = order shown in a level menu. */
export const LEVELS: Level[] = [openWater];

export function getLevel(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function defaultLevel(): Level {
  return LEVELS[0];
}
