/**
 * Physics: a top-down rigid-body model of a coxless double (2x).
 *
 * WHY THIS SHAPE
 * --------------
 * A rowing boat turns because oar force is applied OFFSET from the centreline.
 * Pull port → force points (mostly) starboard-ish but acts at a point to the
 * port side → produces a torque that yaws the bow toward starboard. Both sides
 * together → net torque ≈ 0, boat runs straight. That emergent behaviour is
 * the entire point of the trainer, so the model must capture it honestly.
 *
 * MODEL
 * -----
 * - State: position, heading, linear + angular velocity (see types.ts).
 * - Each engaged oar applies a force F at its pivot (oarOffset off centreline,
 *   at the rower's longitudinal station). Force is perpendicular to the hull
 *   axis, tilted by STROKE.bladeAngle. Reverse flips the force direction.
 * - Forces → linear accel (F/m) and torque (r × F / I).
 * - Drag is ANISOTROPIC: velocity is rotated into hull-local frame; strong
 *   lateral damping, weak longitudinal damping. This makes the hull resist
 *   skidding sideways — the "feels like a boat" trick.
 * - River flow: added as a constant world-space velocity that the boat's drag
 *   acts against (i.e. we compute drag relative to the water, then add flow to
 *   the resulting motion). Simpler & stable: treat flow as a force toward the
 *   flow velocity. We use the relative-velocity drag formulation below.
 *
 * INTEGRATION
 * -----------
 * Semi-implicit Euler at a fixed dt (see SIM.dt). Stable for this stiffness.
 * The caller (main.ts) drives this at a fixed timestep and interpolates for
 * render, so behaviour is deterministic and repeatable (matters for replays /
 * server-side leaderboard validation later).
 */

import { BOAT, STROKE, SIM } from "./config";
import type { BoatState, OarCommands, Level } from "./types";

/** Longitudinal station of each rower along the hull (m from centre, + = bow). */
const ROWER_STATION = [2.5, -2.5]; // rower A near bow, rower B near stern

/**
 * Advance the boat one fixed step.
 * @param boat    mutable boat state (mutated in place)
 * @param oars    four resolved oar commands
 * @param level   current level (for flow/wind/bounds)
 * @param dt      timestep (s) — should equal SIM.dt
 */
