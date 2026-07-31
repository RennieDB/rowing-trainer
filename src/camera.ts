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

/**
 * Camera mode determines how the world is rendered relative to the boat
 */
export enum CamMode {
  NORTH_UP = "north",
  BOAT_RELATIVE = "boat",
}

export class Camera {
  /** Camera centre in world space (m). */
  cx: number;
  cy: number;
  ppm = CAMERA.pixelsPerMetre;
  mode: CamMode = CamMode.NORTH_UP;

  constructor(startX: number, startY: number) {
    this.cx = startX;
    this.cy = startY;
  }

  /** Smoothly follow the boat each sim step. */
  follow(boat: BoatState) {
    // In boat-relative mode, don't apply lead offset and center instantly
    // In north-up mode, apply lead in boat's heading direction with smoothing
    if (this.mode === CamMode.BOAT_RELATIVE) {
      this.cx = boat.x;
      this.cy = boat.y;
    } else {
      const leadX = Math.cos(boat.theta) * CAMERA.lead;
      const leadY = Math.sin(boat.theta) * CAMERA.lead;
      const targetX = boat.x + leadX;
      const targetY = boat.y + leadY;
      this.cx += (targetX - this.cx) * CAMERA.follow;
      this.cy += (targetY - this.cy) * CAMERA.follow;
    }
  }

  /** Convert a world point to screen pixels given the canvas size. */
  worldToScreen(
    wx: number,
    wy: number,
    viewW: number,
    viewH: number,
    boatTheta: number = 0
  ): [number, number] {
    // First, translate world to camera-relative coordinates
    let rx = wx - this.cx;
    let ry = wy - this.cy;

    // If in boat-relative mode, rotate by -boatTheta so the boat always points up
    if (this.mode === CamMode.BOAT_RELATIVE) {
      const cos = Math.cos(-boatTheta);
      const sin = Math.sin(-boatTheta);
      const rotatedX = rx * cos - ry * sin;
      const rotatedY = rx * sin + ry * cos;
      rx = rotatedX;
      ry = rotatedY;
    }

    // Convert to screen pixels (center of canvas is origin)
    const sx = viewW / 2 + rx * this.ppm;
    const sy = viewH / 2 + ry * this.ppm;
    return [sx, sy];
  }
}
