/**
 * Central tunables for the rowing trainer.
 *
 * Everything that affects "feel" lives here so it can be tuned without
 * touching physics or render code. Units: metres, seconds, radians.
 *
 * The boat is modelled as a rigid body. Length ~9.5 m (a coxless double / 2x).
 * World is north-up: +x = east, +y = south (canvas convention). Heading theta
 * is measured the same way (0 = bow pointing east, +π/2 = bow south,
 * -π/2 (≈ -1.5708) = bow NORTH / up). Render rotates by theta; physics stays in
 * world space. The PoC level starts at heading -π/2 (facing north) so port
 * oars render screen-left and starboard screen-right, matching the controls.
 */

export const SIM = {
  /** Fixed simulation timestep (seconds). Physics is decoupled from render. */
  dt: 1 / 60,
  /** Max sim steps per frame (spiral-of-death guard). */
  maxStepsPerFrame: 5,
} as const;

export const BOAT = {
  /** Mass of boat + 2 rowers (kg). */
  mass: 120,
  /** Hull length (m). */
  length: 10,
  /** Hull beam / width (m). */
  beam: 0.5,
  /**
   * Moment of inertia about the centre of mass (kg·m²).
   * Approximated as a slender rod: (1/12)·m·L². Rowers near centre reduce it
   * slightly in reality; this is a fine starting value.
   */
  inertia: (120 * 9.5 * 9.5) / 12,
  /**
   * Oar offset from centreline (m) — the LEVER ARM that turns oar force into
   * yaw torque. This is the distance from the hull centreline to the BLADE in
   * the water (~oarOutboard ≈ 1.9 m for a 2x), NOT the rigger pivot (≈0.35 m).
   * Using the rigger offset makes the boat nearly impossible to spin (real
   * doubles turn ~180° in 6-7 strokes of row-on/back-down); the blade lever
   * gives realistic turning. Same constant drives hold-drag torque, so a
   * squared blade also checks/yaws harder (correct).
   */
  oarOffset: 1.9,
  /**
   * VISUAL rigger-pin spread from centreline (m) — ONLY used by the renderer to
   * pin the oars to the hull edge. This is NOT the physics lever arm (`oarOffset`,
   * which is the blade reach ~1.9 m). The real rigger pin sits ~0.5 m off the
   * centreline; using oarOffset for the visual would fling the oars off the hull
   * and onto the target-indicator ring. Keep this small and hull-relative.
   */
  riggerSpread: 0.5,
  /**
   * Oar inboard length (m) — handle-to-pivot. Real 2x ≈ 0.88 m. Reference for
   * gearing; the force model applies at the pivot so this is cosmetic/educational.
   */
  oarInboard: 0.88,
  /**
   * Oar outboard length (m) — pivot-to-blade-tip. Real 2x overall ~2.86 m minus
   * ~0.88 m inboard ≈ 1.98 m. This is the DRAWN oar length (scaled by ppm) and
   * the real blade reach from the rigger. NOTE: the physics lever arm is the
   * separate `oarOffset` constant (kept small for the calibrated turn feel); if
   * you want the true ~2.3 m blade lever to drive turning, raise oarOffset and
   * re-tune dragAngular*.
   */
  oarOutboard: 1.98,
  /**
   * Oar overall length (m) for reference (inboard + outboard ≈ 2.86 m).
   */
  oarOverall: 2.86,
  /**
   * Longitudinal (fore-aft) quadratic drag coefficient. The hull glides easily
   * ahead, so this is LOW. Calibrated for ~5 m/s top speed: 4 oars at
   * peakForce 45 N give ~175 N net forward thrust; quadratic drag force is
   * k·v², so at v=5 m/s we need k·25 ≈ 175 → k ≈ 7.
   */
  dragLongitudinal: 7.0,
  /**
   * Lateral (sideways) drag coefficient. VERY HIGH: a 10 m slender hull
   * essentially cannot move sideways — its length in the water makes skidding
   * resist ~15-50× more than fore-aft glide. THIS is what makes it feel like a
   * boat rather than a puck. Set ~15× the longitudinal coeff.
   */
  dragLateral: 100,
  /**
   * Linear longitudinal drag — gentle, so the hull coasts then comes to rest
   * (quadratic alone only asymptotes). Small relative to the quadratic term.
   */
  dragLongitudinalLin: 4.0,
  /**
   * Linear lateral drag — kills residual sideways creep at low speed (quadratic
   * alone decays slowly near v=0). Keeps the boat from drifting sideways.
   */
  dragLateralLin: 10,
  /**
   * Quadratic angular drag coefficient (resists spinning, scales with ω²).
   * Minor compared to the linear term below.
   */
  dragAngular: 20,
  /**
   * Linear angular drag coefficient — THE primary yaw resistance, applied as a
   * torque and divided by INERTIA (not mass). A long thin hull levers hard
   * against the water, so yaw decays fast once rowing stops. Time constant
   * τ ≈ inertia / dragAngularLin ≈ 902.5/1300 ≈ 0.7 s. Tuned (with oarOffset
   * moved out to the blade ~1.9 m) so the boat spins ~180° in 6-7 strokes of
   * row-on/back-down yet still stops yawing within ~3 s once oars are released.
   */
  dragAngularLin: 1300,
  /**
   * "Hold" resistance: a squared blade held in the water brakes the boat's
   * motion at that oar's pivot (quadratic point drag, with torque). Models a
   * real "checking" stroke. Larger = stronger check.
   */
  holdDrag: 200,
  /**
   * Linear hold drag — kills the low-speed tail that pure quadratic drag
   * produces (F = k·v² → 0 as v→0). A squared blade in water still has
   * viscous resistance at very low speeds; this term handles it.
   */
  holdDragLin: 80,
} as const;

