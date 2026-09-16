// DOOM inside a Decentraland scene.
//
// The real doomgeneric engine (compiled to plain JavaScript, see engine/) runs every scene tick while the player
// is at the arcade cabinet (src/cabinet.ts). Its output is presented either as a downsampled pixel grid
// ('pixels') or as DOOM's own draw calls turned into textured UI rectangles ('textured'); the on-screen panel
// toggles between them and picks the pixel-grid budget.

import {
  BackgroundTextureMode,
  engine,
  Entity,
  executeTask,
  PrimaryPointerInfo,
  UiBackground,
  UiTransform,
  YGDisplay,
  YGOverflow,
  YGPositionType,
  YGUnit
} from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'

import { arcade, setupCabinet } from './cabinet'
import { DoomInput } from './engine/input'
import { DoomSource } from './engine/doom'
import { RecordView } from './engine/recordview'
import { FbDisplay } from './fbdisplay'
import { PANEL_H, PANEL_LEFT, PANEL_TOP, PANEL_W, SBAR_Y, SCALE, uiScale } from './layout'
import { gridFor, settings } from './settings'
import { setupUi } from './ui'

// ---- presenters ----
const initialGrid = gridFor(settings.cells)
const pixelDisplay = new FbDisplay({
  outW: initialGrid.w,
  outH: initialGrid.h,
  panelLeft: PANEL_LEFT,
  panelTop: PANEL_TOP,
  panelW: PANEL_W,
  panelH: PANEL_H,
  bitsPerChannel: 4,
  maxRects: 16000,
  presentMode: 'grid'
})
const statusBar = new FbDisplay({
  outW: 160,
  outH: 16,
  panelLeft: PANEL_LEFT,
  panelTop: PANEL_TOP + SBAR_Y * SCALE,
  panelW: PANEL_W,
  panelH: (200 - SBAR_Y) * SCALE,
  bitsPerChannel: 4,
  maxRects: 160 * 16,
  presentMode: 'grid'
})
const SBAR_RECT = { x: 0, y: SBAR_Y, w: 320, h: 200 - SBAR_Y }
const texturedView = new RecordView(PANEL_LEFT, PANEL_TOP, SCALE, true)

// ---- screen window ----
// The presenters live inside one clipping container. When the player sits down it grows from the centre of the
// panel to full size while the presenters slide the opposite way, so the picture stays put and is revealed like
// a screen switching on. Presenter positions are relative to this container; at full size it is the panel.
const APPEAR_S = 0.7
const screenClip = engine.addEntity()
UiTransform.create(screenClip, {
  parent: 0 as Entity,
  positionType: YGPositionType.YGPT_ABSOLUTE,
  positionLeft: PANEL_LEFT,
  positionLeftUnit: YGUnit.YGU_POINT,
  positionTop: PANEL_TOP,
  positionTopUnit: YGUnit.YGU_POINT,
  width: PANEL_W,
  widthUnit: YGUnit.YGU_POINT,
  height: PANEL_H,
  heightUnit: YGUnit.YGU_POINT,
  overflow: YGOverflow.YGO_HIDDEN,
  display: YGDisplay.YGD_NONE
} as any)
UiBackground.create(screenClip, { color: Color4.create(0, 0, 0, 1), textureMode: BackgroundTextureMode.STRETCH, uvs: [] })
pixelDisplay.attachTo(screenClip)
statusBar.attachTo(screenClip)
texturedView.attachTo(screenClip)
/** Progress of the screen-on animation, 0..APPEAR_S; APPEAR_S once fully open. */
let appearT = APPEAR_S

function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3)
}

/** Size the window to `f` (0..1) of the panel around its centre and keep the presenters on the panel. */
function setWindow(f: number) {
  const s = uiScale()
  const w = PANEL_W * s * f
  const h = PANEL_H * s * f
  const left = (PANEL_LEFT + PANEL_W / 2) * s - w / 2
  const top = (PANEL_TOP + PANEL_H / 2) * s - h / 2
  const t = UiTransform.getMutable(screenClip)
  t.positionLeft = left
  t.positionTop = top
  t.width = w
  t.height = h
  pixelDisplay.setOrigin(PANEL_LEFT * s - left, PANEL_TOP * s - top)
  statusBar.setOrigin(PANEL_LEFT * s - left, (PANEL_TOP + SBAR_Y * SCALE) * s - top)
  texturedView.setOrigin(PANEL_LEFT * s - left, PANEL_TOP * s - top)
}

function animateWindow(dt: number) {
  if (appearT >= APPEAR_S) return
  appearT = Math.min(APPEAR_S, appearT + dt)
  setWindow(easeOutCubic(appearT / APPEAR_S))
  if (appearT >= APPEAR_S) arcade.screenOn = true
}

// ---- engine ----
let doom: DoomSource | null = null
const input = new DoomInput()
executeTask(async () => {
  try {
    doom = await DoomSource.create((line) => console.log('[doom] ' + line))
    console.log('[doom] ready')
  } catch (e) {
    settings.status = 'DOOM failed to start: ' + String(e)
    console.log('[doom] FAILED ' + ((e as Error)?.stack ?? String(e)))
  }
})

