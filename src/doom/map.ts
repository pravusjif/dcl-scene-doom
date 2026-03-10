import { Color4 } from '@dcl/sdk/math'
import { WallType } from './types'

export const MAP_WIDTH = 24
export const MAP_HEIGHT = 24

// E1M1-inspired layout: corridors, rooms, doors, exit area
// prettier-ignore
const ORIGINAL_MAP: readonly number[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,2,2,2,2,0,0,0,0,0,0,0,3,3,3,3,0,0,0,0,1],
  [1,0,0,0,2,0,0,2,0,0,0,0,0,0,0,3,0,0,3,0,0,0,0,1],
  [1,0,0,0,2,0,0,2,0,0,0,0,0,0,0,3,0,0,3,0,0,0,0,1],
  [1,0,0,0,2,0,0,2,0,0,0,0,0,0,0,3,3,4,3,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,5,5,5,5,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,5,0,0,5,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,5,0,0,5,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,5,5,4,5,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,1],
  [1,6,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,6,1],
  [1,6,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,6,1],
  [1,6,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,6,1],
  [1,6,6,4,6,6,0,0,0,0,7,7,7,7,0,0,0,0,6,6,4,6,6,1],
  [1,0,0,0,0,0,0,0,0,0,7,0,0,7,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,7,0,0,7,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
]

// Mutable copy used at runtime (doors modify it)
export const WORLD_MAP: number[][] = ORIGINAL_MAP.map(row => [...row])

// Restore the map to its original state (for game reset)
export function resetMap(): void {
  for (let y = 0; y < ORIGINAL_MAP.length; y++) {
    for (let x = 0; x < ORIGINAL_MAP[y].length; x++) {
      WORLD_MAP[y][x] = ORIGINAL_MAP[y][x]
    }
  }
}

// Wall colors by WallType
const WALL_COLORS: Color4[] = [
  Color4.create(0, 0, 0, 1),           // 0 EMPTY (unused)
  Color4.create(0.6, 0.6, 0.6, 1),     // 1 STONE_GRAY
  Color4.create(0.55, 0.4, 0.25, 1),   // 2 STONE_BROWN
  Color4.create(0.2, 0.3, 0.7, 1),     // 3 TECH_BLUE
  Color4.create(0.7, 0.15, 0.1, 1),    // 4 DOOR_RED
  Color4.create(0.25, 0.25, 0.3, 1),   // 5 METAL_DARK
  Color4.create(0.65, 0.2, 0.15, 1),   // 6 BRICK_RED
  Color4.create(0.1, 0.7, 0.2, 1),     // 7 EXIT_GREEN
]

export function getWallColor(wallType: number, side: number, distance: number): Color4 {
  const base = WALL_COLORS[wallType] || WALL_COLORS[1]

  // Side darkening (0.6x for y-side hits) + distance fog
  const sideFactor = side === 1 ? 0.6 : 1.0
  const fogFactor = Math.max(0, 1.0 - distance / 16.0)
  const f = sideFactor * fogFactor

  return Color4.create(base.r * f, base.g * f, base.b * f, 1)
}

export function getMinimapColor(wallType: number): Color4 {
  if (wallType === 0) return Color4.create(0.1, 0.1, 0.1, 0.8)
  const base = WALL_COLORS[wallType] || WALL_COLORS[1]
  return Color4.create(base.r * 0.8, base.g * 0.8, base.b * 0.8, 0.9)
}

export function isWall(x: number, y: number): boolean {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return true
  return WORLD_MAP[y][x] !== WallType.EMPTY
}
