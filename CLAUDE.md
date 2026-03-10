# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A DOOM-like first-person game rendered entirely through Decentraland SDK7's UI system (ReactEcs). Uses DDA raycasting to render walls as colored UI columns, with sprite-based enemies depth-tested per column against wall distances. Runs on a single 1x1 parcel.

## Commands

- `npm start` — Start local dev server (Decentraland scene preview)
- `npm run build` — Build the scene
- `npm run deploy` — Deploy to Decentraland

No test framework is configured. No linter is configured. Prettier config is in package.json (no semi, single quotes, 120 print width, no trailing commas).

## Architecture

**Entry point:** `src/index.ts` calls `initDoomGame()` and `setupDoomUi()`.

**Game loop:** `src/doom/game.ts` registers a single ECS system (`doomSystem`) via `engine.addSystem()`. Each frame: read input → sync camera angle → move player → handle doors → update enemy AI → cast wall rays → cast enemy sprites → update minimap.

**Rendering approach:** No 3D entities are used. The entire game renders via `ReactEcsRenderer` in `src/doom-ui.tsx`. Wall columns, enemy sprite strips, HUD, minimap, crosshair, and flash overlays are all absolutely-positioned `UiEntity` elements. The viewport is 1920x960 pixels with 80 ray columns (24px each).

**Key modules in `src/doom/`:**
- `raycaster.ts` — DDA wall raycasting, produces per-column distance and color data
- `enemies.ts` — Enemy spawning, AI (idle→chase→attack), line-of-sight checks, sprite casting with per-column depth testing against walls, hitscan shooting
- `map.ts` — 24x24 tile map (mutable copy of original for door state), wall colors with side darkening and distance fog
- `doors.ts` — Door state machine (closed→opening→open→closing), modifies `WORLD_MAP` cells between `DOOR_RED` and `EMPTY`
- `player.ts` — Movement with axis-separated wall collision, camera plane maintains ~66° FOV
- `input.ts` — Reads DCL input actions (WASD, mouse look via camera quaternion yaw extraction, click to shoot, F for doors, key 4 to toggle)
- `types.ts` — All interfaces and enums (`GameState`, `Enemy`, `Door`, `ColumnRenderData`, `SpriteStrip`, etc.)

**State management:** Single mutable `GameState` object in `game.ts`, exposed via `getGameState()`. UI reads it each frame. All render data (columns, sprite strips, minimap cells) is pre-allocated and mutated in-place to avoid GC pressure.

**Avatar control:** The DCL avatar is locked (`InputModifier.disableAll`) and teleported to a fixed position when the game is active. Key 4 toggles between DOOM mode and normal DCL exploration.

## Conventions

- TypeScript strict mode, extends `@dcl/sdk/types/tsconfig.ecs7.json`
- TSX for UI components (`src/doom-ui.tsx`)
- Viewport constants (`VP_WIDTH=1920`, `VP_HEIGHT=960`) are duplicated between `doom-ui.tsx` and `enemies.ts` — keep them in sync
- Colors use `Color4.create()` from `@dcl/sdk/math`
- Map uses `number[][]` indexed as `WORLD_MAP[y][x]` (row-major)

## Rendering Details

**Z-Index Layering:**
- `zIndex: 0` — ceiling
- `zIndex: 1` — sprite strips (only where depth test passes)
- `zIndex: 2` — wall columns (always on top of sprites)
- `zIndex: 9999` — overlays, crosshair, minimap, HUD, death screen

**Pre-allocated Pools:** 160 SpriteStrip slots, 16 EnemySpriteData slots. `spriteStripCount` tracks active strips per frame. ~360 max UiEntity elements total.

**Per-Column Depth Testing:** Enemy sprites are split into vertical strips per ray column. Each strip is depth-tested against the wall distance at that column — only emitted if sprite is closer than the wall.

## SDK7 Gotchas

- `Color4` properties are readonly — replace entire object, don't mutate in place
- Teleport avatar with `movePlayerTo` from `~system/RestrictedActions`, NOT `Transform.createOrReplace`
- `InputModifier.Mode.Standard({ disableAll: true })` — use the helper, not raw `$case` objects
- `InputModifier` must be deferred to first system tick (PlayerEntity not ready in `main()`)
- `InputModifier({ disableAll: true })` blocks `isTriggered()` — use `isPressed()` with manual debounce instead
- `inputSystem.isTriggered` takes 2 args: `(InputAction, PointerEventType)`
- Camera quaternion yaw: do NOT negate it when passing to `setPlayerAngle()`
- UI z-ordering requires explicit `zIndex` on `uiTransform` (DOM order not guaranteed)
- Negative margins not supported for centering — use flexbox container instead
- `IA_PRIMARY` = E key, `IA_SECONDARY` = F key, `IA_POINTER` = left click. Right-click is reserved by Explorer
