// Player-facing settings, toggled from the on-screen panel (hold right-click to get a cursor while DOOM has the
// pointer locked). Plain data module so both the UI and the game system can read it.

export type Renderer = 'pixels' | 'textured'

export const CELL_OPTIONS = [4000, 8000, 16000] as const
export type Cells = (typeof CELL_OPTIONS)[number]

export const settings = {
  /** 'textured' = DOOM's draw calls as textured rectangles (option A); 'pixels' = downsampled framebuffer grid. */
  renderer: 'textured' as Renderer,
  /** Pixel-grid budget: 4000 -> 80x50, 8000 -> 113x71, 16000 -> 160x100. Used by the pixel renderer and by the
   *  menu/automap fallback of the textured renderer. */
  cells: 8000 as Cells,
  /** Presentation rate for the pixel grid and the textured view (the engine always runs at 35 Hz). */
  presentHz: 20,
  /** Last status line, shown in the panel and logged every 2 s. */
  status: 'loading DOOM…'
}

/** Output grid for a cell budget at DOOM's 320x200 aspect. */
export function gridFor(cells: number): { w: number; h: number } {
  const w = Math.max(8, Math.round(Math.sqrt(cells * 1.6)))
  return { w, h: Math.max(5, Math.round(w / 1.6)) }
}
