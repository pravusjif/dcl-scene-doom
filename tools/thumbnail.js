// Renders the scene thumbnail from a real engine frame: boots the compiled engine headlessly, starts E1M1, walks
// to a viewpoint and writes the 320x200 framebuffer letterboxed into a 570x400 PNG (the size of the SDK template
// thumbnail). Usage: node --stack-size=4000 tools/thumbnail.js [out.png] [forwardTics] [turnPerTic] [turnTics]
'use strict'
const vm = require('vm')
const fs = require('fs')
const path = require('path')
const { encodePng } = require('./wad-atlas')

const root = path.join(__dirname, '..')
const out = process.argv[2] || path.join(root, 'images', 'scene-thumbnail.png')
// Defaults: the E1M1 start position looking into the first room (the committed thumbnail).
const forwardTics = Number(process.argv[3] ?? 0)
const turnPerTic = Number(process.argv[4] ?? 0)
const turnTics = Number(process.argv[5] ?? 0)
const OUT_W = 570
const OUT_H = 400

const js = fs.readFileSync(path.join(root, 'src/engine/doomgeneric.js'), 'utf8')
const wad = fs.readFileSync(path.join(root, 'engine/doom1.wad'))
const ctx = { console, setTimeout, clearTimeout, Date, Math, __wad: new Uint8Array(wad) }
vm.createContext(ctx)
vm.runInContext(`globalThis.WebAssembly.Instance = function(){ throw new Error('no wasm') }; var module = { exports: {} }; var exports = module.exports;`, ctx)
vm.runInContext(js, ctx, { filename: 'doomgeneric.js' })
vm.runInContext(`globalThis.__create = module.exports`, ctx)

;(async () => {
  const m = await ctx.__create({ print: () => {}, printErr: (s) => console.log('[err]', s) })
  m.FS.writeFile('/doom1.wad', ctx.__wad)
  m._dg_dcl_set_time(0)
  m._dg_dcl_init()
  let now = 0
  const tick = (n) => { for (let i = 0; i < n; i++) { now = Math.max(now + 1000 / 35, m._dg_dcl_get_time()); m._dg_dcl_set_time(now | 0); m._dg_dcl_tick() } }
  const press = (k) => { m._dg_dcl_key(1, k); m._dg_dcl_key(0, k); tick(3) }
  tick(40)
  press(13); tick(10); press(13); tick(10); press(13); tick(10); press(13); tick(40) // menu -> new game -> E1 -> skill
  m._dg_dcl_key(1, 0xad) // up arrow: forward
  for (let i = 0; i < Math.max(forwardTics, turnTics); i++) {
    if (i === forwardTics) m._dg_dcl_key(0, 0xad)
    if (i < turnTics) m._dg_dcl_mouse(0, turnPerTic, 0)
    tick(1)
  }
  m._dg_dcl_key(0, 0xad)
  tick(20) // let the weapon bob settle

  const W = m._dg_dcl_width(), H = m._dg_dcl_height()
  const fbPtr = m._dg_dcl_framebuffer(), palPtr = m._dg_dcl_palette()
  const fb = m.HEAPU8.subarray(fbPtr, fbPtr + W * H), pal = m.HEAPU8.subarray(palPtr, palPtr + 1024)

  // letterbox: scale the frame to the full width, centre vertically on black
  const scale = OUT_W / W
  const frameH = Math.round(H * scale)
  const top = (OUT_H - frameH) >> 1
  const rgba = new Uint8Array(OUT_W * OUT_H * 4)
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255
  for (let y = 0; y < frameH; y++) {
    const sy = Math.min(H - 1, Math.floor(y / scale))
    for (let x = 0; x < OUT_W; x++) {
      const sx = Math.min(W - 1, Math.floor(x / scale))
      const p = fb[sy * W + sx] * 4
      const o = ((top + y) * OUT_W + x) * 4
      rgba[o] = pal[p + 2]; rgba[o + 1] = pal[p + 1]; rgba[o + 2] = pal[p]
    }
  }
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, encodePng(OUT_W, OUT_H, rgba))
  console.log(`${out}: ${OUT_W}x${OUT_H}, frame ${OUT_W}x${frameH} at y=${top}`)
})().catch((e) => { console.log('FAIL', e && e.stack || e); process.exit(1) })
