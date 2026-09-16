// Option B display adapter: 8-bit indexed framebuffer -> downsample -> palette quantization -> per-row RLE ->
// pooled raw UiTransform/UiBackground rectangles (no React), mutated in place with dirty tracking.
import {
  BackgroundTextureMode,
  engine,
  Entity,
  UiBackground,
  UiTransform,
  YGDisplay,
  YGPositionType,
  YGUnit
} from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'

import type { FrameSource } from './framebuffer'

export interface FbDisplayOptions {
  /** Output grid size in cells. */
  outW: number
  outH: number
  /** Screen-space panel in canvas pixels (virtual units x uiScale(), see layout.ts). */
  panelLeft: number
  panelTop: number
  panelW: number
  panelH: number
  /** Bits per channel kept when quantizing palette colors (fewer bits = longer runs = fewer rects). */
  bitsPerChannel: number
  /** Max rectangles the pool may hold; rows beyond the budget are dropped for that frame. */
  maxRects: number
  /**
   * 'rle'  = per-row run-length rectangles (fewer elements, but transforms move every frame -> client layout cost)
   * 'grid' = one static cell per output pixel, only colors are written when they change (more elements, no layout)
   */
  presentMode: 'rle' | 'grid'
}

export interface FbStats {
  rects: number
  dirtyRects: number
  dropped: number
  encodeMs: number
}

export class FbDisplay {
  readonly opts: FbDisplayOptions
  readonly stats: FbStats = { rects: 0, dirtyRects: 0, dropped: 0, encodeMs: 0 }

  private root: Entity
  private pool: Entity[] = []
  // shadow of what each pool slot currently shows, to skip redundant component writes
  private shadowX = new Int32Array(0)
  private shadowY = new Int32Array(0)
  private shadowW = new Int32Array(0)
  private shadowC = new Int32Array(0)
  private shadowVisible = new Uint8Array(0)
  private used = 0

  private quant = new Int32Array(256) // palette index -> quantized color id
  private colorCache = new Map<number, Color4>()
  private cells: Uint8Array
  private paletteRef: Uint8Array | null = null

  constructor(opts: FbDisplayOptions) {
    this.opts = opts
    this.cells = new Uint8Array(opts.outW * opts.outH)
    this.root = engine.addEntity()
    UiTransform.create(this.root, {
      parent: 0 as Entity,
      positionType: YGPositionType.YGPT_ABSOLUTE,
      positionLeft: opts.panelLeft,
      positionLeftUnit: YGUnit.YGU_POINT,
      positionTop: opts.panelTop,
      positionTopUnit: YGUnit.YGU_POINT,
      width: opts.panelW,
      widthUnit: YGUnit.YGU_POINT,
      height: opts.panelH,
      heightUnit: YGUnit.YGU_POINT,
      display: YGDisplay.YGD_NONE
    } as any)
    UiBackground.create(this.root, { color: Color4.create(0, 0, 0, 1), textureMode: BackgroundTextureMode.STRETCH, uvs: [] })
    this.growPool(Math.min(opts.maxRects, 512))
  }

  /** Parent the panel to a UI container; positions are then relative to it (canvas pixels). */
  attachTo(parent: Entity) {
    UiTransform.getMutable(this.root).parent = parent
  }

  /** Move the panel without touching the slots (they are positioned relative to the root). */
  setOrigin(left: number, top: number) {
    const o = this.opts
    if (left === o.panelLeft && top === o.panelTop) return
    o.panelLeft = left
    o.panelTop = top
    const t = UiTransform.getMutable(this.root)
    t.positionLeft = left
    t.positionTop = top
  }

  setVisible(v: boolean) {
    UiTransform.getMutable(this.root).display = v ? YGDisplay.YGD_FLEX : YGDisplay.YGD_NONE
    if (!v) {
      // hide all slots so a later show starts clean
      for (let i = 0; i < this.used; i++) this.hideSlot(i)
      this.used = 0
    }
  }

