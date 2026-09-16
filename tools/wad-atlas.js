// WAD -> texture atlases for the option A presenter.
//
// Reads an IWAD, composites wall textures (TEXTURE1/TEXTURE2 + PNAMES), reads flats (F_START..F_END) and sprite
// patches (S_START..S_END), and shelf-packs everything into RGBA atlas pages (max 1024x1024, 1 px padding).
// Indices match the engine: wall texture number = position in TEXTURE1 then TEXTURE2; flat = lump - firstflat
// where firstflat = lump(F_START) + 1; sprite = absolute lump number.
//
// Library: buildAtlases(wadBuffer) -> { pages: [{w,h,rgba}], walls: Rect[], flats: Rect[], patches: {lump: Rect},
// flatFiles: [{index, rgba}] }. CLI: node tools/wad-atlas.js engine/doom1.wad src/engine/atlas  (writes
// atlas-<n>.png, flat-<i>.png and atlas-index.ts).
'use strict'
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const PAGE = 1024
const PAD = 1

function readWad(buf) {
  const magic = buf.toString('ascii', 0, 4)
  if (magic !== 'IWAD' && magic !== 'PWAD') throw new Error('not a WAD: ' + magic)
  const numlumps = buf.readInt32LE(4)
  const dirofs = buf.readInt32LE(8)
  const lumps = []
  for (let i = 0; i < numlumps; i++) {
    const o = dirofs + i * 16
    const filepos = buf.readInt32LE(o)
    const size = buf.readInt32LE(o + 4)
    const name = buf.toString('ascii', o + 8, o + 16).replace(/\0.*$/, '').toUpperCase()
    lumps.push({ name, filepos, size, data: buf.subarray(filepos, filepos + size) })
  }
  const byName = new Map()
  for (let i = 0; i < lumps.length; i++) if (!byName.has(lumps[i].name)) byName.set(lumps[i].name, i)
  return { lumps, byName, num(name) { const n = byName.get(name); if (n === undefined) throw new Error('lump ' + name); return n } }
}

// Decode a patch lump into an indexed image with a transparency mask.
function decodePatch(data) {
  const w = data.readInt16LE(0)
  const h = data.readInt16LE(2)
  const leftoffset = data.readInt16LE(4)
  const topoffset = data.readInt16LE(6)
  const idx = new Uint8Array(w * h)
  const mask = new Uint8Array(w * h)
  for (let x = 0; x < w; x++) {
    let p = data.readInt32LE(8 + x * 4)
    for (;;) {
      const topdelta = data[p]
      if (topdelta === 0xff) break
      const len = data[p + 1]
      p += 3
      for (let i = 0; i < len; i++) {
        const y = topdelta + i
        if (y >= 0 && y < h) { idx[y * w + x] = data[p + i]; mask[y * w + x] = 1 }
      }
      p += len + 1
    }
  }
  return { w, h, leftoffset, topoffset, idx, mask }
}

function buildWallTextures(wad) {
  const pn = wad.lumps[wad.num('PNAMES')].data
  const npn = pn.readInt32LE(0)
  const pnames = []
  for (let i = 0; i < npn; i++) pnames.push(pn.toString('ascii', 4 + i * 8, 12 + i * 8).replace(/\0.*$/, '').toUpperCase())
  const patchCache = new Map()
  const patchFor = (pi) => {
    const name = pnames[pi]
    if (!patchCache.has(name)) {
      const n = wad.byName.get(name)
      patchCache.set(name, n === undefined ? null : decodePatch(wad.lumps[n].data))
    }
    return patchCache.get(name)
  }
  const textures = []
  for (const lumpName of ['TEXTURE1', 'TEXTURE2']) {
    if (!wad.byName.has(lumpName)) continue
    const t = wad.lumps[wad.num(lumpName)].data
    const n = t.readInt32LE(0)
    for (let i = 0; i < n; i++) {
      const o = t.readInt32LE(4 + i * 4)
      const name = t.toString('ascii', o, o + 8).replace(/\0.*$/, '').toUpperCase()
      const w = t.readInt16LE(o + 12)
      const h = t.readInt16LE(o + 14)
      const patchcount = t.readInt16LE(o + 20)
      const idx = new Uint8Array(w * h)
      const mask = new Uint8Array(w * h)
      for (let p = 0; p < patchcount; p++) {
        const po = o + 22 + p * 10
        const ox = t.readInt16LE(po)
        const oy = t.readInt16LE(po + 2)
        const patch = patchFor(t.readInt16LE(po + 4))
        if (!patch) continue
        for (let py = 0; py < patch.h; py++) {
          const y = oy + py
          if (y < 0 || y >= h) continue
          for (let px = 0; px < patch.w; px++) {
            const x = ox + px
            if (x < 0 || x >= w) continue
            if (patch.mask[py * patch.w + px]) { idx[y * w + x] = patch.idx[py * patch.w + px]; mask[y * w + x] = 1 }
          }
        }
      }
      textures.push({ name, w, h, idx, mask })
    }
  }
  return textures
}

