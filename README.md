# DOOM inside a Decentraland scene

The original 1993 DOOM engine running inside a Decentraland SDK7 scene, drawn with the client's own UI
primitives. No WebAssembly, no canvas, no custom client: a stock desktop Explorer plays the shareware E1M1 with
WASD, mouse look, textured walls, floors, sprites and a legible status bar.

An unofficial port: not affiliated with or endorsed by id Software, Bethesda or Microsoft. See [Licence](#licence).

This repository is the playable scene. The measurements quoted below come from its benchmark twin,
`dcl-doom-benchmarks`, which kept every experimental mode; this scene keeps only the two renderers that won.

## The problem

A Decentraland scene runs JavaScript in a sandbox with no pixel API. There is no canvas, no render-to-texture,
no way to build a texture from bytes, `fetch` cannot return binary, and WebAssembly is deliberately disabled by
the Explorer. Every "DOOM on X" port has to solve two independent problems, and so did this one:

1. **Compute** — run the engine's game logic and software renderer somewhere the scene can reach.
2. **Display** — map the resulting 320x200 frame onto something the client already knows how to draw.

## How it works

```
  doomgeneric (C) ──emcc -sWASM=0──▶ doomgeneric.js (plain JS, 0.7 MB)
        │  DG_* platform hooks           │ runs on the Explorer's V8 (JIT), 0–2 ms per tick
        │                                ▼
        │                     DoomSource (FrameSource)         input.ts: WASD / mouse / click → DOOM keys
        │                     ├─ 320x200 palette-index frame
        │                     └─ draw-call records (option A)
        ▼                                ▼
  dcl_record.c ─┐        ┌── RecordView: pooled textured UI rects  (3D view, 160/320 columns)
  colfunc/spanfunc wraps  ├── FbDisplay: 160x16 pixel grid          (status bar strip)
                          └── FbDisplay: 80x50 pixel grid           (menus, automap, intermission)
```

### Compute: the real engine, compiled to plain JavaScript

**Decision: compile [doomgeneric](https://github.com/ozkl/doomgeneric) with Emscripten to JavaScript, not
WebAssembly, and not a rewrite.**

- There is no complete hand-written JS/TS DOOM; every playable managed-language DOOM is a translation of the
  C source. Rewriting the engine (BSP, visplanes, thinkers, 30 years of WADs) was out of scope, and the earlier
  DDA raycaster in the hackathon scene is a Wolfenstein-class engine that cannot run DOOM content.
- The Explorer stubs `WebAssembly.Module`/`Instance` in the scene sandbox, so the engine must ship as JS.
  Emscripten's `-sWASM=0` (wasm2js) emits asm.js-style JavaScript that needs only typed arrays and `Math.imul`;
  it carries its own local `WebAssembly` polyfill, so the stubs never matter. It is deprecated upstream, so the
  SDK version is pinned (Homebrew `emscripten` 6.0.7 works).
- Scene code on the desktop Explorer runs on ClearScript V8 **with JIT** (the docs still say QuickJS; that is
  stale for desktop). Measured cost: module init 42 ms, `D_DoomMain` 32 ms, **0.48 ms per engine tick**.
- `engine/doomgeneric_dcl.c` is the platform layer: no window, no clock, no input device. The scene drives it
  through `dg_dcl_*` exports (set_time / tick / key / mouse / framebuffer / palette / records / view / detail).
  Built with `-DCMAP256 -DDOOMGENERIC_RESX=320 -DDOOMGENERIC_RESY=200`, so `DG_ScreenBuffer` is a plain 64 KB
  copy of the 8-bit framebuffer and no RGB conversion happens in C.
- **Gotcha:** `TryRunTics` busy-waits on `I_Sleep(1)` until the clock crosses the next 35 Hz tic boundary. With a
  clock that only advances from the scene tick, the first call never returns. `DG_SleepMs` therefore advances
  the simulated clock, the scene reads it back and never sets it backwards, so time stays monotonic and at most
  one tic ahead of real time.
- **WAD delivery:** the runtime's `fetch` has only `text()`/`json()`, so the shareware `doom1.wad` (4.2 MB)
  ships inside the bundle as a base64 TypeScript string (`src/engine/doom1.wad.b64.ts`, 5.6 MB) and is decoded
  into Emscripten's in-memory filesystem at startup. Production bundle: **6.7 MB**, under the 15 MB parcel limit
  (the dev bundle is 23 MB because of the inline sourcemap).
- Sound is stubbed for now (no `FEATURE_SOUND`); the plan is `AudioSource.playSound` on pre-extracted sfx.

### Input: freeze the avatar, keep the keys

**Decision: `InputModifier disableAll` + `PointerLock`, poll `inputSystem.isPressed`, read
`PrimaryPointerInfo.screenDelta`.**

Verified in the Explorer source: WASD input actions keep reaching the scene while `InputModifier` freezes the
avatar (the modifier only mutates locomotion flags), and `screenDelta` keeps reporting while the pointer is
locked. `src/engine/input.ts` emits DOOM key down/up on edges: W/S forward/back (menu up/down), A/D strafe,
mouse turns, left click fires, **E or Space = use** (doors, switches, lifts), F = Enter (menu confirm), Shift =
run, 1–3 weapons, **4 = Esc** (menu). A controls strip is shown under the screen while DOOM is active. Desktop only:
`InputModifier` has no effect in the web client.

### The arcade cabinet

The parcel holds one arcade cabinet (`assets/cabinet/`, the model from the hackathon scene; two black boxes
parented to it cover the branded marquee at the top and the back face, and a `TextShape` on the marquee reads
DECENTRADOOM). Nothing is drawn
until the player presses **E** on it (`src/cabinet.ts`): entering freezes the avatar, locks the pointer, hides
avatars around the cabinet with an `AvatarModifierArea`, switches `MainCamera` to a `VirtualCamera` parked in
front of the cabinet's screen (so the DOOM panel sits over the glass with the cabinet around it); once the client
camera has settled there (a 0.6 s transition, checked against the camera transform with a timed fallback) the
engine starts ticking and the game appears. An optional screen-on animation (`SCREEN_ANIMATION` in
`src/index.ts`, off by default) grows the screen out of the centre of the panel over 0.7 s: the presenters sit
inside one `overflow: hidden` UI container that scales up while they slide the opposite way, so the picture is
revealed in place rather than stretched (four component writes per frame instead of rewriting every cell). The settings panel has a **Leave cabinet** button (hold right-click for a cursor) that
reverses every step; the engine keeps its state, so the game resumes where it was on the next visit.

### Progress, savegames and the leaderboard: a multiplayer server

**Decision: the `@dcl/sdk@auth-server` multiplayer server keeps progress, savegames and the leaderboard; the
engine stays on the client.**

The scene runs one bundle on both sides (`src/index.ts` branches on `isServer()`). The headless server
(`src/server/server.ts`, QuickJS, no DOOM) validates and scores what clients report and persists it in server
storage; the client (`src/client/`) plays and reports.

- **Leaderboard data comes from the engine, not from savegames.** `dg_dcl_stat` exposes the live player stats and
  the intermission struct (`wminfo`: kills, items, secrets, time, par of the level just finished). The client
  detects the level -> intermission transition and sends `levelDone`; the server checks the bounds (episode 1,
  maps 1-9, skill 0-4, counts within the level totals), scores it (1000 per level + 10/kill + 2/item + 50/secret
  + 5 per second under par, times a difficulty multiplier: 50 % on I'm too young to die, 75 %, 100 % on Hurt me
  plenty, 125 %, 150 % on Nightmare; best result per level counts), writes the player's `Progress` JSON to per-player storage and
  the top 10 to scene storage, and republishes a synced `Leaderboard` component. Trust-based: the server cannot
  replay the game, so the checks are sanity bounds, not anti-cheat.
- **Savegames are opaque blobs.** `dg_dcl_save(slot)` / `dg_dcl_load(slot)` drive the engine's own save/load
  (Chocolate-Doom portable format, ~25 KB at the start of E1M1, vanilla cap 180 KB) through the module
  filesystem; the scene reads the bytes back, base64-encodes them and streams them to the server in 8 KB chunks
  (room messages are dropped above ~13 KB), one per tick so the loading bar next to the Save/Load buttons means
  something. The server stores the blob plus a small parsed summary (`SaveMeta`: map, skill, health, counts,
  read from fixed header offsets) under the player. Loading streams it back, writes it into the module
  filesystem and calls the engine's load.
- **Signs.** Two in-world `TextShape` panels flank the cabinet: the viewer's own progress (plus live level stats
  while playing) and the global top 10, always ten rows (dashes for empty ranks). A **Delete record** button
  in the settings panel (with an in-place confirmation) wipes the player's progress, savegame and leaderboard row. A server heartbeat component gates everything: with no heartbeat
  observed for 6 s the signs say "server offline" and the Save/Load buttons disable.
- `Storage.get` on a missing key logs a 404 in the server log; harmless, first run only.

### Display, step 1: what can the client actually draw per frame?

Before building anything, the benchmark twin mutated every candidate primitive every scene
tick at 500–8000 cells and measured with the Explorer MCP (`get_performance_stats`; use
`framesSampled / sampleSeconds` — its `averageFps` field reported 120 while the client was at 3 FPS). The
numbers that drove the design (desktop Explorer, M-series MacBook Pro, client baseline 120 FPS, scene tick
target 40):

| Primitive, all cells changing every tick | 1000 | 2000 | 4000 | 8000 |
|---|---|---|---|---|
| React-ECS `UiEntity`, colour | 37.6 t/s · 118 fps | 36.6 · 82 | 22.6 · 98 | 10.7 · 96 |
| React-ECS `UiEntity`, texture + `uvs` | 38.0 · ~82 | 21.5 · 68 | 7.8 · 93 | 2.6 · 97 |
| Raw `UiBackground`, colour | 36.2 · 117 | — | 36.7 · 82 | 37.7 · 26 |
| Raw `UiBackground`, texture + `uvs` | — | 37.9 · 57 | 21.4 · 48 | 8.8 · 55 |
| `TextShape` (TMP) rich text, 1 component | 36.1 · 84 (37 KB/tick) | — | 36.3 · 30 (143 KB) | 36.6 · 17 (287 KB) |
| UI `Label` rich text, 1 component | 22.8 · **3** | — | — | — |

(`t/s` = scene ticks per second, which is the true end-to-end bridge throughput: the runtime awaits the
client's synchronous CRDT apply, so a slow client apply shows up as a low tick rate.)

Decisions taken from this table:

1. **Bypass React-ECS.** Reconciliation is the dominant scene-side cost; raw pooled `UiTransform`/`UiBackground`
   components mutated in place hold the full tick rate where React drops to 10 t/s.
2. **Budget ≈ 4000 colour cells or ≈ 2000 textured rects per tick**; UI Toolkit tops out near 8000 updated
   elements. Textured updates cost 3–4x a colour update.
3. **Text mode is dead on screen-space UI** (3 FPS) and only viable as an in-world `TextShape`, one pixel per
   cell via `<mark>` (block glyphs come from a fallback font at half size). Kept as a future arcade-cabinet idea.
4. **Static cells beat moving rectangles.** A run-length presenter with 3–5x fewer elements lost badly (20 FPS,
   45 hiccups) to a static grid with dirty colour writes (78 FPS) at the same resolution, because moving
   transforms trigger UI layout every frame. Every later design treats *moving element count* as the one knob
   that matters.

### Display, step 2 (option B, the `Doom (pixels)` renderer): the framebuffer as a pixel grid

`src/fbdisplay.ts` downsamples the 320x200 frame to an `outW x outH` grid at DOOM's 1.6 aspect, quantizes to 4
bits per channel, and writes only the cells whose colour changed into a static pool of raw UI rectangles. Any
`FrameSource` (a 320x200 palette-index frame + 768-byte palette) plugs in; a test raycaster fed it before the
engine existed. Measured with real DOOM and the title demo moving: **80x50 at 20 Hz → 61 FPS, no hiccups**;
113x71 at 35 Hz → 27 FPS with 30 hiccups. Good enough to prove the engine and input end to end, too blocky to be
the final look — but it stays in the design as the presenter for the status bar and for menus.

### Display, step 3 (option A, the `DoomTex` renderer): intercept DOOM's own draw calls

**Decision: record the renderer's column and span draws in C and present them as textured rectangles, instead
of shipping pixels.**

DOOM's software renderer never overdraws inside the 3D view: walls are exclusive per-column spans, floors and
ceilings are horizontal spans whose texture coordinates vary linearly, and sprites are clipped against walls
before they are drawn. So a frame *is* a list of non-overlapping rectangles, each with a texture, a UV strip and
a light level — exactly what a `UiBackground` with `texture`, `uvs` and a grey `color` tint can draw, at full
vertical resolution and with the real WAD art.

- **Recorder** (`engine/dcl_record.c`, plus four lightly patched renderer files in `engine/patched/` that the
  Makefile prefers over upstream): wraps the `colfunc`/`spanfunc` function pointers, installed at the end of
  `R_ExecuteSetViewSize`, and appends a 12-int record per draw — screen column and row range, source texture
  (wall texture number / sprite lump / flat index, set by one-line patches in `R_GetColumn`, `R_DrawVisSprite`
  and `R_DrawPlanes`), texture column, `dc_texturemid`/`dc_iscale`, post `topdelta`, light index and a masked
  flag. The framebuffer is still drawn, so the pixel fallback stays available for free.
- **Atlases** (`tools/wad-atlas.js`): composites TEXTURE1/PNAMES wall textures and S_START..S_END sprite
  patches into 1024x1024 RGBA pages (2 wall pages + 2 sprite pages for the shareware IWAD, 1 px padding) and
  writes every flat as its own 64x64 file so floor spans can use `TWM_REPEAT` with UVs far outside 0..1 —
  confirmed to tile in the client. `src/engine/atlas-index.ts` maps engine indices to atlas rects. Total 1.3 MB
  under `assets/doom/`.
- **Headless validation first** (`tools/render-records.js`): runs the engine into E1M1 in a Node `vm` sandbox
  with the Explorer's stubs, dumps one frame's records and rasterizes them with the exact quad math the presenter
  uses. `engine/build/records.png` shows the engine's framebuffer next to the reconstruction; they match. This
  caught nothing in the recorder and everything later turned out to be client-side placement.
- **Presenter** (`src/engine/recordview.ts`): one pool per texture so `texture.src` never changes on a live
  element; pools parented to zIndex layer containers (walls 0, flats 1, sprites 2, masked walls 3, spectre fuzz
  4) because sibling creation order is *not* a reliable draw order in the client's UI; adjacent columns merged
  into one rectangle when texture, light bucket and top/bottom rows (±1 px) allow; wall columns split where they
  cross a texture-height boundary; tint = `(32 - shade) / 32`; per-slot shadows skip unchanged writes.
- **Low detail by default.** DOOM's own low-detail mode (`R_SetViewSize(blocks, 1)`, exported as
  `dg_dcl_set_detail`) renders 160 columns 2 px wide at unchanged vertical resolution and halves the element
  count. The pixel renderer runs the engine at 320 columns so the 160x100 grid has a finer source.
- **Composition:** textured records for the 3D view; the bottom 32 rows (status bar) come from a 160x16 pixel
  grid on top; when the engine drew no view or the menu/automap is active, the whole screen falls back to the
  80x50 pixel grid. HUD text messages over the 3D view are not shown yet.

Measured (1280x800 panel, 20 Hz presentation, engine at 36 ticks/s):

| detail | records/frame | rects after merge | client FPS | hiccups (>50 ms) |
|---|---|---|---|---|
| 320 cols, unmerged, first seconds (pools growing, atlases loading) | 660–860 | 660–860 | 18 | 49 in 5 s |
| 320 cols, merged, title demo moving | 730–860 | 540–650 | 63 | 7 in 5 s |
| **160 cols, merged, title demo moving** | 370–630 | 360–560 | **64** | **0 in 10 s** |
| 320 cols, merged, in-game standing still | 1097 | 1056 | 77 | 0 in 8 s |

The engine costs 0–2 ms per tick throughout; the whole budget is the client redrawing moving UI elements.
~500 moving textured rectangles at 20 Hz is comfortable, ~800 is not.

### Client-side gotchas worth knowing

- `R_DrawSpanLow` doubles `ds_x1/ds_x2` in place and steps the texture once per low-res column, so recorded
  spans must be placed at `x << detailshift`. This hid every floor behind the left wall until found.
- UI child order ≠ creation order: use `zIndex` on container entities.
- Float32 shadow arrays never compare equal to JS numbers, so every rectangle was rewritten each frame until the
  shadows became Float64.
- React-ECS scales its tree by the contain-fit of the virtual 1920x1080 canvas inside the real one
  (`min(width / 1920, height / 1080)`, from `UiCanvasInformation`); raw `UiTransform` values are canvas pixels and
  get no scaling. Until the presenters applied the same factor (`uiScale()` in `src/layout.ts`), the DOOM panel
  was a fixed 1280x800 *screen* pixels while the React controls strip moved with the window, so the strip slid
  under the panel on a 1860x1102 window.
- `InputModifier` blocks `isTriggered` but not `isPressed`; the Explorer MCP `walk` tool moves the avatar below
  both `InputModifier` and the scene's input system. The MCP `press_input` tool does reach the scene like a real
  key: `action_6` opens the menu, `secondary` confirms, `forward` with `holdSeconds` walks the DOOM player while
  the avatar stays put, `pointer` fires (ammo 50 → 49). `camera_look` and `look_at` turn the Explorer camera but
  produce no `screenDelta`, so mouse look is the one control that still needs a hand on the mouse.
- MCP `entityId` is a client world index, not the scene's entity number.
- A scene reload restarts the engine from the title screen; saves and `default.cfg` live in the module's
  in-memory filesystem.

## Running it

```bash
npm install
npm start
```

The scene boots into DOOM with the textured renderer. The avatar is frozen and the pointer locked while DOOM has
the screen; **hold right-click** to get a cursor for the settings panel at the top:

- **Renderer** — `Doom (pixels)`: the 320x200 framebuffer downsampled to a colour grid. `DoomTex`: DOOM's draw
  calls as textured rectangles at full vertical resolution and 160 columns (default).
- **Cells** — pixel-grid budget: `4000` (80x50), `8000` (113x71), `16000` (160x100). Used by the pixel renderer
  and by the textured renderer's fallback for menus, the automap and intermissions. 16000 is legible but costs
  the client dearly while the picture moves; 4000 at 20 Hz is the safe choice.

Controls (also shown under the screen): W/S move (menu up/down), A/D strafe, mouse turns, left click fires,
E or Space use (doors, switches, lifts), F = Enter, 4 = Esc (menu), 1–3 weapons, Shift run. A status line in the
panel shows the presentation rate, rectangle counts and engine cost; the same line is logged every 2 s.

Rebuilding the engine and the atlases:

```bash
brew install emscripten                                   # 6.x; wasm2js output
git clone https://github.com/ozkl/doomgeneric.git ../doomgeneric
git -C ../doomgeneric checkout dcb7a8dbc7a16ce3dda29382ac9aae9d77d21284   # the revision in engine/Makefile
cd engine && make DG=../../doomgeneric/doomgeneric        # -> src/engine/doomgeneric.js (~735 KB)
./pack-wad.sh                                             # engine/doom1.wad -> src/engine/doom1.wad.b64.ts
cd .. && node tools/wad-atlas.js engine/doom1.wad assets/doom && mv assets/doom/atlas-index.ts src/engine/
node --stack-size=4000 tools/render-records.js engine/build   # headless check -> engine/build/records.png
node --stack-size=4000 tools/thumbnail.js                     # scene thumbnail from an engine frame
```

If Homebrew's post-install did not write an Emscripten config, point `EM_CONFIG` at a file with `LLVM_ROOT`,
`BINARYEN_ROOT` (both under `$(brew --prefix emscripten)/libexec/{llvm/bin,binaryen}`), `NODE_JS` and `CACHE`.

## Layout

| Path | What |
|---|---|
| `engine/doomgeneric_dcl.c` | doomgeneric platform layer + `dg_dcl_*` exports |
| `engine/dcl_record.{c,h}` | draw-call recorder |
| `engine/patched/` | `r_main.c`, `r_data.c`, `r_things.c`, `r_plane.c` with the recorder hooks |
| `engine/Makefile`, `engine/pack-wad.sh` | engine build, WAD → base64 module |
| `tools/wad-atlas.js` | WAD → atlases + `atlas-index.ts` |
| `tools/render-records.js` | headless record validation |
| `tools/thumbnail.js` | `images/scene-thumbnail.png` from a headless engine frame |
| `src/engine/doom.ts` | `DoomSource`: module lifecycle, clock, input, palette, records API |
| `src/engine/input.ts` | Decentraland input → DOOM keys/mouse |
| `src/engine/recordview.ts` | option A presenter |
| `src/fbdisplay.ts`, `src/framebuffer.ts` | pixel-grid presenter + `FrameSource` contract |
| `src/index.ts`, `src/settings.ts`, `src/ui.tsx`, `src/layout.ts` | game system, settings, settings panel + controls strip, screen layout |
| `src/cabinet.ts` | the arcade cabinet: model, "Play DOOM" pointer event, enter/leave (avatar freeze, virtual camera) |
| `src/client/game.ts`, `src/client/net.ts`, `src/client/signs.ts`, `src/client/state.ts` | client: game system + save/load orchestration, room messages + chunked transfers, in-world signs, shared client state |
| `src/server/server.ts` | multiplayer server: validation, scoring, storage, leaderboard |
| `src/shared/` | messages, synced components, progress/scoring/savegame-summary helpers |
| `assets/doom/` | generated atlases and flats |
| `assets/cabinet/` | arcade cabinet GLB and its textures |

## Benchmark appendix

Full tables behind the decisions above. All runs: desktop Explorer, M-series MacBook Pro, scene tick target 40,
client baseline 120 FPS, every cell changing every tick unless stated.

### Pixel grid with a test raycaster source (4 bits/channel)

| output grid | present mode | update Hz | rects live | dirty writes/frame | ticks/s | client FPS |
|---|---|---|---|---|---|---|
| 40x25 | rle | 20 | 170–330 | ~all | 36 | ~102 |
| 80x50 | rle | 20 | 580–1650 | ~all | 31 | 32 (min 12, 19 hiccups) |
| 80x50 | grid | 20 | 4000 static | 430–900 | 36 | 83 (min 30, 0 hiccups) |
| 80x50 | grid | 35 | 4000 static | 600–1400 | 36.5 | 75 (1 hiccup) |
| 113x71 | grid | 35 | 8023 static | 850–2000 | 36 | 78 (min 24, 0 hiccups) |
| 113x71 | rle | 35 | 900–1500 | ~all | 19 | 20 (45 hiccups) |

### Real DOOM on the pixel grid

| output grid | Hz | client FPS, demo moving | hiccups | client FPS, still |
|---|---|---|---|---|
| 80x50 | 20 | 61 (min 24) | 0 | 92 |
| 80x50 | 35 | 58 (min 13) | 3 | — |
| 113x71 | 35 | 27 (min 10) | 30 | 91 |

### In-world check of this scene (2026-09-16, driven through the Explorer MCP)

Window 2002x1192, settings changed through the panel buttons with `ui_click`, 6–8 s samples. The first switch to
16000 cells grows the pool by ~8000 entities in one tick and costs a single 2.5 s hang; after that it is smooth.

| renderer / grid | picture | client FPS | hiccups |
|---|---|---|---|
| DoomTex, title demo moving | textured | 41–62 | 5–6 |
| Doom (pixels) 80x50, in-game still | pixel grid | 111 | 0 |
| Doom (pixels) 113x71, in-game still | pixel grid | 80 | 0 |
| Doom (pixels) 160x100, in-game still | pixel grid | 78 | 0 |

### Glyph coverage (monospace `AtkinsonHyperlegibleMono`, TextShape)

- `<mark=#rrggbbaa>` on a space: full-cell coloured rectangle, exact — the usable "pixel".
- `<color>`, `<b>`: work. `▀ ▄ ▌ ▐ █ ░ ▒ ▓`: render from a fallback font at roughly half the cell size.
  Quadrant blocks `▖ ▗ ▘ ▝ ▞` did not render visibly.

## Licence

- **Code** (the scene TypeScript, the platform layer, the recorder, the patched renderer files, the tools) is
  **GPL-2.0-or-later**, see `LICENSE`. The engine is [doomgeneric](https://github.com/ozkl/doomgeneric) (GPL, itself
  derived from the id Software DOOM source and Chocolate Doom), pinned to the commit in `engine/Makefile`, and
  `src/engine/doomgeneric.js` is compiled from it, so the bundled scene is a GPL work as a whole.
- **`engine/doom1.wad`** is the unmodified DOOM 1.9 shareware IWAD (MD5 `f0cefca49926d00903cf57551d901abe`),
  redistributable under id Software's shareware terms: as-is, unmodified and free of charge. It is not open source.
  `src/engine/doom1.wad.b64.ts` is a byte-identical base64 encoding of it. The atlases and flats under
  `assets/doom/` are generated from that WAD by `tools/wad-atlas.js` and remain id Software's artwork.
- **DOOM** is a trademark of id Software LLC. This project is an unofficial port and is not affiliated with or
  endorsed by id Software, Bethesda Softworks or Microsoft.

## Open work

- Sound: hook `i_sound.c` to `AudioSource.playSound` with pre-extracted sfx; pre-rendered music tracks.
- HUD messages over the textured view; in-game menu as an overlay instead of the pixel fallback; a textured
  status bar via the `V_DrawPatch` path.
- Merge floor spans across rows (2–4 rows per quad) to cut the flat element count.
- Hide the client HUD while playing; persist saves outside MEMFS.
- Mobile: `InputModifier` and the JS engine are unverified there; the pixel grid is the likely fallback.
- Draw on the cabinet's own screen (visible to other players) via `TextShape` `<mark>` cells or a 3D quad
  presenter, instead of screen-space UI over the glass.
