// Maps Decentraland input to DOOM key/mouse events.
//
// WASD keep reaching the scene while InputModifier freezes the avatar (verified in the Explorer source), so
// movement polls inputSystem.isPressed per tick and emits DOOM key down/up on edges. Mouse look comes from
// PrimaryPointerInfo.screenDelta, which keeps reporting while the pointer is locked.
import { InputAction, inputSystem } from '@dcl/sdk/ecs'

import { DoomKey, DoomSource } from './doom'

const KEYMAP: [InputAction, number][] = [
  [InputAction.IA_FORWARD, DoomKey.UPARROW], // W: forward (menu: up)
  [InputAction.IA_BACKWARD, DoomKey.DOWNARROW], // S: back (menu: down)
  [InputAction.IA_LEFT, DoomKey.STRAFE_L], // A: strafe left
  [InputAction.IA_RIGHT, DoomKey.STRAFE_R], // D: strafe right
  [InputAction.IA_POINTER, DoomKey.FIRE], // left click: fire
  [InputAction.IA_PRIMARY, DoomKey.USE], // E: use / open doors
  [InputAction.IA_JUMP, DoomKey.USE], // Space: use
  [InputAction.IA_SECONDARY, DoomKey.ENTER], // F: menu confirm
  [InputAction.IA_WALK, DoomKey.RSHIFT], // Shift: run
  [InputAction.IA_ACTION_3, DoomKey.key('1')], // 1: fist / chainsaw
  [InputAction.IA_ACTION_4, DoomKey.key('2')], // 2: pistol
  [InputAction.IA_ACTION_5, DoomKey.key('3')], // 3: shotgun
  [InputAction.IA_ACTION_6, DoomKey.ESCAPE] // 4: menu
]

export class DoomInput {
  /** Mouse look sensitivity: DOOM mouse units per screen pixel. */
  sensitivity = 2.25
  private down = new Uint8Array(KEYMAP.length)

  poll(doom: DoomSource, screenDelta?: { x: number; y: number }) {
    for (let i = 0; i < KEYMAP.length; i++) {
      const pressed = inputSystem.isPressed(KEYMAP[i][0]) ? 1 : 0
      if (pressed !== this.down[i]) {
        this.down[i] = pressed
        doom.key(pressed === 1, KEYMAP[i][1])
      }
    }
    if (screenDelta && screenDelta.x !== 0) {
      doom.mouse(screenDelta.x * this.sensitivity, 0)
    }
  }

  releaseAll(doom: DoomSource) {
    for (let i = 0; i < KEYMAP.length; i++) {
      if (this.down[i]) {
        this.down[i] = 0
        doom.key(false, KEYMAP[i][1])
      }
    }
  }
}
