// DoomSource: the real DOOM engine (doomgeneric compiled to plain JS) as a FrameSource for FbDisplay.
//
// Lifecycle: `await DoomSource.create()` decodes the embedded shareware WAD into the module's in-memory
// filesystem and runs D_DoomMain up to the first frame. Then `render(dt)` once per scene tick advances the
// simulated clock, drains input, runs TryRunTics + D_Display and hands back the 320x200 palette-index frame.

import type { FrameSource } from '../framebuffer'
import { DOOM1_WAD_B64 } from './doom1.wad.b64'
import createDoom, { DoomModule } from './doomgeneric.js'

// doomkeys.h
export const DoomKey = {
  RIGHTARROW: 0xae,
  LEFTARROW: 0xac,
  UPARROW: 0xad,
  DOWNARROW: 0xaf,
  STRAFE_L: 0xa0,
  STRAFE_R: 0xa1,
  USE: 0xa2,
  FIRE: 0xa3,
  ESCAPE: 27,
  ENTER: 13,
  TAB: 9,
  BACKSPACE: 0x7f,
  PAUSE: 0xff,
  RSHIFT: 0x80 + 0x36,
  RCTRL: 0x80 + 0x1d,
  RALT: 0x80 + 0x38,
  F1: 0x80 + 0x3b,
  F2: 0x80 + 0x3c,
  F3: 0x80 + 0x3d,
  F4: 0x80 + 0x3e,
  F5: 0x80 + 0x3f,
  F6: 0x80 + 0x40,
  F7: 0x80 + 0x41,
  F8: 0x80 + 0x42,
  F9: 0x80 + 0x43,
  F10: 0x80 + 0x44,
  F11: 0x80 + 0x57,
  F12: 0x80 + 0x58,
  // ASCII keys are their char codes: '1'.charCodeAt(0), 'y', 'n', ...
  key(ch: string): number {
    return ch.charCodeAt(0)
  }
} as const

export class DoomSource implements FrameSource {
  readonly width: number
  readonly height: number
  readonly palette = new Uint8Array(768)

  /** Wall-clock ms of the last render, for the tick cost log. */
  lastTickMs = 0
  ticks = 0
  frames = 0

  private readonly m: DoomModule
  private readonly fbPtr: number
  private readonly palPtr: number
  private frame: Uint8Array
  private simMs = 0

  private constructor(m: DoomModule) {
    this.m = m
    this.width = m._dg_dcl_width()
    this.height = m._dg_dcl_height()
    this.fbPtr = m._dg_dcl_framebuffer()
    this.palPtr = m._dg_dcl_palette()
    this.frame = m.HEAPU8.subarray(this.fbPtr, this.fbPtr + this.width * this.height)
    this.refreshPalette()
  }

  static async create(log: (line: string) => void = () => {}): Promise<DoomSource> {
    const t0 = Date.now()
    const m = await createDoom({ print: log, printErr: (s) => log('[stderr] ' + s) })
    const t1 = Date.now()
    m.FS.writeFile('/doom1.wad', decodeBase64(DOOM1_WAD_B64))
    const t2 = Date.now()
    m._dg_dcl_set_time(0)
    m._dg_dcl_init()
    const t3 = Date.now()
    log(`[doom] module ${t1 - t0}ms, wad decode ${t2 - t1}ms, D_DoomMain ${t3 - t2}ms`)
    return new DoomSource(m)
  }

  /** Queue a key press or release using doomkeys.h codes (see DoomKey). */
  key(pressed: boolean, code: number) {
    this.m._dg_dcl_key(pressed ? 1 : 0, code)
  }

  /** Mouse motion in DOOM mouse units; buttons bit0 fire, bit1 strafe, bit2 forward. */
  mouse(dx: number, dy: number, buttons = 0) {
    if (dx === 0 && dy === 0 && buttons === 0) return
    this.m._dg_dcl_mouse(buttons, dx | 0, dy | 0)
  }

  render(dt: number): Uint8Array {
    const m = this.m
    // Advance the simulated clock by real elapsed time, never backwards (TryRunTics may have nudged it forward
    // while waiting for a tic boundary — see DG_SleepMs in doomgeneric_dcl.c).
    this.simMs = Math.max(this.simMs + dt * 1000, m._dg_dcl_get_time())
    m._dg_dcl_set_time(this.simMs | 0)
    const t0 = Date.now()
    const drew = m._dg_dcl_tick()
    this.lastTickMs = Date.now() - t0
    this.ticks++
    if (drew) this.frames++
    if (m._dg_dcl_palette_changed()) this.refreshPalette()
    // HEAPU8 is replaced if the heap grows; re-derive the view defensively.
    if (this.frame.buffer !== m.HEAPU8.buffer) {
      this.frame = m.HEAPU8.subarray(this.fbPtr, this.fbPtr + this.width * this.height)
    }
    return this.frame
  }

  /** DOOM detail level: 0 = 320 columns, 1 = low detail (160 columns, 2 px wide). Halves wall/sprite records. */
  setDetail(low: boolean) {
    this.m._dg_dcl_set_detail(low ? 1 : 0)
  }

  // ---- draw-call records (option A) ----
  recordCount(): number {
    return this.m._dg_dcl_record_count()
  }
  recordOverflow(): number {
    return this.m._dg_dcl_record_overflow()
  }
  /** Int32 view over the record buffer; valid until the next render(). */
  records(count: number): Int32Array {
    return new Int32Array(this.m.HEAPU8.buffer, this.m._dg_dcl_records(), count * 12)
  }
  /** See _dg_dcl_view in doomgeneric_dcl.c. */
  view(what: number): number {
    return this.m._dg_dcl_view(what)
  }

  private refreshPalette() {
    // struct color { b, g, r, a } per entry -> PLAYPAL-style RGB triplets
    const h = this.m.HEAPU8
    const p = this.palPtr
    for (let i = 0; i < 256; i++) {
      this.palette[i * 3] = h[p + i * 4 + 2]
      this.palette[i * 3 + 1] = h[p + i * 4 + 1]
      this.palette[i * 3 + 2] = h[p + i * 4]
    }
  }
}

// The scene runtime has no atob/Buffer; minimal base64 decoder (standard alphabet, '=' padding).
const B64 = new Uint8Array(128)
for (let i = 0; i < 64; i++) {
  B64['ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.charCodeAt(i)] = i
}
export function decodeBase64(s: string): Uint8Array {
  let len = s.length
  while (len > 0 && s.charCodeAt(len - 1) === 61) len--
  const out = new Uint8Array((len * 3) >> 2)
  let o = 0
  let i = 0
  for (; i + 4 <= len; i += 4) {
    const a = B64[s.charCodeAt(i)]
    const b = B64[s.charCodeAt(i + 1)]
    const c = B64[s.charCodeAt(i + 2)]
    const d = B64[s.charCodeAt(i + 3)]
    out[o++] = (a << 2) | (b >> 4)
    out[o++] = ((b & 15) << 4) | (c >> 2)
    out[o++] = ((c & 3) << 6) | d
  }
  const rem = len - i
  if (rem >= 2) {
    const a = B64[s.charCodeAt(i)]
    const b = B64[s.charCodeAt(i + 1)]
    out[o++] = (a << 2) | (b >> 4)
    if (rem === 3) {
      const c = B64[s.charCodeAt(i + 2)]
      out[o++] = ((b & 15) << 4) | (c >> 2)
    }
  }
  return out.subarray(0, o)
}
