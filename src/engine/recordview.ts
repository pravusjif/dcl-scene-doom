// Option A presenter: DOOM's recorded column/span draws -> pooled textured UI rectangles.
//
// Every record becomes one absolutely positioned UiEntity with a texture from the WAD atlases, a UV sub-rect and a
// grey tint for the light level. Pools are per texture so `texture.src` never changes on a live element; pool
// creation order fixes the draw order (later siblings render on top): wall pages, flats, sprite pages, masked
// walls, fuzz. Within a pool, slots are assigned in record order, which is DOOM's back-to-front order.
import {
  BackgroundTextureMode,
  engine,
  Entity,
  Material,
  TextureFilterMode,
  TextureWrapMode,
  UiBackground,
  UiTransform,
  YGDisplay,
  YGPositionType,
  YGUnit
} from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'

import { ATLAS_PAGE_SIZE, ATLAS_PAGES, ATLAS_WALL_PAGES, FLATS, PATCHES, WALLS } from './atlas-index'
import type { DoomSource } from './doom'

const REC_INTS = 12

interface Pool {
  entities: Entity[]
  used: number
  prevUsed: number
  // shadow of what each slot shows, to skip identical writes (Float64 so compares against JS numbers are exact)
  sx: Float64Array
  sy: Float64Array
  sw: Float64Array
  sh: Float64Array
  su: Float64Array // 8 uv floats per slot
  st: Float64Array // tint key
  visible: Uint8Array
  texture: { src: string; wrapMode: TextureWrapMode; filterMode: TextureFilterMode } | null
  parent: Entity
}

export interface RecordViewStats {
  records: number
  spans: number
  rects: number
  dirty: number
  overflow: number
  encodeMs: number
}

// An open run of adjacent column records sharing texture/light that will be emitted as one wider rectangle.
interface Run {
  key: number
  type: number
  kind: number
  id: number
  masked: number
  topdelta: number
  shade: number
  x0: number
  xEnd: number
  col0: number
  colEnd: number
  yl: number
  yh: number
  texmid: number
  iscale: number
}

// DOOM's 32 light levels: colormap 0 is full bright, 31 nearly black; 32/33 are special (invulnerability).
const TINTS: Color4[] = []
for (let s = 0; s < 34; s++) {
  const k = s >= 32 ? 1 : (32 - s) / 32
  TINTS.push(Color4.create(k, k, k, 1))
}
const FUZZ_COLOR = Color4.create(0, 0, 0, 0.55)
const DEBUG_SPAN = Color4.create(1, 0, 1, 1)

export class RecordView {
  readonly stats: RecordViewStats = { records: 0, spans: 0, rects: 0, dirty: 0, overflow: 0, encodeMs: 0 }
  /** Draw floors/ceilings textured (needs UI REPEAT wrap for UVs outside 0..1); false = flat average colour. */
  texturedFlats = false
  /**
   * Adjacent columns with the same texture, consecutive (or repeated) texture columns and top/bottom rows within
   * this many DOOM pixels are merged into one rectangle. 0 = exact merges only; 1–2 trades slight stair-stepping
   * on slanted walls for far fewer elements.
   */
  mergeTolerance = 1
  /** Debug: draw every floor/ceiling span in solid magenta. */
  debugSpans = false

  private runs = new Map<number, Run>()
  private runPool: Run[] = []

  private root: Entity
  private pools: Pool[] = []
  private wallPools: Pool[] = []
  private flatPools: (Pool | null)[] = []
  private spritePools: Pool[] = []
  private maskedWallPools: Pool[] = []
  private fuzzPool: Pool
  private flatAvg: (Color4 | null)[] = []
  private uvScratch = new Array<number>(8).fill(0)