function buildFlats(wad) {
  const first = wad.num('F_START') + 1
  const last = wad.num('F_END') - 1
  const flats = []
  for (let l = first; l <= last; l++) {
    const lump = wad.lumps[l]
    if (lump.size !== 4096) { flats.push(null); continue }
    flats.push({ name: lump.name, w: 64, h: 64, idx: new Uint8Array(lump.data), mask: null, index: l - first })
  }
  return { first, flats }
}

function buildSprites(wad) {
  const first = wad.num('S_START') + 1
  const last = wad.num('S_END') - 1
  const sprites = new Map()
  for (let l = first; l <= last; l++) {
    const lump = wad.lumps[l]
    if (lump.size < 8) continue
    const p = decodePatch(lump.data)
    sprites.set(l, { name: lump.name, ...p })
  }
  return { first, sprites }
}

// Shelf packer: items sorted by height, rows fill left to right, new page when the row would overflow.
class Packer {
  constructor() { this.pages = []; this.newPage() }
  newPage() { this.cur = { w: PAGE, h: PAGE, rgba: new Uint8Array(PAGE * PAGE * 4), shelfY: 0, shelfH: 0, x: 0 }; this.pages.push(this.cur); this.pageIndex = this.pages.length - 1 }
  place(w, h) {
    if (w + 2 * PAD > PAGE || h + 2 * PAD > PAGE) throw new Error('item too big ' + w + 'x' + h)
    if (this.cur.x + w + 2 * PAD > PAGE) { this.cur.shelfY += this.cur.shelfH; this.cur.shelfH = 0; this.cur.x = 0 }
    if (this.cur.shelfY + h + 2 * PAD > PAGE) { this.newPage() }
    const rect = { page: this.pageIndex, x: this.cur.x + PAD, y: this.cur.shelfY + PAD, w, h }
    this.cur.x += w + 2 * PAD
    if (h + 2 * PAD > this.cur.shelfH) this.cur.shelfH = h + 2 * PAD
    return rect
  }
}

function blit(page, rect, img, palette) {
  const out = page.rgba
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const i = y * img.w + x
      const opaque = img.mask ? img.mask[i] : 1
      const o = ((rect.y + y) * page.w + rect.x + x) * 4
      if (opaque) {
        const c = img.idx[i] * 3
        out[o] = palette[c]; out[o + 1] = palette[c + 1]; out[o + 2] = palette[c + 2]; out[o + 3] = 255
      }
    }
  }
  // Duplicate edge pixels into the 1 px padding so point/bilinear sampling never bleeds a neighbour in.
  for (let y = -1; y <= img.h; y++) {
    for (const x of [-1, img.w]) {
      const sx = Math.min(Math.max(x, 0), img.w - 1), sy = Math.min(Math.max(y, 0), img.h - 1)
      const src = ((rect.y + sy) * page.w + rect.x + sx) * 4, dst = ((rect.y + y) * page.w + rect.x + x) * 4
      out.copyWithin(dst, src, src + 4)
    }
  }
  for (let x = 0; x < img.w; x++) {
    for (const y of [-1, img.h]) {
      const sy = Math.min(Math.max(y, 0), img.h - 1)
      const src = ((rect.y + sy) * page.w + rect.x + x) * 4, dst = ((rect.y + y) * page.w + rect.x + x) * 4
      out.copyWithin(dst, src, src + 4)
    }
  }
}

