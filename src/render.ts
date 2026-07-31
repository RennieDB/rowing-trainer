/**
 * Canvas renderer. Draws water, world grid, gates, the boat (with bow
 * indicator + oar animation), and an optional debug overlay of force/velocity
 * vectors. Pure draw code — no game logic.
 *
 * Coordinate transform: world (north-up, +x east, +y south) -> screen via the
 * Camera. We rotate the boat sprite by -theta on screen because canvas y is
 * down; theta is measured the same way (0 = +x east) so no flip is needed for
 * rotation, only the y-axis is already consistent.
 */

import { RENDER, BOAT } from "./config";
import type { BoatState, Level, OarCommands } from "./types";
import type { Camera } from "./camera";
import { CamMode } from "./camera";

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.canvas.style.width = window.innerWidth + "px";
    this.canvas.style.height = window.innerHeight + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  get viewW() {
    return window.innerWidth;
  }
  get viewH() {
    return window.innerHeight;
  }

  draw(
    boat: BoatState,
    level: Level,
    cam: Camera,
    debug: boolean,
    oars: OarCommands,
    target: { x: number; y: number } | null
  ) {
    const ctx = this.ctx;
    const vw = this.viewW;
    const vh = this.viewH;

    // Apply camera transformation if in boat-relative mode
    if (cam.mode === CamMode.BOAT_RELATIVE) {
      ctx.save();
      // The rotation is handled in the transformed world functions
    }

    // Water background
    ctx.fillStyle = RENDER.water;
    ctx.fillRect(0, 0, vw, vh);

    // Draw world grid and gates (they are transformed)
    this.drawGridTransformed(cam, vw, vh, cam.mode === CamMode.BOAT_RELATIVE, boat.theta);
    this.drawShoreTransformed(level, cam, vw, vh, cam.mode === CamMode.BOAT_RELATIVE, boat.theta);
    for (const g of level.gates) {
      this.drawGateTransformed(g, cam, vw, vh, cam.mode === CamMode.BOAT_RELATIVE, boat.theta);
    }

    // Draw boat normally (rotation handled by canvas already)
    this.drawBoat(boat, cam, vw, vh, oars);

    // Debug vectors
    if (debug) this.drawDebug(boat, cam, vw, vh);

    // Draw target indicator
    if (target) this.drawTargetIndicator(boat, cam, vw, vh, target);

    // Restore canvas state
    if (cam.mode === CamMode.BOAT_RELATIVE) {
      ctx.restore();
    }
  }

  private drawGridTransformed(cam: Camera, vw: number, vh: number, transformed: boolean, boatTheta: number) {
    const ctx = this.ctx;
    const step = 10;
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    const left = cam.cx - vw / 2 / cam.ppm;
    const right = cam.cx + vw / 2 / cam.ppm;
    const top = cam.cy - vh / 2 / cam.ppm;
    const bottom = cam.cy + vh / 2 / cam.ppm;
    const startX = Math.floor(left / step) * step;
    const startY = Math.floor(top / step) * step;
    ctx.beginPath();
    for (let x = startX; x <= right; x += step) {
      const [sx] = this.transformedWorldToScreen(cam, x, top, vw, vh, transformed, boatTheta);
      const [, sy0] = this.transformedWorldToScreen(cam, x, top, vw, vh, transformed, boatTheta);
      const [, sy1] = this.transformedWorldToScreen(cam, x, bottom, vw, vh, transformed, boatTheta);
      ctx.moveTo(sx, sy0);
      ctx.lineTo(sx, sy1);
    }
    for (let y = startY; y <= bottom; y += step) {
      const [, sy] = this.transformedWorldToScreen(cam, left, y, vw, vh, transformed, boatTheta);
      const [sx0] = this.transformedWorldToScreen(cam, left, y, vw, vh, transformed, boatTheta);
      const [sx1] = this.transformedWorldToScreen(cam, right, y, vw, vh, transformed, boatTheta);
      ctx.moveTo(sx0, sy);
      ctx.lineTo(sx1, sy);
    }
    ctx.stroke();
  }

  private drawShoreTransformed(level: Level, cam: Camera, vw: number, vh: number, transformed: boolean, boatTheta: number) {
    const ctx = this.ctx;
    ctx.fillStyle = RENDER.shore;
    const b = level.bounds;
    const corners = [
      [-10000, -10000, 10000 + b.w, 10000],
      [-10000, b.h, 10000 + b.w, 10000],
      [-10000, 0, 10000, b.h],
      [b.w, 0, 10000, b.h],
    ];
    for (const [x, y, w, h] of corners) {
      const [sx, sy] = this.transformedWorldToScreen(cam, x, y, vw, vh, transformed, boatTheta);
      ctx.fillRect(sx, sy, w * cam.ppm, h * cam.ppm);
    }
  }

  private drawGateTransformed(
    g: { x: number; y: number; width: number; angle: number; label?: string },
    cam: Camera,
    vw: number,
    vh: number,
    transformed: boolean,
    boatTheta: number
  ) {
    const ctx = this.ctx;
    const [sx, sy] = this.transformedWorldToScreen(cam, g.x, g.y, vw, vh, transformed, boatTheta);
    const half = (g.width / 2) * cam.ppm;
    const dx = Math.cos(g.angle + Math.PI / 2);
    const dy = Math.sin(g.angle + Math.PI / 2);
    ctx.strokeStyle = RENDER.gate;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sx - dx * half, sy - dy * half);
    ctx.lineTo(sx + dx * half, sy + dy * half);
    ctx.stroke();
    if (g.label) {
      ctx.fillStyle = RENDER.gate;
      ctx.font = "12px system-ui";
      ctx.fillText(g.label, sx + 6, sy - 6);
    }
  }

  private transformedWorldToScreen(
    cam: Camera,
    wx: number,
    wy: number,
    vw: number,
    vh: number,
    transformed: boolean,
    boatTheta: number
  ): [number, number] {
    let rx = wx - cam.cx;
    let ry = wy - cam.cy;

    if (transformed && cam.mode === CamMode.BOAT_RELATIVE) {
      // Apply rotation based on boat heading
      const cos = Math.cos(-boatTheta);
      const sin = Math.sin(-boatTheta);
      const rotatedX = rx * cos - ry * sin;
      const rotatedY = rx * sin + ry * cos;
      rx = rotatedX;
      ry = rotatedY;
    }

    const sx = vw / 2 + rx * cam.ppm;
    const sy = vh / 2 + ry * cam.ppm;
    return [sx, sy];
  }

  private drawBoat(
    boat: BoatState,
    cam: Camera,
    vw: number,
    vh: number,
    oars: OarCommands
  ) {
    const ctx = this.ctx;
    const [sx, sy] = cam.worldToScreen(boat.x, boat.y, vw, vh);
    const L = BOAT.length * cam.ppm;
    const W = BOAT.beam * cam.ppm;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(boat.theta);

    // hull (long rectangle, bow to +x)
    ctx.fillStyle = RENDER.hull;
    ctx.beginPath();
    ctx.ellipse(0, 0, L / 2, W / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // bow indicator: a clear arrowhead at +x (bow) so orientation is obvious.
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(L / 2 + 4, 0);
    ctx.lineTo(L / 2 - 10, -7);
    ctx.lineTo(L / 2 - 10, 7);
    ctx.closePath();
    ctx.fill();
    // orientation labels (rotate with the hull)
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 9px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("BOW", L / 2 - 2, -2);
    ctx.fillText("STERN", -L / 2 + 4, -2);

    // Oars. A 2x has one oar per rower per side (4 total). Three visual states
    // driven by input:
    //   idle  (not engaged)  -> feathered, blade near-axial, faint, still
    //   hold  (engaged+hold) -> SQUARED, blade perpendicular to hull, static,
    //                           bright (a real "checking" pose in the water)
    //   row   (engaged drive)-> sweeps about the rigger pivot with stroke phase
    // Oars are pinned to the hull edge via the VISUAL riggerSpread (NOT the
    // physics oarOffset lever arm) and drawn in every frame, not just debug.
    {
      ctx.lineWidth = 2;
      const stations = [2.5, -2.5];
      const oarLen = BOAT.oarOutboard * cam.ppm; // real oar length (m) scaled to screen
      const sweepArc = 0.9; // rad of total sweep about the pivot
      for (let i = 0; i < 4; i++) {
        const rower = i < 2 ? 0 : 1;
        const side = i % 2 === 0 ? -1 : 1; // port = -1, starboard = +1
        const px = stations[rower] * cam.ppm;
        const py = side * BOAT.riggerSpread * cam.ppm; // pivot pinned to the hull edge

        const oar = oars[i];
        if (!oar.engaged || oar.power <= 0) {
          // Idle: feathered — blade aligned along the hull, faint, still.
          ctx.strokeStyle = "rgba(255,255,255,0.30)";
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + side * oarLen * 0.15, py + side * oarLen);
          ctx.stroke();
          continue;
        }
        if (oar.hold) {
          // Hold: squared blade in the water = perpendicular to hull, static.
          ctx.strokeStyle = "rgba(255,210,120,0.95)"; // amber = squared/holding
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, py + side * oarLen); // straight out, latched
          ctx.stroke();
          continue;
        }

        // Rowing: sweep about the pivot. Forward rowing drives bow-ward at the
        // catch; backing down (reverse) flips the sweep direction.
        const dir = oar.reverse ? -1 : 1;
        const ang = Math.sin(boat.phase[i] * Math.PI * 2) * sweepArc * dir;
        const bx = px + oarLen * Math.sin(ang);
        const by = py + side * oarLen * Math.cos(ang);
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.moveTo(px, py); // pivot (rigger) — fixed on the hull edge
        ctx.lineTo(bx, by); // blade — sweeps fore/aft about pivot
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawTargetIndicator(
    boat: BoatState,
    cam: Camera,
    vw: number,
    vh: number,
    target: { x: number; y: number }
  ) {
    const ctx = this.ctx;
    const [bx, by] = cam.worldToScreen(boat.x, boat.y, vw, vh);
    // direction (screen space) from boat to target
    const [tx, ty] = cam.worldToScreen(target.x, target.y, vw, vh);
    const dx = tx - bx;
    const dy = ty - by;
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);

    // Ring radius around the boat on screen. If the target is on-screen and
    // close, shrink the ring so the marker sits near it; otherwise keep a fixed
    // orbit so it's always visible pointing the way to go.
    const ring = Math.min(70, Math.max(40, dist * 0.4));

    const mx = bx + Math.cos(ang) * ring;
    const my = by + Math.sin(ang) * ring;

    // faint orbit ring
    ctx.strokeStyle = "rgba(91,192,190,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bx, by, ring, 0, Math.PI * 2);
    ctx.stroke();

    // opaque chevron pointing at the target
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(ang);
    ctx.fillStyle = RENDER.gate; // opaque teal, same family as gates
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -7);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // optional: if target is fully off-screen, also draw a label
    const onScreen = tx >= 0 && tx <= vw && ty >= 0 && ty <= vh;
    if (!onScreen) {
      ctx.fillStyle = RENDER.gate;
      ctx.font = "bold 11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("▶ next", mx, my - 12);
    }
  }

  private drawDebug(boat: BoatState, cam: Camera, vw: number, vh: number) {
    const ctx = this.ctx;
    const [sx, sy] = cam.worldToScreen(boat.x, boat.y, vw, vh);
    // velocity vector
    ctx.strokeStyle = "#ff5555";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + boat.vx * cam.ppm * 2, sy + boat.vy * cam.ppm * 2);
    ctx.stroke();
    // heading vector
    ctx.strokeStyle = "#55ff55";
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(
      sx + Math.cos(boat.theta) * 30,
      sy + Math.sin(boat.theta) * 30
    );
    ctx.stroke();
  }
}
