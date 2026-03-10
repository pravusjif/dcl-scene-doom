# DOOM Raycaster Architecture

## File Map

```
src/doom/types.ts      — All shared types: Vec2, PlayerState, GameState, WallType, Enemy, EnemyState,
                          EnemySpriteData, SpriteStrip, Door, DoorState, ColumnRenderData
src/doom/map.ts        — 24x24 E1M1-inspired grid (ORIGINAL_MAP + mutable WORLD_MAP), wall colors, fog,
                          collision check, resetMap() for game reset
src/doom/raycaster.ts  — DDA ray casting, fills GameState.columns[] (80 columns)
src/doom/player.ts     — createPlayer(), movePlayer() with axis-separated collision, setPlayerAngle()
src/doom/input.ts      — readInput() via inputSystem.isPressed, syncPlayerAngleFromCamera(), toggle via key 4
src/doom/enemies.ts    — createEnemy(), spawnEnemies(), updateEnemies() AI, castEnemySprites() (per-column
                          strip depth testing), hitscanShoot(), damageEnemy()
src/doom/doors.ts      — findDoors(), updateDoors(), tryUseDoor(), getDoorAt()
src/doom/game.ts       — initDoomGame(), doomSystem() loop, resetGame(), minimap with enemy dots, InputModifier lock
src/doom-ui.tsx        — React-ECS renderer: sprite strips + 80 wall columns + ceiling/floor + minimap + HUD
                          + death screen + crosshair + damage/shoot flash
src/index.ts           — Entry: calls initDoomGame() + setupDoomUi()
```

## Key Design
- Single mutable `GameState` shared by reference between game system and UI renderer
- System mutates state each frame → React-ECS reads during render pass
- 80 UI column strips with absolute positioning inside a game container
- Floor = container background color (always behind columns)
- Ceiling = absolute-positioned overlay (top half)
- Viewport: 1920x960, centered on screen
- Minimap throttled to every 5th frame, shows enemy positions as red dots

## Rendering Constants
- VIEWPORT_WIDTH = 1920, VIEWPORT_HEIGHT = 960
- SCREEN_WIDTH = 80 (ray columns), SCREEN_HEIGHT = 960
- Minimap: 11x11 grid, 8px cells, top-right corner
- HUD: 48px bar at bottom

## Depth Sorting (Per-Column Strip System)
Enemies are rendered as **per-column vertical strips** not single rectangles. For each enemy:
1. Compute which ray columns (0-79) the sprite overlaps
2. For each column, compare sprite distance vs wall distance at that column
3. Only emit a strip if `spriteDistance < wallDistance` (sprite is closer)
4. Skip entirely if wall is closer (sprite behind wall)

### Z-Index Layering
- `zIndex: 0` — ceiling
- `zIndex: 1` — sprite strips (only emitted where depth test passes)
- `zIndex: 2` — wall columns (always on top of sprites)
- `zIndex: 9999` — overlays, crosshair, minimap, HUD, death screen

### Pre-allocated Pools
- 160 SpriteStrip slots (MAX_SPRITE_STRIPS)
- 16 EnemySpriteData slots (MAX_ENEMY_SPRITES, used for hitscan, kept for compatibility)
- `spriteStripCount` tracks how many strips are active each frame

### Element Count
~360 max UiEntity elements (80 wall columns + 160 sprite strips + 121 minimap + HUD + overlays)

## Types Architecture (No Circular Dependencies)
All shared types live in `types.ts`. Other modules import from it:
- `enemies.ts` imports Enemy, EnemyState, EnemySpriteData, SpriteStrip from types.ts
- `doors.ts` imports Door, DoorState, WallType from types.ts
- `map.ts` imports WallType from types.ts

## Phase 2 Details

### Enemies
- 3 types: imp (orange, size 0.4, ranged), demon (dark red, size 0.5, melee), sergeant (green, size 0.35, long-range)
- AI states: IDLE → CHASE (LOS check) → ATTACK → CHASE, with HURT (0.2s) and DEAD (3s fade)
- 9 enemies placed across map rooms
- Sprite size: `wallHeight * enemy.size` for height, `height * 0.8` for width

### Weapons
- Hitscan shooting (left click / IA_PRIMARY / IA_POINTER), 25 damage, 0.3s cooldown
- Shoot flash overlay (yellow), ammo tracking, kill count in HUD

### Doors
- Map cells with WallType.DOOR_RED (value 4) auto-detected by findDoors()
- F key (IA_SECONDARY) to use, isPressed with debounce (not isTriggered — blocked by InputModifier)
- State machine: CLOSED → OPENING → OPEN (3s) → CLOSING → CLOSED
- Player blockage check prevents door closing on player
- Wall removed from WORLD_MAP when fully open, restored when fully closed

### Death & Reset
- Player health ≤ 0 → `dead=true`, 2-second red death screen with "YOU DIED" text
- After timer: resetGame() restores map (resetMap()), re-spawns player/enemies/doors, teleports avatar
- ORIGINAL_MAP (readonly) preserved, WORLD_MAP (mutable) is the runtime copy
