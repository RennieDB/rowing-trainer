/**
 * Scenario rules: gate detection, pass counting, win condition.
 *
 * Kept separate from physics & render so new courses reuse the same evaluation
 * and only supply data. A "pass" = the boat centre crosses the gate opening
 * while moving in the intended direction (through the gap, not around it).
 *
 * For the PoC we detect a pass simply: boat enters the gate's opening radius
 * (within width/2 of the gate centre, along the gate's normal axis). This is
 * intentionally simple; later you can require correct transit direction.
 */

import type { BoatState, Gate, Level } from "./types";

export interface ScenarioState {
  level: Level;
  /** Index of the next gate the player must reach, in order. */
  nextGate: number;
  /** Total gates passed. */
  passed: number;
  /** True once all gates are passed. */
  complete: boolean;
}

export function initScenario(level: Level): ScenarioState {
  return { level, nextGate: 0, passed: 0, complete: false };
}

/**
 * Update scenario given the boat. Mutates and returns the state.
 * Call once per sim step (or per frame — cheap).
 */
export function updateScenario(s: ScenarioState, boat: BoatState): ScenarioState {
  if (s.complete) return s;
  const gate = s.level.gates[s.nextGate];
  if (!gate) {
    s.complete = true;
    return s;
  }
  if (boatInsideGate(boat, gate)) {
    s.passed++;
    s.nextGate++;
    if (s.nextGate >= s.level.gates.length) s.complete = true;
  }
  return s;
}

/** Is the boat centre within the gate opening? */
export function boatInsideGate(boat: BoatState, gate: Gate): boolean {
  const dx = boat.x - gate.x;
  const dy = boat.y - gate.y;
  // gate normal axis (direction of travel through the gate)
  const nx = Math.cos(gate.angle);
  const ny = Math.sin(gate.angle);
  // distance along normal (how far through the gate plane)
  const along = dx * nx + dy * ny;
  // distance perpendicular (must be within width/2 to be "in the gap")
  const perp = Math.abs(dx * -ny + dy * nx);
  return Math.abs(along) < 1.5 && perp < gate.width / 2;
}
