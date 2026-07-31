/**
 * Canvas renderer. Draws water, world grid, gates, the boat (with bow
 * indicator + oar animation), and an optional debug overlay of force/velocity
 * vectors. Pure draw code — no game logic.
 *
 * Coordinate transform: world (north-up, +x east, +y south) -> screen via the
 * Camera. The camera handles world-to-screen conversion and optional
 * boat-relative rotation. This renderer always draws in screen space.
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

    // NO canvas rotation here. The camera's worldToScreen handles all
    // coordinate transformation, including boat-relative rotation.

    // Water background
    ctx.fillStyle = RENDER.water;
    ctx.fillRect(0, 0, vw, vh);

    // Draw world elements (camera handles rotation internally)
    this.drawGrid(cam, vw, vh, boat.theta);
    this.drawShore(level, cam, vw, vh, boat.theta);
    for (const g of level.gates) {
      this.drawGate(g, cam, vw, vh, boat.theta);
    }

    // Draw boat
    this.drawBoat(boat, cam, vw, vh, oars);

    // Debug vectors
    if (debug) this.drawDebug(boat, cam, vw, vh);

    // Draw target indicator
    if (target) this.drawTargetIndicator(boat, cam, vw, vh, target);
  }

  private drawGrid(cam: Camera, vw: number, vh: number, boatTheta: number) {
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
      const [sx0, sy0] = cam.worldToScreen(x, top, vw, vh, boatTheta);
      const [sx1, sy1] = cam.worldToScreen(x, bottom, vw, vh, boatTheta);
      ctx.moveTo(sx0, sy0);
      ctx.lineTo(sx1, sy1);
    }
    for (let y = startY; y <= bottom; y += step) {
      const [sx0, sy0] = cam.worldToScreen(left, y, vw, vh, boatTheta);
      const [sx1, sy1] = cam.worldToScreen(right, y, vw, vh, boatTheta);
      ctx.moveTo(sx0, sy0);
      ctx.lineTo(sx1, sy1);
    }
    ctx.stroke();
  }

  private drawShore(level: Level, cam: Camera, vw: number, vh: number, boatTheta: number) {
    // In boat-relative mode, the shore fills are drawn at rotated world
    // positions as axis-aligned screen rectangles. These are 10000m+ wide
    // and sweep across the viewport at certain heading angles, hiding the
    // grid. Since the shore is already invisible in the normal viewport
    // (it sits outside the level bounds, far from the boat), just skip it.
    if (cam.mode === CamMode.BOAT_RELATIVE) return;
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
      const [sx, sy] = cam.worldToScreen(x, y, vw, vh, boatTheta);
      ctx.fillRect(sx, sy, w * cam.ppm, h * cam.ppm);
    }
  }

  private drawGate(
    g: { x: number; y: number; width: number; angle: number; label?: string },
    cam: Camera,
    vw: number,
    vh: number,
    boatTheta: number
  ) {
    const ctx = this.ctx;
    const [sx, sy] = cam.worldToScreen(g.x, g.y, vw, vh, boatTheta);
    const half = (g.width / 2) * cam.ppm;
    // In boat-relative mode, rotate the gate angle so its orientation
    // matches the rotated world view.
    const screenAngle = cam.mode === CamMode.BOAT_RELATIVE ? g.angle - boatTheta : g.angle;
    const dx = Math.cos(screenAngle + Math.PI / 2);
    const dy = Math.sin(screenAngle + Math.PI / 2);
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

  private drawBoat(
    boat: BoatState,
    cam: Camera,
    vw: number,
    vh: number,
    oars: OarCommands
  ) {
    const ctx = this.ctx;
    const [sx, sy] = cam.worldToScreen(boat.x, boat.y, vw, vh, 0);
    const L = BOAT.length * cam.ppm;
    const W = BOAT.beam * cam.ppm;

    ctx.save();
    ctx.translate(sx, sy);

    // In north-up mode: rotate the boat sprite to show its heading.
    // In boat-relative mode: the boat always points up on screen (the world
    // rotates around it), so no sprite rotation.
    if (cam.mode !== CamMode.BOAT_RELATIVE) {
      ctx.rotate(boat.theta);
    }

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
    {
      ctx.lineWidth = 2;
      const stations = [2.5, -2.5];
      const oarLen = BOAT.oarOutboard * cam.ppm;
      const sweepArc = 0.9;
      for (let i = 0; i < 4; i++) {
        const rower = i < 2 ? 0 : 1;
        const side = i % 2 === 0 ? -1 : 1;
        const px = stations[rower] * cam.ppm;
        const py = side * BOAT.riggerSpread * cam.ppm;

        const oar = oars[i];
        if (!oar.engaged || oar.power <= 0) {
          ctx.strokeStyle = "rgba(255,255,255,0.30)";
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + side * oarLen * 0.15, py + side * oarLen);
          ctx.stroke();
          continue;
        }
        if (oar.hold) {
          ctx.strokeStyle = "rgba(255,210,120,0.95)";
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, py + side * oarLen);
          ctx.stroke();
          continue;
        }

        const dir = oar.reverse ? -1 : 1;
        const ang = Math.sin(boat.phase[i] * Math.PI * 2) * sweepArc * dir;
        const bx = px + oarLen * Math.sin(ang);
        const by = py + side * oarLen * Math.cos(ang);
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(bx, by);
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
    const [bx, by] = cam.worldToScreen(boat.x, boat.y, vw, vh, boat.theta);
    const [tx, ty] = cam.worldToScreen(target.x, target.y, vw, vh, boat.theta);
    const dx = tx - bx;
    const dy = ty - by;
    const dist = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);

    const ring = Math.min(70, Math.max(40, dist * 0.4));

    const mx = bx + Math.cos(ang) * ring;
    const my = by + Math.sin(ang) * ring;

    ctx.strokeStyle = "rgba(91,192,190,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(bx, by, ring, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(ang);
    ctx.fillStyle = RENDER.gate;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -7);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

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
    const [sx, sy] = cam.worldToScreen(boat.x, boat.y, vw, vh, boat.theta);

    // Velocity vector (world coords — rotate for boat-relative view)
    let velDx = boat.vx * cam.ppm * 2;
    let velDy = boat.vy * cam.ppm * 2;
    // Heading direction (world coords — rotate for boat-relative view)
    let headDx = Math.cos(boat.theta) * 30;
    let headDy = Math.sin(boat.theta) * 30;

    if (cam.mode === CamMode.BOAT_RELATIVE) {
      const cos = Math.cos(-boat.theta);
      const sin = Math.sin(-boat.theta);
      const rvx = velDx * cos - velDy * sin;
      const rvy = velDx * sin + velDy * cos;
      velDx = rvx;
      velDy = rvy;
      const rhx = headDx * cos - headDy * sin;
      const rhy = headDx * sin + headDy * cos;
      headDx = rhx;
      headDy = rhy;
    }

    ctx.strokeStyle = "#ff5555";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + velDx, sy + velDy);
    ctx.stroke();
    ctx.strokeStyle = "#55ff55";
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + headDx, sy + headDy);
    ctx.stroke();
  }
}