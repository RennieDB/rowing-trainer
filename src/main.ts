/**
 * Entry point: fixed-timestep game loop.
 *
 * Loop structure (decouples physics from render for stability + determinism):
 *   - accumulate real frame time
 *   - while accumulator >= dt: sample input, step physics, update scenario
 *   - render the latest state
 *
 * App states:
 *   - "menu"   : landing overlay shown; sim not running.
 *   - "playing": sim steps; no overlay.
 *   - "paused" : sim frozen; pause overlay shown.
 *
 * Determinism note: physics runs at a fixed dt with frame-independent inputs,
 * so a given input sequence always yields the same boat path. That matters
 * later for server-side leaderboard validation (replay inputs through this sim).
 */

import { SIM, RENDER } from "./config";
import { stepBoat, makeBoat } from "./physics";
import { InputManager } from "./input";
import { Camera } from "./camera";
import { Renderer } from "./render";
import { defaultLevel } from "./levels";
import { initScenario, updateScenario, type ScenarioState } from "./scenario";
import type { BoatState, InputState } from "./types";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLDivElement;
const resetBtn = document.getElementById("reset") as HTMLButtonElement | null;
const menuEl = document.getElementById("menu") as HTMLDivElement;
const pauseEl = document.getElementById("pause") as HTMLDivElement;
const launchBtn = document.getElementById("launch") as HTMLButtonElement;
const resumeBtn = document.getElementById("resume") as HTMLButtonElement;
const restartBtn = document.getElementById("restart") as HTMLButtonElement;
const menuBtn = document.getElementById("menuBtn") as HTMLButtonElement;

const level = defaultLevel();
let boat: BoatState = makeBoat(level);
const cam = new Camera(level.start.x, level.start.y);
const input = new InputManager();
const renderer = new Renderer(canvas);
let scenario: ScenarioState = initScenario(level);

type AppState = "menu" | "playing" | "paused";
let state: AppState = "menu";

let lastInput: InputState = {
  oars: [
    { engaged: false, power: 0, reverse: false, hold: false },
    { engaged: false, power: 0, reverse: false, hold: false },
    { engaged: false, power: 0, reverse: false, hold: false },
    { engaged: false, power: 0, reverse: false, hold: false },
  ],
  usingGamepad: false,
};

/** Reset the boat to the level start pose and clear progress. */
function reset() {
  boat = makeBoat(level);
  cam.cx = level.start.x;
  cam.cy = level.start.y;
  scenario = initScenario(level);
  for (const o of lastInput.oars) {
    o.engaged = false;
    o.power = 0;
    o.reverse = false;
    o.hold = false;
  }
}

/** Begin play from the menu (or after a restart). */
function launch() {
  menuEl.hidden = true;
  pauseEl.hidden = true;
  state = "playing";
  last = performance.now();
  acc = 0;
}

/** Pause the sim (from playing only). */
function pause() {
  if (state !== "playing") return;
  state = "paused";
  pauseEl.hidden = false;
}

/** Resume from pause. */
function resume() {
  if (state !== "paused") return;
  state = "playing";
  pauseEl.hidden = true;
  last = performance.now();
  acc = 0;
}

/** Return to the landing menu. */
function toMenu() {
  reset();
  pauseEl.hidden = true;
  menuEl.hidden = false;
  state = "menu";
}

// --- input wiring -----------------------------------------------------------
// Reset: R key and the on-screen button.
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "r") reset();
  else if (k === "escape" || k === "p") {
    if (state === "playing") pause();
    else if (state === "paused") resume();
  } else if (e.key === "Enter" && state === "menu") launch();
});
resetBtn?.addEventListener("click", reset);
launchBtn.addEventListener("click", launch);
resumeBtn.addEventListener("click", resume);
restartBtn.addEventListener("click", () => {
  reset();
  resume();
});
menuBtn.addEventListener("click", toMenu);

let last = performance.now();
let acc = 0;

function nextTarget(): { x: number; y: number } | null {
  if (scenario.complete) return null;
  const g = level.gates[scenario.nextGate];
  return g ? { x: g.x, y: g.y } : null;
}

function frame(now: number) {
  let frameTime = (now - last) / 1000;
  last = now;
  if (frameTime > 0.25) frameTime = 0.25; // tab-switch guard

  if (state === "playing") {
    acc += frameTime;
    let steps = 0;
    while (acc >= SIM.dt && steps < SIM.maxStepsPerFrame) {
      lastInput = input.sample();
      stepBoat(boat, lastInput.oars, level, SIM.dt);
      cam.follow(boat);
      scenario = updateScenario(scenario, boat);
      acc -= SIM.dt;
      steps++;
    }
  }

  // Always render so the boat is visible behind the menu; only step when playing.
  renderer.draw(boat, level, cam, RENDER.debug, lastInput.oars, nextTarget());
  updateHud();

  requestAnimationFrame(frame);
}

function updateHud() {
  const speed = Math.hypot(boat.vx, boat.vy);
  const o = lastInput.oars;
  const tag = (i: number) =>
    o[i].hold ? "HOLD" : o[i].engaged ? (o[i].reverse ? "BACK" : "ROW") : "·";
  hud.textContent =
    `Level: ${level.name}\n` +
    `Speed: ${speed.toFixed(2)} m/s\n` +
    `Heading: ${((boat.theta * 180) / Math.PI).toFixed(0)}°\n` +
    `Gates: ${scenario.passed}/${level.gates.length}` +
    (scenario.complete ? "  COMPLETE" : "") +
    `\nOars  P:${tag(0)} S:${tag(1)}  (row/hold/back)\n` +
    `Keys  Q row A hold Z back (port)\n` +
    `      W row S hold X back (stbd)\n` +
    `      R reset  P/Esc pause`;
}

requestAnimationFrame(frame);