  /** Change the output grid at runtime (e.g. from the size cubes). */
  resize(outW: number, outH: number) {
    if (outW === this.opts.outW && outH === this.opts.outH) return
    this.opts.outW = outW
    this.opts.outH = outH
    this.cells = new Uint8Array(outW * outH)
    for (let i = 0; i < this.used; i++) this.hideSlot(i)
    this.used = 0
  }

  /** Move/resize the panel (canvas pixels). Slots are hidden so the next present rewrites every transform. */
  setGeometry(left: number, top: number, w: number, h: number) {
    const o = this.opts
    if (left === o.panelLeft && top === o.panelTop && w === o.panelW && h === o.panelH) return
    o.panelLeft = left
    o.panelTop = top
    o.panelW = w
    o.panelH = h
    const t = UiTransform.getMutable(this.root)
    t.positionLeft = left
    t.positionTop = top
    t.width = w
    t.height = h
    for (let i = 0; i < this.used; i++) this.hideSlot(i)
    this.used = 0
  }

  setPresentMode(mode: 'rle' | 'grid') {
    if (mode === this.opts.presentMode) return
    this.opts.presentMode = mode
    for (let i = 0; i < this.used; i++) this.hideSlot(i)
    this.used = 0
  }

  destroy() {
    for (const e of this.pool) engine.removeEntity(e)
    engine.removeEntity(this.root)
    this.pool = []
  }

  /** Encode one frame (or a sub-rectangle of it) and push the rectangles to the UI. */
  present(src: FrameSource, frame: Uint8Array, srcRect?: { x: number; y: number; w: number; h: number }) {
    const t0 = Date.now()
    if (this.paletteRef !== src.palette) this.buildQuantTable(src.palette)
    const { outW, outH, panelW, panelH, maxRects } = this.opts
    const cellW = panelW / outW
    const cellH = panelH / outH

    // 1) downsample by center sampling, quantize to color ids
    const cells = this.cells
    const sw = src.width
    const rx = srcRect ? srcRect.x : 0
    const ry = srcRect ? srcRect.y : 0
    const rw = srcRect ? srcRect.w : src.width
    const rh = srcRect ? srcRect.h : src.height
    for (let oy = 0; oy < outH; oy++) {
      const sy = ry + ((((oy + 0.5) * rh) / outH) | 0)
      const rowBase = sy * sw
      const outBase = oy * outW
      for (let ox = 0; ox < outW; ox++) {
        const sx = rx + ((((ox + 0.5) * rw) / outW) | 0)
        cells[outBase + ox] = frame[rowBase + sx]
      }
    }

    let slot = 0
    let dirty = 0
    let dropped = 0
    const quant = this.quant

    if (this.opts.presentMode === 'grid') {
      // 2a) static cell grid: slot i == cell i, transforms are written once, colors only when they change
      const n = outW * outH
      const limit = Math.min(n, maxRects)
      if (this.pool.length < limit) this.growPool(limit)
      for (let i = 0; i < limit; i++) {
        if (this.writeSlot(i, i % outW, (i / outW) | 0, 1, quant[cells[i]], cellW, cellH)) dirty++
      }
      slot = limit
      dropped = n - limit
      for (let i = slot; i < this.used; i++) this.hideSlot(i)
      this.used = slot
      this.stats.rects = slot
      this.stats.dirtyRects = dirty
      this.stats.dropped = dropped
      this.stats.encodeMs = Date.now() - t0
      return
    }

    // 2b) per-row RLE on quantized ids -> rectangles assigned to pool slots
    for (let oy = 0; oy < outH; oy++) {
      const outBase = oy * outW
      let runStart = 0
      let runId = quant[cells[outBase]]
      for (let ox = 1; ox <= outW; ox++) {
        const id = ox < outW ? quant[cells[outBase + ox]] : -1
        if (id !== runId) {
          if (slot < maxRects) {
            if (slot >= this.pool.length) this.growPool(Math.min(maxRects, Math.max(this.pool.length * 2, 256)))
            if (this.writeSlot(slot, runStart, oy, ox - runStart, runId, cellW, cellH)) dirty++
            slot++
          } else {
            dropped++
          }
          runStart = ox
          runId = id
        }
      }
    }
    // 3) hide slots that were used last frame but not this one
    for (let i = slot; i < this.used; i++) this.hideSlot(i)
    this.used = slot

    this.stats.rects = slot
    this.stats.dirtyRects = dirty
    this.stats.dropped = dropped
    this.stats.encodeMs = Date.now() - t0
  }

