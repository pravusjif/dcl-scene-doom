// Headless validation of the draw-call recorder: runs the compiled engine into E1M1, dumps one frame's records,
// and rasterizes them with the atlases exactly the way the scene presenter maps them to textured quads.
// Output: <out>/records.png (left: engine framebuffer, right: reconstruction from records) + stats on stdout.
'use strict'
const vm = require('vm')
const fs = require('fs')
const path = require('path')
const { buildAtlases, encodePng } = require('./wad-atlas')

const root = path.join(__dirname, '..')
const outDir = process.argv[2] || path.join(root, 'engine', 'build')
const js = fs.readFileSync(path.join(root, 'src/engine/doomgeneric.js'), 'utf8')
const wad = fs.readFileSync(path.join(root, 'engine/doom1.wad'))
const atlas = buildAtlases(wad)

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
  press(13); tick(10); press(13); tick(10); press(13); tick(10); press(13); tick(40)
  // walk forward and turn left a little so walls, floors, sky and sprites are all in view
  m._dg_dcl_key(1, 0xad); for (let i = 0; i < 60; i++) { m._dg_dcl_mouse(0, -4, 0); tick(1) } m._dg_dcl_key(0, 0xad); tick(5)

  const W = m._dg_dcl_width(), H = m._dg_dcl_height()
  const fbPtr = m._dg_dcl_framebuffer(), palPtr = m._dg_dcl_palette()
  const fb = m.HEAPU8.subarray(fbPtr, fbPtr + W * H), pal = m.HEAPU8.subarray(palPtr, palPtr + 1024)
  const count = m._dg_dcl_record_count()
  const recPtr = m._dg_dcl_records() >> 2
  const rec = m.HEAP32 ? m.HEAP32.subarray(recPtr, recPtr + count * 12) : new Int32Array(m.HEAPU8.buffer, m._dg_dcl_records(), count * 12)
  const view = {}
  ;['vwx', 'vwy', 'vw', 'vh', 'detailshift', 'centery', 'menuactive', 'automap', 'gamestate', 'numtextures', 'numflats', 'firstspritelump', 'skytexture'].forEach((k, i) => (view[k] = m._dg_dcl_view(i)))
  console.log('view', JSON.stringify(view), 'records', count, 'overflow', m._dg_dcl_record_overflow())
  console.log('atlas: walls', atlas.walls.length, 'pages', atlas.pages.length, 'patches', Object.keys(atlas.patches).length, 'flats', atlas.flatFiles.length)
  if (view.numtextures !== atlas.walls.length) console.log('WARNING wall texture count mismatch', view.numtextures, atlas.walls.length)

  const stats = { col: 0, fuzz: 0, trans: 0, span: 0, wallCols: 0, spriteCols: 0, badId: 0, wrapCols: 0 }
  const S = 2
  const out = new Uint8Array(W * S * 2 * H * S * 4)
  const OW = W * S * 2
  const put = (x, y, r, g, b, a = 255) => { if (x < 0 || y < 0 || x >= OW || y >= H * S) return; const o = (y * OW + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a }
  // left: framebuffer
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = fb[y * W + x] * 4; for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) put(x * S + dx, y * S + dy, pal[p + 2], pal[p + 1], pal[p]) }
  // right: records
  const X0 = W * S
  const sample = (page, ax, ay) => { const o = (ay * page.w + ax) * 4; return [page.rgba[o], page.rgba[o + 1], page.rgba[o + 2], page.rgba[o + 3]] }
  for (let i = 0; i < count; i++) {
    const r = rec.subarray(i * 12, i * 12 + 12)
    const type = r[0]
    const tint = Math.max(0, 1 - r[10] / 34)
    if (type === 3) {
      stats.span++
      const flat = atlas.flatFiles.find((f) => f.index === r[5])
      if (!flat) { stats.badId++; continue }
      const y = view.vwy + r[2]
      for (let x = r[1]; x <= r[3]; x++) {
        const u = ((r[7] + r[9] * (x - r[1])) / 65536) % 64, v = ((r[8] + r[11] * (x - r[1])) / 65536) % 64
        const tu = ((u | 0) + 64) % 64, tv = ((v | 0) + 64) % 64
        const o = (tv * 64 + tu) * 4
        for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) put(X0 + (view.vwx + x) * S + dx, y * S + dy, flat.rgba[o] * tint, flat.rgba[o + 1] * tint, flat.rgba[o + 2] * tint)
      }
      continue
    }
    if (type === 0) stats.col++; else if (type === 1) stats.fuzz++; else stats.trans++
    const kind = r[4], id = r[5], col = r[6]
    let rect, page
    if (kind === 0) { stats.wallCols++; rect = atlas.walls[id] } else { stats.spriteCols++; rect = atlas.patches[id] }
    if (!rect) { stats.badId++; continue }
    page = atlas.pages[rect.page]
    const yl = r[2], yh = r[3], texmid = r[7], iscale = r[8], topdelta = r[9]
    const vTop = topdelta + (texmid + (yl - view.centery) * iscale) / 65536
    const vBot = topdelta + (texmid + (yh + 1 - view.centery) * iscale) / 65536
    if (kind === 0 && (Math.floor(vTop / rect.h) !== Math.floor((vBot - 1e-6) / rect.h))) stats.wrapCols++
    const sx = view.vwx + (r[1] << view.detailshift)
    const cw = 1 << view.detailshift
    for (let y = yl; y <= yh; y++) {
      // linear interpolation between the quad's top and bottom edges, sampled at the row centre
      const v = vTop + ((vBot - vTop) * (y - yl + 0.5)) / (yh - yl + 1)
      let row = Math.floor(v)
      if (kind === 0) row = ((row % rect.h) + rect.h) % rect.h
      else row = Math.min(Math.max(row, 0), rect.h - 1)
      const [cr, cg, cb, ca] = type === 1 ? [0, 0, 0, 128] : sample(page, rect.x + Math.min(col, rect.w - 1), rect.y + row)
      if (ca === 0) continue
      for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < cw * S; dx++) {
        if (type === 1) { const px = X0 + sx * S + dx, py = (view.vwy + y) * S + dy; const o = (py * OW + px) * 4; out[o] >>= 1; out[o + 1] >>= 1; out[o + 2] >>= 1; out[o + 3] = 255 }
        else put(X0 + sx * S + dx, (view.vwy + y) * S + dy, cr * tint, cg * tint, cb * tint)
      }
    }
  }
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'records.png'), encodePng(OW, H * S, out))
  fs.writeFileSync(path.join(outDir, 'atlas-0.png'), encodePng(atlas.pages[0].w, atlas.pages[0].h, atlas.pages[0].rgba))
  console.log('stats', JSON.stringify(stats), '-> ', path.join(outDir, 'records.png'))
  // per-frame record count distribution over a short walk
  const counts = []
  m._dg_dcl_key(1, 0xad); for (let i = 0; i < 70; i++) { m._dg_dcl_mouse(0, 3, 0); tick(1); counts.push(m._dg_dcl_record_count()) } m._dg_dcl_key(0, 0xad)
  counts.sort((a, b) => a - b)
  console.log('records/frame over 70 frames: min', counts[0], 'median', counts[35], 'max', counts[69])
})().catch((e) => { console.log('FAIL', e && e.stack || e); process.exit(1) })
