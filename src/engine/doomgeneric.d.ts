// Type surface of the Emscripten (wasm2js, -sWASM=0) build of doomgeneric produced by engine/Makefile.
// Exports come from engine/doomgeneric_dcl.c (EMSCRIPTEN_KEEPALIVE) plus the runtime methods requested at link time.

export interface DoomModule {
  HEAPU8: Uint8Array
  HEAPU32: Uint32Array
  FS: {
    writeFile(path: string, data: Uint8Array | string): void
    mkdir(path: string): void
  }
  _dg_dcl_init(): void
  _dg_dcl_tick(): number
  _dg_dcl_set_time(ms: number): void
  _dg_dcl_get_time(): number
  _dg_dcl_key(pressed: number, key: number): void
  _dg_dcl_mouse(buttons: number, dx: number, dy: number): void
  _dg_dcl_framebuffer(): number
  _dg_dcl_width(): number
  _dg_dcl_height(): number
  _dg_dcl_palette(): number
  _dg_dcl_palette_changed(): number
  /** 0 = 320 columns, 1 = low detail (160 columns). */
  _dg_dcl_set_detail(detail: number): void
  _dg_dcl_records(): number
  _dg_dcl_record_count(): number
  _dg_dcl_record_overflow(): number
  /** 0 viewwindowx 1 viewwindowy 2 scaledviewwidth 3 viewheight 4 detailshift 5 centery 6 menuactive 7 automapactive 8 gamestate 9 numtextures 10 numflats 11 firstspritelump 12 skytexture */
  _dg_dcl_view(what: number): number
}

export interface DoomModuleOptions {
  print?: (line: string) => void
  printErr?: (line: string) => void
}

// The module sets both module.exports and module.exports.default to the factory.
declare function createDoom(options?: DoomModuleOptions): Promise<DoomModule>
export default createDoom
