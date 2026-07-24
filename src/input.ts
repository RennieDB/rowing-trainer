/**
 * Input layer.
 *
 * The input layer is the ONLY thing that knows about keys/gamepad. It emits an
 * `InputState` whose `oars: OarCommands` is consumed identically by physics
 * regardless of control scheme. This keeps control mapping swappable.
 *
 * SCHEME: "sideBySide" (current PoC)
 *   Per SIDE, three states — row-on / hold / back-down — with port and
 *   starboard independent, and both rowers' same-side oars driven together:
 *
 *     PORT  (oars 0 & 2):  Q = row-on (fwd)   A = hold   Z = back-down
 *     STBD  (oars 1 & 3):  W = row-on (fwd)   S = hold   X = back-down
 *
 *   So you can hold port (A) while rowing starboard on (W) or backing (X), and
 *   vice-versa. The oar animation follows each key's state. Hold = squared
 *   blade in water (drag, no propulsion); idle (no key) = feathered (free).
 *
 * SCHEME: "simple" (legacy) — WASD both-fwd / both-back / one-side turn.
 * SCHEME: "perOar" (future learning goal) — full independent 4-oar control.
 *
 * GAMEPAD (future stub): left/right stick = port/starboard effort; triggers =
 * reverse; a button = hold.
 */

import { CONTROL } from "./config";
import type { InputState, OarCommands, OarCommand } from "./types";

function emptyOars(): OarCommands {
  const z: OarCommand = { engaged: false, power: 0, reverse: false, hold: false };
  return [ { ...z }, { ...z }, { ...z }, { ...z } ];
}

export class InputManager {
  private keys = new Set<string>();
  private usingGamepad = false;
  private gamepadIndex: number | null = null;

  constructor(target: Window = window) {
    target.addEventListener("keydown", (e) => this.onKey(e, true));
    target.addEventListener("keyup", (e) => this.onKey(e, false));
    target.addEventListener("gamepadconnected", (e: GamepadEvent) => {
      this.gamepadIndex = e.gamepad.index;
      this.usingGamepad = true;
    });
    target.addEventListener("gamepaddisconnected", () => {
      this.gamepadIndex = null;
      this.usingGamepad = false;
    });
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    // Normalise to lower-case unmodified key names we use.
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (down) this.keys.add(k);
    else this.keys.delete(k);
  }

  /** Read current input and resolve to oar commands. Call once per frame. */
  sample(): InputState {
    if (this.usingGamepad && this.gamepadIndex !== null) {
      return this.sampleGamepad();
    }
    return this.sampleKeyboard();
  }

  private setOar(
    o: OarCommands,
    idx: number,
    engaged: boolean,
    power = 1,
    reverse = false,
    hold = false
  ) {
    o[idx].engaged = engaged;
    o[idx].power = power;
    o[idx].reverse = reverse;
    o[idx].hold = hold;
  }

  private sampleKeyboard(): InputState {
    const o = emptyOars();
    const k = this.keys;

    if (CONTROL.scheme === "perOar") {
      // Independent 4-oar mapping (future). Shift = reverse; hold not yet mapped.
      const rev = k.has("Shift");
      this.setOar(o, 0, k.has("q"), 1, rev, false);
      this.setOar(o, 1, k.has("e"), 1, rev, false);
      this.setOar(o, 2, k.has("z"), 1, rev, false);
      this.setOar(o, 3, k.has("c"), 1, rev, false);
    } else if (CONTROL.scheme === "sideBySide") {
      // Per-side 3-state. Port = oars 0,2. Starboard = oars 1,3.
      const portRow = k.has("q");
      const portHold = k.has("a");
      const portBack = k.has("z");
      const stbdRow = k.has("w");
      const stbdHold = k.has("s");
      const stbdBack = k.has("x");
      for (const i of [0, 2]) {
        this.setOar(o, i, portRow || portBack, 1, portBack, portHold);
      }
      for (const i of [1, 3]) {
        this.setOar(o, i, stbdRow || stbdBack, 1, stbdBack, stbdHold);
      }
    } else {
      // LEGACY simple: WASD both-fwd / both-back / one-side turn.
      const fwd = k.has("w") || k.has("ArrowUp");
      const back = k.has("s") || k.has("ArrowDown");
      const left = k.has("a") || k.has("ArrowLeft");
      const right = k.has("d") || k.has("ArrowRight");
      const reverse = back;
      if (fwd || (back && CONTROL.allowReverse)) {
        for (let i = 0; i < 4; i++) this.setOar(o, i, true, fwd ? 1 : 0, reverse);
      } else if (left) {
        this.setOar(o, 1, true, 1, false);
        this.setOar(o, 3, true, 1, false);
      } else if (right) {
        this.setOar(o, 0, true, 1, false);
        this.setOar(o, 2, true, 1, false);
      }
    }

    return { oars: o, usingGamepad: false };
  }

  private sampleGamepad(): InputState {
    const o = emptyOars();
    const gp = navigator.getGamepads?.()[this.gamepadIndex ?? -1];
    if (!gp) return { oars: o, usingGamepad: true };

    if (CONTROL.scheme === "perOar") {
      const ax = gp.axes;
      // left stick X -> rower A port(neg)/starboard(pos)
      this.setOar(o, 0, ax[0] < -0.2, Math.min(1, -ax[0]), gp.buttons[6]?.pressed, false);
      this.setOar(o, 1, ax[0] > 0.2, Math.min(1, ax[0]), gp.buttons[6]?.pressed, false);
      // right stick X -> rower B
      this.setOar(o, 2, ax[2] < -0.2, Math.min(1, -ax[2]), gp.buttons[7]?.pressed, false);
      this.setOar(o, 3, ax[2] > 0.2, Math.min(1, ax[2]), gp.buttons[7]?.pressed, false);
    } else {
      const ly = gp.axes[1] ?? 0; // forward/back
      const lx = gp.axes[0] ?? 0; // turn
      if (ly < -0.2) {
        for (let i = 0; i < 4; i++) this.setOar(o, i, true, Math.min(1, -ly), false, false);
      } else if (ly > 0.2 && CONTROL.allowReverse) {
        for (let i = 0; i < 4; i++) this.setOar(o, i, true, Math.min(1, ly), true, false);
      } else if (lx < -0.2) {
        this.setOar(o, 1, true, Math.min(1, -lx), false, false);
        this.setOar(o, 3, true, Math.min(1, -lx), false, false);
      } else if (lx > 0.2) {
        this.setOar(o, 0, true, Math.min(1, lx), false, false);
        this.setOar(o, 2, true, Math.min(1, lx), false, false);
      }
    }
    return { oars: o, usingGamepad: true };
  }
}