// ---- per-tick state ----
let appliedRenderer: string | null = null
let appliedCells = 0
let appliedDetail: boolean | null = null
let appliedScale = 0
let showingTexturedView = false
let accum = 0
let ticks = 0
let presented = 0
let lastReport = Date.now()

function showPresenters() {
  // Forces applySettings to re-show the presenter for the current renderer on the next tick.
  appliedRenderer = null
  appearT = 0
  setWindow(0)
  UiTransform.getMutable(screenClip).display = YGDisplay.YGD_FLEX
  accum = 0
  ticks = 0
  presented = 0
  lastReport = Date.now()
}

function hidePresenters() {
  if (doom) input.releaseAll(doom)
  showingTexturedView = false
  texturedView.setVisible(false)
  statusBar.setVisible(false)
  pixelDisplay.setVisible(false)
  UiTransform.getMutable(screenClip).display = YGDisplay.YGD_NONE
}

function applySettings() {
  // Raw UI components are in canvas pixels; follow the React-ECS virtual-canvas scale so the panel, the status bar
  // and the React controls strip stay aligned when the window is resized.
  const s = uiScale()
  if (s !== appliedScale) {
    appliedScale = s
    // Positions are relative to the screen window, which at full size coincides with the panel.
    pixelDisplay.setGeometry(0, 0, PANEL_W * s, PANEL_H * s)
    statusBar.setGeometry(0, SBAR_Y * SCALE * s, PANEL_W * s, (200 - SBAR_Y) * SCALE * s)
    texturedView.setGeometry(0, 0, SCALE * s)
    setWindow(appearT >= APPEAR_S ? 1 : easeOutCubic(appearT / APPEAR_S))
  }
  if (settings.cells !== appliedCells) {
    const g = gridFor(settings.cells)
    pixelDisplay.resize(g.w, g.h)
    appliedCells = settings.cells
  }
  if (settings.renderer !== appliedRenderer) {
    appliedRenderer = settings.renderer
    showingTexturedView = false
    texturedView.setVisible(false)
    statusBar.setVisible(false)
    pixelDisplay.setVisible(true)
  }
  // Textured view: DOOM's low-detail mode halves the rectangle count at unchanged vertical resolution.
  // Pixel grid: full 320 columns so the 160x100 grid has a finer source.
  const wantLow = settings.renderer === 'textured'
  if (doom && appliedDetail !== wantLow) {
    doom.setDetail(wantLow)
    appliedDetail = wantLow
  }
}

function doomSystem(dt: number) {
  if (!arcade.active) return
  applySettings()
  animateWindow(dt)
  ticks++
  if (!doom) return

  const pointer = PrimaryPointerInfo.getOrNull(engine.RootEntity)
  input.poll(doom, pointer?.screenDelta)
  const frame = doom.render(dt)

  accum += dt
  const interval = 1 / settings.presentHz
  if (accum >= interval) {
    accum %= interval
    presented++
    if (settings.renderer === 'textured') {
      // 3D view drawn and no menu/automap on top -> textured records + pixel status bar; otherwise pixel grid
      const useView = doom.recordCount() > 0 && doom.view(6) === 0 && doom.view(7) === 0
      if (useView !== showingTexturedView) {
        showingTexturedView = useView
        texturedView.setVisible(useView)
        statusBar.setVisible(useView)
        pixelDisplay.setVisible(!useView)
      }
      if (useView) {
        texturedView.present(doom)
        if (doom.view(3) < 200) statusBar.present(doom, frame, SBAR_RECT)
      } else {
        pixelDisplay.present(doom, frame)
      }
    } else {
      pixelDisplay.present(doom, frame)
    }
  }

  const now = Date.now()
  if (now - lastReport >= 2000) {
    const secs = (now - lastReport) / 1000
    const grid = `${pixelDisplay.opts.outW}x${pixelDisplay.opts.outH}`
    settings.status =
      settings.renderer === 'textured'
        ? `textured 160 cols | ${(presented / secs).toFixed(0)} fps | ${texturedView.stats.rects} rects (${texturedView.stats.dirty} dirty)` +
          ` | engine ${(ticks / secs).toFixed(0)} ticks/s, ${doom.lastTickMs} ms/tick` +
          (showingTexturedView ? '' : ` | pixel fallback ${grid}`)
        : `pixels ${grid} | ${(presented / secs).toFixed(0)} fps | ${pixelDisplay.stats.dirtyRects} dirty cells` +
          ` | engine ${(ticks / secs).toFixed(0)} ticks/s, ${doom.lastTickMs} ms/tick`
    console.log('[doom] ' + settings.status)
    ticks = 0
    presented = 0
    lastReport = now
  }
}

export function main() {
  setupUi()
  setupCabinet({ onEnter: showPresenters, onLeave: hidePresenters })
  engine.addSystem(doomSystem)
}