  private buildQuantTable(palette: Uint8Array) {
    this.paletteRef = palette
    const shift = 8 - this.opts.bitsPerChannel
    for (let i = 0; i < 256; i++) {
      const r = palette[i * 3] >> shift
      const g = palette[i * 3 + 1] >> shift
      const b = palette[i * 3 + 2] >> shift
      this.quant[i] = (r << 16) | (g << 8) | b
    }
    this.colorCache.clear()
    // colors in the pool shadow are stale relative to the new ids
    this.shadowC.fill(-1)
  }

  private colorFor(id: number): Color4 {
    let c = this.colorCache.get(id)
    if (!c) {
      const shift = 8 - this.opts.bitsPerChannel
      const max = (1 << this.opts.bitsPerChannel) - 1
      const r = (id >> 16) & 0xff
      const g = (id >> 8) & 0xff
      const b = id & 0xff
      // expand quantized channel back to 0..1 using the bucket center
      const k = (v: number) => (v + 0.5) / (max + 1)
      c = Color4.create(k(r), k(g), k(b), 1)
      void shift
      this.colorCache.set(id, c)
    }
    return c
  }

  private growPool(target: number) {
    const start = this.pool.length
    if (target <= start) return
    const nx = new Int32Array(target)
    const ny = new Int32Array(target)
    const nw = new Int32Array(target)
    const nc = new Int32Array(target)
    const nv = new Uint8Array(target)
    nx.set(this.shadowX)
    ny.set(this.shadowY)
    nw.set(this.shadowW)
    nc.set(this.shadowC)
    nv.set(this.shadowVisible)
    for (let i = start; i < target; i++) {
      nx[i] = -1
      ny[i] = -1
      nw[i] = -1
      nc[i] = -1
      const e = engine.addEntity()
      UiTransform.create(e, {
        parent: this.root,
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
      UiBackground.create(e, { color: Color4.create(0, 0, 0, 1), textureMode: BackgroundTextureMode.STRETCH, uvs: [] })
      this.pool.push(e)
    }
    this.shadowX = nx
    this.shadowY = ny
    this.shadowW = nw
    this.shadowC = nc
    this.shadowVisible = nv
  }

  /** Returns true when a component write happened. */
  private writeSlot(i: number, x: number, y: number, w: number, colorId: number, cellW: number, cellH: number): boolean {
    let wrote = false
    const e = this.pool[i]
    if (this.shadowX[i] !== x || this.shadowY[i] !== y || this.shadowW[i] !== w || this.shadowVisible[i] === 0) {
      const t = UiTransform.getMutable(e)
      t.positionLeft = x * cellW
      t.positionTop = y * cellH
      t.width = w * cellW
      t.height = cellH
      t.display = YGDisplay.YGD_FLEX
      this.shadowX[i] = x
      this.shadowY[i] = y
      this.shadowW[i] = w
      this.shadowVisible[i] = 1
      wrote = true
    }
    if (this.shadowC[i] !== colorId) {
      UiBackground.getMutable(e).color = this.colorFor(colorId)
      this.shadowC[i] = colorId
      wrote = true
    }
    return wrote
  }

  private hideSlot(i: number) {
    if (this.shadowVisible[i] === 0) return
    UiTransform.getMutable(this.pool[i]).display = YGDisplay.YGD_NONE
    this.shadowVisible[i] = 0
    this.shadowX[i] = -1
  }
}
