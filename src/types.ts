/**
 * Shared types for the rowing trainer.
 *
 * Key design point: the physics layer consumes an `OarCommand[4]` array that
 * is IDENTICAL regardless of control scheme. The input mapper (input.ts) is
 * the only thing that differs between "simple" and "perOar" control.
 *
 * Oar index mapping (a coxless double, 2x):
 *   0 = rower A, port (stroke side, left)
 *   1 = rower A, starboard (bow side, right)
 *   2 = rower B, port
 *   3 = rower B, starboard
 *
 * In the PoC "simple" scheme these are driven in pairs by the mapper, but the
 * physics never needs to know that.
 */

export interface OarCommand {
  /** Is this oar engaged (rower pulling) this frame? */
  engaged: boolean;
  /** Continuous effort 0..1 (for analogue input / gamepad later). */
  power: number;
  /** True = backing down (reverse drive). */
  reverse: boolean;
  /**
   * True = blade squared and held in the water (no propulsion). Applies drag
   * at the oar (a real "checking" force) by braking the boat's motion at that
   * oar's position. Distinct from feathered idle (oar out of water, no drag).
   */
  hold: boolean;
}

export type OarCommands = [OarCommand, OarCommand, OarCommand, OarCommand];

export interface BoatState {
  /** World position (m). +x east, +y south (canvas/world space, north-up). */
  x: number;
  y: number;
  /** Heading (rad). 0 = bow pointing +x (east). */
  theta: number;
  /** Linear velocity (m/s). */
  vx: number;
  vy: number;
  /** Angular velocity (rad/s). */
  omega: number;
  /** Per-oar stroke phase clock (0..1 within a cycle) for animation/debug. */
  phase: [number, number, number, number];
}

export interface Gate {
  x: number;
  y: number;
  /** Gate width / opening span (m). */
  width: number;
  /** Gate orientation (rad). 0 = gate line perpendicular to +x (a N-S gap). */
  angle: number;
  /** Optional label shown in HUD. */
  label?: string;
}

export interface Level {
  id: string;
  name: string;
  /** World bounds (m). Camera may scroll beyond for lead, but boat is clamped. */
  bounds: { w: number; h: number };
  start: { x: number; y: number; heading: number };
  /** Constant river flow velocity field (m/s). 0,0 = still water. */
  flow?: { vx: number; vy: number };
  /** Wind: applied as a force on the above-water profile (m/s speed + dir rad). */
  wind?: { speed: number; dir: number };
  gates: Gate[];
  /** Out-of-bounds is the area outside bounds (rendered as shore). */
  obstacles?: { x: number; y: number; r: number }[];
}

export interface InputState {
  /** Four oar commands, resolved by the active control scheme. */
  oars: OarCommands;
  /** True if the player is using a gamepad this frame. */
  usingGamepad: boolean;
}