  constructor(
    private panelLeft: number,
    private panelTop: number,
    private scale: number,
    texturedFlats = false
  ) {
    this.texturedFlats = texturedFlats
    this.root = engine.addEntity()
    UiTransform.create(this.root, {
      parent: 0 as Entity,
      positionType: YGPositionType.YGPT_ABSOLUTE,
      positionLeft: panelLeft,
      positionLeftUnit: YGUnit.YGU_POINT,
      positionTop: panelTop,
      positionTopUnit: YGUnit.YGU_POINT,
      width: 320 * scale,
      widthUnit: YGUnit.YGU_POINT,
      height: 200 * scale,
      heightUnit: YGUnit.YGU_POINT,
      display: YGDisplay.YGD_NONE
    } as any)
    UiBackground.create(this.root, { color: Color4.create(0, 0, 0, 0), textureMode: BackgroundTextureMode.STRETCH, uvs: [] })

    // Pool creation order == draw order.
    for (let p = 0; p < ATLAS_WALL_PAGES; p++) this.wallPools.push(this.newPool(ATLAS_PAGES[p], TextureWrapMode.TWM_CLAMP, 0))
    for (let f = 0; f < FLATS.length; f++) {
      const flat = FLATS[f]
      // untextured flats get plain colour pools so a missing texture can never hide them
      this.flatPools.push(flat ? this.newPool(texturedFlats ? flat.file : null, TextureWrapMode.TWM_REPEAT, 1) : null)
      this.flatAvg.push(flat ? Color4.create(flat.avg[0] / 255, flat.avg[1] / 255, flat.avg[2] / 255, 1) : null)
    }
    for (let p = ATLAS_WALL_PAGES; p < ATLAS_PAGES.length; p++) {
      this.spritePools.push(this.newPool(ATLAS_PAGES[p], TextureWrapMode.TWM_CLAMP, 2))
    }
    for (let p = 0; p < ATLAS_WALL_PAGES; p++) this.maskedWallPools.push(this.newPool(ATLAS_PAGES[p], TextureWrapMode.TWM_CLAMP, 3))
    this.fuzzPool = this.newPool(null, TextureWrapMode.TWM_CLAMP, 4)
  }

  setVisible(v: boolean) {
    UiTransform.getMutable(this.root).display = v ? YGDisplay.YGD_FLEX : YGDisplay.YGD_NONE
    if (!v) this.hideAll()
  }

  /** Move/rescale the panel (canvas pixels, canvas pixels per DOOM pixel). Every slot is rewritten on the next present. */
  setGeometry(left: number, top: number, scale: number) {
    if (left === this.panelLeft && top === this.panelTop && scale === this.scale) return
    this.panelLeft = left
    this.panelTop = top
    this.scale = scale
    const t = UiTransform.getMutable(this.root)
    t.positionLeft = left
    t.positionTop = top
    t.width = 320 * scale
    t.height = 200 * scale
    for (const layer of this.layers) {
      const l = UiTransform.getMutable(layer)
      l.width = 320 * scale
      l.height = 200 * scale
    }
    this.hideAll()
  }

  private hideAll() {
    for (const pool of this.pools) {
      for (let i = 0; i < pool.prevUsed; i++) this.hideSlot(pool, i)
      pool.prevUsed = 0
    }
  }