export function stepBoat(
  boat: BoatState,
  oars: OarCommands,
  level: Level,
  dt: number = SIM.dt
): void {
  // --- resolve oar force + torque -------------------------------------------
  let fx = 0;
  let fy = 0;
  let torque = 0;

  const cosT = Math.cos(boat.theta);
  const sinT = Math.sin(boat.theta);

  // Local axes: longitudinal (forward, +x local) and lateral (starboard, +y local).
  // Track which oars are actively ROWING (driving) vs holding vs idle, so we
  // can (a) sync phase only for a clean whole-boat stroke and (b) apply hold
  // drag at the oar in the point-force pass below.
  const rowing = oars.filter((o) => o.engaged && !o.hold && o.power > 0);
  const allRowing = rowing.length === 4;
  const sameReverse = oars.every((o) => o.reverse === oars[0].reverse);
  const samePower = oars.every((o) => o.power === oars[0].power);
  // Whole-boat stroke = all 4 driving forward/back together (no holds). Sync
  // their phase so the oars visually move as one. Per-side / hold / per-oar
  // inputs skip this and keep independent phases.
  const wholeBoat = allRowing && sameReverse && samePower;
  if (wholeBoat) {
    const p = (boat.phase[0] + dt / STROKE.cyclePeriod) % 1;
    for (let i = 0; i < 4; i++) boat.phase[i] = p;
  }

  for (let i = 0; i < 4; i++) {
    const oar = oars[i];
    if (!oar.engaged || oar.power <= 0) {
      // Idle oar: feathered, held still (see render.ts). No phase advance.
      continue;
    }
    if (oar.hold) {
      // Holding: blade squared in the water, no propulsion. Phase frozen (the
      // oar sits still). Drag is applied at this oar's pivot in the pass below.
      continue;
    }
    // Driving oar: advance phase (unless already synced as a whole-boat stroke).
    if (!wholeBoat) {
      boat.phase[i] = (boat.phase[i] + dt / STROKE.cyclePeriod) % 1;
    }

    const rower = i < 2 ? 0 : 1; // 0 = rower A, 1 = rower B
    const side = i % 2 === 0 ? -1 : 1; // port = -1 (left), starboard = +1 (right)
    const station = ROWER_STATION[rower];
    const sign = oar.reverse ? -1 : 1;

    // Force magnitude for this stroke (scaled by effort).
    const mag = STROKE.peakForce * oar.power;

    // Local force direction. A rowing stroke's resultant drive is primarily
    // ALONG the hull axis (forward, local +x) — that's what propels the boat.
    // The small lateral component models blade angle of attack / finish, and
    // the oar's OFFSET from the centreline (below) is what creates yaw torque
    // when sides are unbalanced. Reverse flips the drive to back the boat down.
    // Local frame: +x = bow, +y = starboard.
    const lon = sign;                          // dominant forward/back component
    const lat = side * STROKE.bladeAngle;      // small lateral component
    const ln = Math.hypot(lon, lat) || 1;
    const fLocalX = (lon / ln) * mag;
    const fLocalY = (lat / ln) * mag;

    // Rotate local force into world space.
    const wfx = fLocalX * cosT - fLocalY * sinT;
    const wfy = fLocalX * sinT + fLocalY * cosT;
    fx += wfx;
    fy += wfy;

    // Torque = r × F (2D cross product). r = (station, side*oarOffset) in local.
    const rx = station;
    const ry = side * BOAT.oarOffset;
    const wrx = rx * cosT - ry * sinT;
    const wry = rx * sinT + ry * cosT;
    torque += wrx * wfy - wry * wfx;
  }

  // --- "hold" drag: a squared blade held in the water brakes the boat at that
  // oar's pivot. Apply a quadratic drag force opposing the local water velocity
  // at the oar point, and the matching torque. This makes holding one side
  // (e.g. port) check the boat and yaw it — realistic and a useful control.
  for (let i = 0; i < 4; i++) {
    const oar = oars[i];
    if (!oar.hold) continue;
    const rower = i < 2 ? 0 : 1;
    const side = i % 2 === 0 ? -1 : 1;
    const station = ROWER_STATION[rower];
    const ryLocal = side * BOAT.oarOffset;
    // oar pivot world position
    const px = station, py = ryLocal;
    const wrx = px * cosT - py * sinT;
    const wry = px * sinT + py * cosT;
    // velocity of that point = boat vel + omega × r (2D: omega cross r)
    const pvx = boat.vx - boat.omega * wry;
    const pvy = boat.vy + boat.omega * wrx;
    // relative to flow (if any)
    const rvx = pvx - (level.flow ? level.flow.vx : 0);
    const rvy = pvy - (level.flow ? level.flow.vy : 0);
    // local frame
    const lvx = rvx * cosT + rvy * sinT;
    const lvy = -rvx * sinT + rvy * cosT;
    const dLocalX = -BOAT.holdDrag * lvx * Math.abs(lvx) - BOAT.holdDragLin * lvx;
    const dLocalY = -BOAT.holdDrag * lvy * Math.abs(lvy) - BOAT.holdDragLin * lvy;
    const dwx = dLocalX * cosT - dLocalY * sinT;
    const dwy = dLocalX * sinT + dLocalY * cosT;
    fx += dwx;
    fy += dwy;
    torque += wrx * dwy - wry * dwx;
  }

  // --- river flow: handled by the relative-velocity drag above (relVx/relVy
  // use flow as the water frame), so no extra force is needed here. Flow thus
  // gently carries the boat with the current while the hull still resists
  // skidding relative to the water.

  // --- wind: simple force on above-water profile (mostly lateral) -----------
  const wind = level.wind;
  if (wind && wind.speed > 0) {
    const wx = Math.cos(wind.dir) * wind.speed;
    const wy = Math.sin(wind.dir) * wind.speed;
    // wind pushes the boat toward the wind vector; effectiveness modest
    fx += wx * 4;
    fy += wy * 4;
  }

  // --- linear acceleration --------------------------------------------------
  const ax = fx / BOAT.mass;
  const ay = fy / BOAT.mass;

  // --- anisotropic drag (relative to water for flow correctness) -----------
  // Transform velocity into hull-local frame.
  const flow = level.flow;
  const relVx = boat.vx - (flow ? flow.vx : 0);
  const relVy = boat.vy - (flow ? flow.vy : 0);
  const localVx = relVx * cosT + relVy * sinT; // bow-axis component
  const localVy = -relVx * sinT + relVy * cosT; // starboard-axis component

  // Longitudinal: quadratic (glides) + small linear (coasts to rest). LOW — the
  // hull slips ahead easily, this is the "doesn't resist forward motion" axis.
  const dragLocalX =
    -BOAT.dragLongitudinal * localVx * Math.abs(localVx) -
    BOAT.dragLongitudinalLin * localVx;
  // Lateral: VERY HIGH quadratic + linear. A long thin hull can barely move
  // sideways — its length in the water is massive skid resistance. This is the
  // axis that makes the boat feel like a boat (no sideways drift after a stroke).
  const dragLocalY =
    -BOAT.dragLateral * localVy * Math.abs(localVy) -
    BOAT.dragLateralLin * localVy;

  // Rotate drag back to world and apply as acceleration.
  const dragWX = dragLocalX * cosT - dragLocalY * sinT;
  const dragWY = dragLocalX * sinT + dragLocalY * cosT;
  const axDrag = dragWX / BOAT.mass;
  const ayDrag = dragWY / BOAT.mass;

  // --- angular: torque + angular drag ---------------------------------------
  // Angular drag is a TORQUE, so it is divided by INERTIA (not mass). The
  // linear term is the dominant yaw resistance: a long hull levers hard against
  // the water, so yaw bleeds off fast (time constant τ ≈ I / dragAngularLin ≈
  // 0.5 s) once oar input stops. Quadratic term adds high-speed spin damping.
  const alpha = torque / BOAT.inertia;
  const omegaDrag =
    (-BOAT.dragAngularLin * boat.omega -
      BOAT.dragAngular * boat.omega * Math.abs(boat.omega)) /
    BOAT.inertia;

  // --- semi-implicit Euler --------------------------------------------------
  boat.vx += (ax + axDrag) * dt;
  boat.vy += (ay + ayDrag) * dt;
  boat.omega += (alpha + omegaDrag) * dt;

  boat.x += boat.vx * dt;
  boat.y += boat.vy * dt;
  boat.theta += boat.omega * dt;

  // --- bounds clamp (soft-ish: stop at shore) -------------------------------
  const half = 0.5;
  if (boat.x < half) {
    boat.x = half;
    boat.vx = Math.max(0, boat.vx);
  }
  if (boat.x > level.bounds.w - half) {
    boat.x = level.bounds.w - half;
    boat.vx = Math.min(0, boat.vx);
  }
  if (boat.y < half) {
    boat.y = half;
    boat.vy = Math.max(0, boat.vy);
  }
  if (boat.y > level.bounds.h - half) {
    boat.y = level.bounds.h - half;
    boat.vy = Math.min(0, boat.vy);
  }
}

/** Create an initial boat state from a level's start pose. */
export function makeBoat(level: Level): BoatState {
  return {
    x: level.start.x,
    y: level.start.y,
    theta: level.start.heading,
    vx: 0,
    vy: 0,
    omega: 0,
    phase: [0, 0, 0, 0],
  };
}
