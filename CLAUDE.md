# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

The real 1993 DOOM engine ([doomgeneric](https://github.com/ozkl/doomgeneric)) compiled to plain JavaScript and
running inside a Decentraland SDK7 scene, presented through the scene's UI. See `README.md` for the approach,
the decisions and the measurements behind them. Single 1x1 parcel whose only 3D content is an arcade cabinet;
the game itself is screen-space UI shown while the player is at the cabinet.

## Commands

- `npm start` — local preview (add `-- --mcp --skip-auth-screen true` to drive the Explorer via its MCP server)
- `npm run build` — bundle + typecheck; `npx sdk-commands build --production` for the deployable ~7 MB bundle
- `cd engine && make DG=<path to doomgeneric/doomgeneric>` — rebuild `src/engine/doomgeneric.js` (needs `emcc`)
- `engine/pack-wad.sh` — regenerate `src/engine/doom1.wad.b64.ts` from `engine/doom1.wad`
- `node tools/wad-atlas.js engine/doom1.wad assets/doom && mv assets/doom/atlas-index.ts src/engine/` — atlases
- `node --stack-size=4000 tools/render-records.js engine/build` — headless check of the draw-call recorder
- `node --stack-size=4000 tools/thumbnail.js` — regenerate `images/scene-thumbnail.png` from an engine frame

No tests or linter are configured. Prettier config lives in `package.json`.

## Architecture

- `src/index.ts` — one ECS system, active only at the cabinet: apply settings, tick the engine, present; owns the
  clipping window the presenters live in and its screen-on animation.
- `src/cabinet.ts` — the arcade cabinet GLB, its "Play DOOM" pointer event, and enter/leave: `InputModifier`,
  `PointerLock`, `AvatarModifierArea`, `VirtualCamera` in front of the screen via `MainCamera`.
- `src/settings.ts` — renderer (`pixels` | `textured`), pixel-grid cell budget, presentation rate, status line.
- `src/ui.tsx` — settings panel (top centre, with the Leave button) and controls strip, React-ECS; renders
  nothing while the cabinet is idle.
- `src/layout.ts` — the 1280x800 screen panel on the 1920x1080 virtual canvas (4 px per DOOM pixel).
- `src/engine/doom.ts` — `DoomSource`: module lifecycle, simulated clock, key/mouse queue, palette, records API.
- `src/engine/input.ts` — Decentraland input actions and pointer deltas → DOOM keys and mouse.
- `src/engine/recordview.ts` — textured presenter: recorded draw calls → pooled `UiTransform`/`UiBackground`.
- `src/fbdisplay.ts` — pixel-grid presenter (`FrameSource` → static cell grid with dirty colour writes).
- `engine/` — doomgeneric platform layer, draw-call recorder, patched renderer files, Makefile, shareware WAD.
- `tools/` — WAD atlas extractor, headless record validator, thumbnail renderer.

## Rules that matter here

- Never use React-ECS for anything updated per frame; the presenters mutate raw components in place.
- The engine's clock is simulated: `DG_SleepMs` must advance it or `TryRunTics` never returns.
- `R_DrawSpanLow` doubles `ds_x1/ds_x2` in place; spans are placed at `x << detailshift`.
- UI sibling order is not draw order: use `zIndex` containers (see `RecordView.layer`).
- React-ECS scales its tree by `min(canvas.width / 1920, canvas.height / 1080)`; raw `UiTransform` values are canvas
  pixels. Anything positioned next to React UI must multiply virtual units by `uiScale()` from `src/layout.ts`
  (the presenters do, through `setGeometry`).
- Explorer MCP: `press_input` reaches DOOM like a real key (menu, walk, fire); `camera_look`/`look_at` give no
  `screenDelta`, so mouse look is tested by hand.
- Shadow arrays are `Float64Array`; `Float32Array` never compares equal to JS numbers.
- `InputModifier` blocks `isTriggered` but not `isPressed`; it needs `engine.PlayerEntity`, so apply it from a
  system tick or an event callback, not `main()` (the cabinet applies it from its pointer event).
- `scene.json` (spawn point, parcels) is not hot-reloaded: restart `npm start` after editing it.
- Deleting an `AvatarModifierArea` leaves avatars hidden in the Explorer (even across a scene reload); the cabinet
  keeps the component and moves the volume away instead.
- Explorer MCP entry/exit: `press_input primary` aimed at (8, 1.5, 9.6) hits the cabinet; the Leave button is the
  last `ui_list stack:sdk` element (React-ECS remounts the panel, so ids change on every visit).
- The shareware `doom1.wad` (DOOM 1.9, MD5 `f0cefca49926d00903cf57551d901abe`) may be redistributed unmodified;
  a different IWAD means regenerating both the base64 module and the atlases.
