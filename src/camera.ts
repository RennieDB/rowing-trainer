/**
 * Top-down follow camera. World is north-up; the camera tracks the boat with a
 * small lead in the direction of travel/heading and smooths the motion.
 *
 * The camera only affects RENDER. Physics stays in world coordinates. To add a
 * "boat-relative" (boat always points up) mode later, you'd rotate the world
 * transform here — physics and input are untouched.
 */

import { CAMERA } from "./config";
import type { BoatState } from "./types";

export class Camera {
  /** Camera centre in world space (m). */
  cx: number;
  cy: number;
  ppm = CAMERA.pixelsPerMetre;

  constructor(startX: number, startY: number) {
    this.cx = startX;
    this.cy = startY;
  }

  /** Smoothly follow the boat each sim step. */
  follow(boat: BoatState) {
    const leadX = Math.cos(boat.theta) * CAMERA.lead;
    const leadY = Math.sin(boat.theta) * CAMERA.lead;
    const targetX = boat.x + leadX;
    const targetY = boat.y + leadY;
    this.cx += (targetX - this.cx) * CAMERA.follow;
    this.cy += (targetY - this.cy) * CAMERA.follow;
  }

  /** Convert a world point to screen pixels given the canvas size. */
  worldToScreen(
    wx: number,
    wy: number,
    viewW: number,
    viewH: number
  ): [number, number] {
    const sx = viewW / 2 + (wx - this.cx) * this.ppm;
    const sy = viewH / 2 + (wy - this.cy) * this.ppm;
    return [sx, sy];
  }
}