function buildAtlases(wadBuffer) {
  const wad = readWad(wadBuffer)
  const palette = wad.lumps[wad.num('PLAYPAL')].data.subarray(0, 768)
  const textures = buildWallTextures(wad)
  const { flats } = buildFlats(wad)
  const { sprites } = buildSprites(wad)

  const packer = new Packer()
  // Walls first, then sprites; flats go to their own 64x64 files so the UI can REPEAT them.
  const wallOrder = textures.map((t, i) => ({ t, i })).sort((a, b) => b.t.h - a.t.h || b.t.w - a.t.w)
  const walls = new Array(textures.length)
  for (const { t, i } of wallOrder) {
    const r = packer.place(t.w, t.h)
    blit(packer.pages[r.page], r, t, palette)
    walls[i] = { ...r, name: t.name }
  }
  const wallPages = packer.pages.length
  // Start sprites on a fresh page so sprite pools sit above wall pools in draw order.
  packer.newPage()
  const spriteOrder = [...sprites.entries()].sort((a, b) => b[1].h - a[1].h || b[1].w - a[1].w)
  const patches = {}
  for (const [lump, s] of spriteOrder) {
    const r = packer.place(s.w, s.h)
    blit(packer.pages[r.page], r, s, palette)
    patches[lump] = { ...r, name: s.name, leftoffset: s.leftoffset, topoffset: s.topoffset }
  }
  const flatFiles = []
  const flatRects = []
  for (let i = 0; i < flats.length; i++) {
    const f = flats[i]
    if (!f) { flatRects.push(null); continue }
    const page = { w: 64, h: 64, rgba: new Uint8Array(64 * 64 * 4) }
    blit(page, { x: 0, y: 0, w: 64, h: 64 }, { ...f, mask: null }, page.rgba && palette)
    // average colour, for the untextured fallback
    let r = 0, g = 0, b = 0
    for (let p = 0; p < 4096; p++) { const c = f.idx[p] * 3; r += palette[c]; g += palette[c + 1]; b += palette[c + 2] }
    flatRects.push({ file: i, name: f.name, avg: [Math.round(r / 4096), Math.round(g / 4096), Math.round(b / 4096)] })
    flatFiles.push({ index: i, rgba: page.rgba })
  }
  return { pages: packer.pages, wallPages, walls, flats: flatRects, patches, flatFiles, palette }
}

// Minimal PNG encoder (RGBA, no filtering).
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1) }
  const crcTable = new Int32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c }
  const crc = (buf) => { let c = -1; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0 }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

module.exports = { buildAtlases, encodePng, readWad, decodePatch }

if (require.main === module) {
  const [wadPath, outDir] = process.argv.slice(2)
  if (!wadPath || !outDir) { console.error('usage: node tools/wad-atlas.js <iwad> <outDir>'); process.exit(1) }
  const t0 = Date.now()
  const a = buildAtlases(fs.readFileSync(wadPath))
  fs.mkdirSync(outDir, { recursive: true })
  for (const f of fs.readdirSync(outDir)) if (/^(atlas-\d+|flat-\d+)\.png$/.test(f)) fs.unlinkSync(path.join(outDir, f))
  a.pages.forEach((p, i) => fs.writeFileSync(path.join(outDir, `atlas-${i}.png`), encodePng(p.w, p.h, p.rgba)))
  for (const f of a.flatFiles) fs.writeFileSync(path.join(outDir, `flat-${f.index}.png`), encodePng(64, 64, f.rgba))
  const rel = path.relative(process.cwd(), outDir).replace(/\\/g, '/')
  const ts = `// Generated by tools/wad-atlas.js from ${path.basename(wadPath)}; do not edit.
export interface AtlasRect { page: number; x: number; y: number; w: number; h: number }
export interface PatchRect extends AtlasRect { leftoffset: number; topoffset: number }
export const ATLAS_PAGE_SIZE = ${PAGE}
export const ATLAS_PAGES: string[] = ${JSON.stringify(a.pages.map((_, i) => `${rel}/atlas-${i}.png`))}
export const ATLAS_WALL_PAGES = ${a.wallPages}
/** Wall texture number -> atlas rect (index = engine texture number). */
export const WALLS: AtlasRect[] = ${JSON.stringify(a.walls.map(({ page, x, y, w, h }) => ({ page, x, y, w, h })))}
/** Flat index (lump - firstflat) -> its own 64x64 file + average colour; null for marker lumps. */
export const FLATS: ({ file: string; avg: [number, number, number] } | null)[] = ${JSON.stringify(a.flats.map((f) => (f ? { file: `${rel}/flat-${f.file}.png`, avg: f.avg } : null)))}
/** Sprite patch lump number -> atlas rect. */
export const PATCHES: Record<number, PatchRect> = ${JSON.stringify(Object.fromEntries(Object.entries(a.patches).map(([k, { page, x, y, w, h, leftoffset, topoffset }]) => [k, { page, x, y, w, h, leftoffset, topoffset }])))}
`
  fs.writeFileSync(path.join(outDir, 'atlas-index.ts'), ts)
  console.log(`walls ${a.walls.length} on ${a.wallPages} page(s), sprites ${Object.keys(a.patches).length} on ${a.pages.length - a.wallPages} page(s), flats ${a.flatFiles.length}, ${Date.now() - t0} ms`)
}