  /** Present the records of the frame the source just rendered. */
  present(doom: DoomSource) {
    const t0 = Date.now()
    const count = doom.recordCount()
    const rec = doom.records(count)
    const vwx = doom.view(0)
    const vwy = doom.view(1)
    const detailshift = doom.view(4)
    const centery = doom.view(5)
    const S = this.scale
    const P = ATLAS_PAGE_SIZE
    let dirty = 0
    let rects = 0
    let spans = 0

    for (const pool of this.pools) pool.used = 0

    for (let i = 0; i < count; i++) {
      const b = i * REC_INTS
      const type = rec[b]
      if (type === 3) {
        // span: x1=rec[b+1] y=rec[b+2] x2=rec[b+3] flat=rec[b+5] xfrac yfrac xstep shade ystep
        spans++
        const flatIdx = rec[b + 5]
        const pool = this.flatPools[flatIdx]
        if (!pool) continue
        // In low detail R_DrawSpanLow doubles x1/x2 (2 px per step) and steps the texture once per low-res column.
        const x1 = rec[b + 1]
        const x2 = rec[b + 3]
        const y = rec[b + 2]
        const n = x2 - x1 + 1
        const left = (vwx + (x1 << detailshift)) * S
        const top = (vwy + y) * S
        const tint = this.debugSpans ? DEBUG_SPAN : TINTS[Math.min(33, Math.max(0, rec[b + 10]))]
        if (this.texturedFlats) {
          const u0 = rec[b + 7] / 65536 / 64
          const v0 = rec[b + 8] / 65536 / 64
          const u1 = (rec[b + 7] + rec[b + 9] * n) / 65536 / 64
          const v1 = (rec[b + 8] + rec[b + 11] * n) / 65536 / 64
          const uv = this.uvScratch
          uv[0] = u0; uv[1] = 1 - v0; uv[2] = u0; uv[3] = 1 - v0; uv[4] = u1; uv[5] = 1 - v1; uv[6] = u1; uv[7] = 1 - v1
          if (this.write(pool, left, top, (n << detailshift) * S, S, uv, tint)) dirty++
        } else {
          const avg = this.debugSpans ? DEBUG_SPAN : this.flatAvg[flatIdx]!
          if (this.write(pool, left, top, (n << detailshift) * S, S, null, tint, avg)) dirty++
        }
        rects++
        continue
      }

      // column: x yl yh kind id col texturemid iscale topdelta shade masked
      const x = rec[b + 1]
      const yl = rec[b + 2]
      const yh = rec[b + 3]
      const kind = rec[b + 4]
      const id = rec[b + 5]
      const col = rec[b + 6]
      const topdelta = rec[b + 9]
      const shade = rec[b + 10]
      const masked = rec[b + 11]

      if (type === 1) {
        // spectre fuzz: dark translucent strip, no texture
        const left = (vwx + (x << detailshift)) * S
        if (this.write(this.fuzzPool, left, (vwy + yl) * S, (1 << detailshift) * S, (yh - yl + 1) * S, null, FUZZ_COLOR)) dirty++
        rects++
        continue
      }

      // A sprite is drawn column by column before the next one starts: when a different sprite arrives, close
      // the runs of the previous sprite so draw order (back to front) is preserved within the sprite pools.
      if (kind === 1) {
        for (const run of this.runs.values()) {
          if (run.kind === 1 && run.id !== id) {
            rects += this.flushRun(run, vwx, vwy, detailshift, centery, S, P) ? 1 : 0
            dirty += this.lastFlushDirty
            this.runs.delete(run.key)
            this.runPool.push(run)
          }
        }
      }

      const key = ((((type * 2 + masked) * 3 + kind) * 1024 + (id & 1023)) * 256 + (topdelta & 255)) * 32 + (shade >> 1)
      const run = this.runs.get(key)
      const tol = this.mergeTolerance
      if (
        run &&
        x === run.xEnd + 1 &&
        (col === run.colEnd || col === run.colEnd + 1) &&
        Math.abs(yl - run.yl) <= tol &&
        Math.abs(yh - run.yh) <= tol
      ) {
        run.xEnd = x
        run.colEnd = col
        continue
      }
      if (run) {
        rects += this.flushRun(run, vwx, vwy, detailshift, centery, S, P) ? 1 : 0
        dirty += this.lastFlushDirty
        this.runs.delete(key)
        this.runPool.push(run)
      }
      const nr = this.runPool.pop() ?? ({} as Run)
      nr.key = key; nr.type = type; nr.kind = kind; nr.id = id; nr.masked = masked; nr.topdelta = topdelta; nr.shade = shade
      nr.x0 = x; nr.xEnd = x; nr.col0 = col; nr.colEnd = col; nr.yl = yl; nr.yh = yh; nr.texmid = rec[b + 7]; nr.iscale = rec[b + 8]
      this.runs.set(key, nr)
    }

    for (const run of this.runs.values()) {
      rects += this.flushRun(run, vwx, vwy, detailshift, centery, S, P) ? 1 : 0
      dirty += this.lastFlushDirty
      this.runPool.push(run)
    }
    this.runs.clear()

    for (const pool of this.pools) {
      for (let i = pool.used; i < pool.prevUsed; i++) this.hideSlot(pool, i)
      pool.prevUsed = pool.used
    }

    this.stats.records = count
    this.stats.spans = spans
    this.stats.rects = rects
    this.stats.dirty = dirty
    this.stats.overflow = doom.recordOverflow()
    this.stats.encodeMs = Date.now() - t0
  }

