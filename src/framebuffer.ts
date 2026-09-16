// Framebuffer source contract for option B, plus a built-in test source.
//
// The real target is doomgeneric compiled to JS: with -DCMAP256 its DG_ScreenBuffer is a 320x200 Uint8Array of
// palette indices and PLAYPAL gives 256 RGB triplets. Anything implementing FrameSource plugs into FbDisplay.

export interface FrameSource {
  readonly width: number
  readonly height: number
  /** 256 RGB triplets (768 bytes), like DOOM's PLAYPAL lump. */
  readonly palette: Uint8Array
  /** Advance the simulation and return the current frame as palette indices (width*height bytes). */
  render(dt: number): Uint8Array
}