export const STROKE = {
  /**
   * Peak drive force per oar during the power phase (N). A 2x has 4 oars; all
   * rowing forward gives ~2× this as net thrust (the lateral components cancel,
   * the forward components add). 45 N/oar → ~90 N thrust → top speed ~5 m/s
   * with the tuned dragLongitudinal. Tune together with drag.
   */
  peakForce: 45,
  /**
   * Fraction of the stroke cycle spent in the drive (power) phase.
   * e.g. 0.45 = 45% drive, 55% recovery (no force, feathering return).
   */
  driveFraction: 0.45,
  /**
   * Full stroke cycle period at "full effort" taps (seconds). A real stroke
   * rate is ~2 s/stroke; this is the model's nominal cycle when engaged.
   */
  cyclePeriod: 1.6,
  /**
   * Small angle (rad) by which the applied oar force is tilted off the hull
   * axis, modeling blade angle of attack / "finishing" the stroke. The drive is
   * primarily forward (local +x); this adds a minor lateral component. Keep
   * small (≈0.2-0.3) so straight rowing stays straight and turning comes from
   * side imbalance, not from this.
   */
  bladeAngle: 0.25,
} as const;

/**
 * Control scheme.
 *  - "simple": WASD — both forward / both back / one-side turn (legacy PoC).
 *  - "sideBySide": per-side 3-state — port and starboard each independently
 *    row-on / hold / back-down, both rowers' same-side oars driven together.
 *    This is the current PoC control (see input.ts for the key map).
 *  - "perOar": full independent 4-oar control (the learning goal, not yet wired).
 * The physics layer consumes the SAME OarCommand[4] regardless; only the input
 * mapper differs. Flip this to change feel without touching physics.
 */
export const CONTROL = {
  scheme: "sideBySide" as "simple" | "sideBySide" | "perOar",
  /** Whether reverse (backing down) is available in the current scheme. */
  allowReverse: true,
} as const;

export const CAMERA = {
  /** Pixels per metre at zoom 1. Higher = more zoomed in on the boat. */
  pixelsPerMetre: 22,
  /** Camera smoothing factor (0..1 per sim step; higher = snappier). */
  follow: 0.12,
  /** How far ahead of the boat the camera leads, in boat-heading direction (m). */
  lead: 2.5,
} as const;

export const RENDER = {
  /** Water background colour. */
  water: "#0e2a3a",
  /** Shoreline / out-of-bounds tint. */
  shore: "#14323f",
  /** Boat hull colour. */
  hull: "#f4d35e",
  /** Gate colour. */
  gate: "#5bc0be",
  /** Show force/torque/velocity debug vectors. */
  debug: true,
} as const;
