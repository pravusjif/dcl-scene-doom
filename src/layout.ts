// Screen layout on the 1920x1080 virtual canvas: the DOOM screen is a 1280x800 panel (4 px per DOOM pixel).
//
// React-ECS scales its tree by the contain-fit of the virtual canvas inside the real one; raw UiTransform values
// are canvas pixels and get no scaling. The presenters therefore multiply every virtual value by uiScale(), which is
// the same factor React-ECS computes (see @dcl/react-ecs UiScaleSystem), so the DOOM panel and the React strip
// around it stay aligned at any window size.
import { engine, UiCanvasInformation } from '@dcl/sdk/ecs'

export const VIRTUAL_W = 1920
export const VIRTUAL_H = 1080

/** Canvas pixels per virtual unit; 1 until the client has reported its canvas size. */
export function uiScale(): number {
  const c = UiCanvasInformation.getOrNull(engine.RootEntity)
  if (!c || !(c.width > 0) || !(c.height > 0)) return 1
  return Math.min(c.width / VIRTUAL_W, c.height / VIRTUAL_H)
}

export const PANEL_W = 1280
export const PANEL_H = 800
export const SCALE = PANEL_W / 320
export const PANEL_LEFT = (1920 - PANEL_W) / 2
export const PANEL_TOP = (1080 - PANEL_H) / 2 + 40
/** First row of the status bar in DOOM's 320x200 frame (view height 168 with the default screen size). */
export const SBAR_Y = 168