  /** Per-pool slot usage for the last frame (debug). */
  debugPools(): string {
    const parts: string[] = []
    this.pools.forEach((pool, i) => {
      if (pool.prevUsed > 0) {
        const name = pool.texture ? pool.texture.src.replace(/^assets\/doom\//, '') : 'fuzz'
        parts.push(`${name}=${pool.prevUsed}`)
      }
    })
    return parts.join(' ')
  }

  private lastFlushDirty = 0

  /** Emit a run as textured rectangle(s). Returns true if at least one rect was emitted. */
  private flushRun(run: Run, vwx: number, vwy: number, detailshift: number, centery: number, S: number, P: number): boolean {
    this.lastFlushDirty = 0
    const rect = run.kind === 0 ? WALLS[run.id] : PATCHES[run.id]
    if (!rect) return false
    const pool =
      run.kind === 1
        ? this.spritePools[rect.page - ATLAS_WALL_PAGES]
        : run.masked
          ? this.maskedWallPools[rect.page]
          : this.wallPools[rect.page]
    if (!pool) return false
    const tint = TINTS[Math.min(33, Math.max(0, run.shade))]
    const left = (vwx + (run.x0 << detailshift)) * S
    const width = ((run.xEnd - run.x0 + 1) << detailshift) * S
    const rows = run.yh - run.yl + 1
    const c0 = Math.min(run.col0, rect.w - 1)
    const c1 = Math.min(run.colEnd, rect.w - 1) + 1
    const u0 = (rect.x + c0) / P
    const u1 = (rect.x + c1) / P
    const vTop = run.topdelta + (run.texmid + (run.yl - centery) * run.iscale) / 65536
    const vBot = run.topdelta + (run.texmid + (run.yh + 1 - centery) * run.iscale) / 65536
    const uv = this.uvScratch
    let emitted = false

    if (run.kind === 1) {
      const r0 = Math.max(0, Math.min(rect.h, vTop))
      const r1 = Math.max(0, Math.min(rect.h, vBot))
      uv[0] = u0; uv[1] = 1 - (rect.y + r1) / P; uv[2] = u0; uv[3] = 1 - (rect.y + r0) / P
      uv[4] = u1; uv[5] = 1 - (rect.y + r0) / P; uv[6] = u1; uv[7] = 1 - (rect.y + r1) / P
      if (this.write(pool, left, (vwy + run.yl) * S, width, rows * S, uv, tint)) this.lastFlushDirty++
      return true
    }

    // wall/sky: texture repeats vertically; split wherever the column crosses a texture-height boundary
    const h = rect.h
    const k0 = Math.floor(vTop / h)
    const k1 = Math.floor((vBot - 1e-4) / h)
    const pxPerRow = (rows * S) / (vBot - vTop)
    for (let k = k0; k <= k1; k++) {
      const segTop = k === k0 ? vTop : k * h
      const segBot = k === k1 ? vBot : (k + 1) * h
      const yTopPx = (vwy + run.yl) * S + (segTop - vTop) * pxPerRow
      const yBotPx = (vwy + run.yl) * S + (segBot - vTop) * pxPerRow
      const r0 = segTop - k * h
      const r1 = segBot - k * h
      uv[0] = u0; uv[1] = 1 - (rect.y + r1) / P; uv[2] = u0; uv[3] = 1 - (rect.y + r0) / P
      uv[4] = u1; uv[5] = 1 - (rect.y + r0) / P; uv[6] = u1; uv[7] = 1 - (rect.y + r1) / P
      if (this.write(pool, left, yTopPx, width, yBotPx - yTopPx, uv, tint)) this.lastFlushDirty++
      emitted = true
    }
    return emitted
  }

  private layers: Entity[] = []

  /** A full-panel container child of root with an explicit zIndex; pools are parented to layers so draw order is fixed. */
  private layer(z: number): Entity {
    while (this.layers.length <= z) {
      const e = engine.addEntity()
      UiTransform.create(e, {
        parent: this.root,
        positionType: YGPositionType.YGPT_ABSOLUTE,
        positionLeft: 0,
        positionLeftUnit: YGUnit.YGU_POINT,
        positionTop: 0,
        positionTopUnit: YGUnit.YGU_POINT,
        width: 320 * this.scale,
        widthUnit: YGUnit.YGU_POINT,
        height: 200 * this.scale,
        heightUnit: YGUnit.YGU_POINT,
        display: YGDisplay.YGD_FLEX,
        zIndex: this.layers.length
      } as any)
      this.layers.push(e)
    }
    return this.layers[z]
  }

  private newPool(src: string | null, wrap: TextureWrapMode, z = 0): Pool {
    const pool: Pool = {
      entities: [],
      used: 0,
      prevUsed: 0,
      sx: new Float64Array(0),
      sy: new Float64Array(0),
      sw: new Float64Array(0),
      sh: new Float64Array(0),
      su: new Float64Array(0),
      st: new Float64Array(0),
      visible: new Uint8Array(0),
      texture: src ? { src, wrapMode: wrap, filterMode: TextureFilterMode.TFM_POINT } : null,
      parent: this.layer(z)
    }
    this.pools.push(pool)
    return pool
  }

  private grow(pool: Pool, target: number) {
    const start = pool.entities.length
    const copy = (a: Float64Array, n: number) => { const b = new Float64Array(n); b.set(a); return b }
    pool.sx = copy(pool.sx, target); pool.sy = copy(pool.sy, target); pool.sw = copy(pool.sw, target); pool.sh = copy(pool.sh, target)
    pool.su = copy(pool.su, target * 8); pool.st = copy(pool.st, target)
    const vis = new Uint8Array(target); vis.set(pool.visible); pool.visible = vis
    for (let i = start; i < target; i++) {
      pool.sx[i] = -1; pool.st[i] = -1
      const e = engine.addEntity()
      UiTransform.create(e, {
        parent: pool.parent,
        positionType: YGPositionType.YGPT_ABSOLUTE,
        positionLeft: 0,
        positionLeftUnit: YGUnit.YGU_POINT,
        positionTop: 0,
        positionTopUnit: YGUnit.YGU_POINT,
        width: 1,
        widthUnit: YGUnit.YGU_POINT,
        height: 1,
        heightUnit: YGUnit.YGU_POINT,
        display: YGDisplay.YGD_NONE
      } as any)
      UiBackground.create(e, {
        color: Color4.White(),
        textureMode: BackgroundTextureMode.STRETCH,
        texture: pool.texture ? Material.Texture.Common(pool.texture) : undefined,
        uvs: pool.texture ? [0, 0, 0, 1, 1, 1, 1, 0] : []
      })
      pool.entities.push(e)
    }
  }

  /** Returns true when any component was written. */
  private write(pool: Pool, x: number, y: number, w: number, h: number, uv: number[] | null, tint: Color4, solid?: Color4): boolean {
    const i = pool.used++
    if (i >= pool.entities.length) this.grow(pool, Math.max(64, pool.entities.length * 2))
    let wrote = false
    if (pool.visible[i] === 0 || pool.sx[i] !== x || pool.sy[i] !== y || pool.sw[i] !== w || pool.sh[i] !== h) {
      const t = UiTransform.getMutable(pool.entities[i])
      t.positionLeft = x; t.positionTop = y; t.width = w; t.height = h; t.display = YGDisplay.YGD_FLEX
      pool.sx[i] = x; pool.sy[i] = y; pool.sw[i] = w; pool.sh[i] = h; pool.visible[i] = 1
      wrote = true
    }
    let uvChanged = false
    if (uv) {
      const o = i * 8
      for (let k = 0; k < 8; k++) if (pool.su[o + k] !== uv[k]) { uvChanged = true; break }
    }
    const tintKey = solid ? -2 - tint.r * 100 - solid.r * 1000 - solid.g * 10 : tint.r + (tint.a < 1 ? 100 : 0)
    if (uvChanged || pool.st[i] !== tintKey) {
      const bg = UiBackground.getMutable(pool.entities[i])
      if (uv) { bg.uvs = uv.slice(); const o = i * 8; for (let k = 0; k < 8; k++) pool.su[o + k] = uv[k] }
      if (solid) bg.color = Color4.create(solid.r * tint.r, solid.g * tint.r, solid.b * tint.r, 1)
      else bg.color = tint
      pool.st[i] = tintKey
      wrote = true
    }
    return wrote
  }

  private hideSlot(pool: Pool, i: number) {
    if (pool.visible[i] === 0) return
    UiTransform.getMutable(pool.entities[i]).display = YGDisplay.YGD_NONE
    pool.visible[i] = 0
  }
}
