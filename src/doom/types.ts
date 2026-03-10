import { Color4 } from '@dcl/sdk/math'

export interface Vec2 {
  x: number
  y: number
}

export enum WallType {
  EMPTY = 0,
  STONE_GRAY = 1,
  STONE_BROWN = 2,
  TECH_BLUE = 3,
  DOOR_RED = 4,
  METAL_DARK = 5,
  BRICK_RED = 6,
  EXIT_GREEN = 7
}

export interface ColumnRenderData {
  drawStart: number
  drawEnd: number
  color: Color4
  distance: number
}

export interface PlayerState {
  pos: Vec2
  dir: Vec2
  plane: Vec2
  health: number
  ammo: number
  shooting: boolean
  shootCooldown: number
}

export enum EnemyState {
  IDLE,
  CHASE,
  ATTACK,
  HURT,
  DEAD
}

export interface Enemy {
  pos: Vec2
  health: number
  maxHealth: number
  state: EnemyState
  color: Color4
  speed: number
  attackRange: number
  attackCooldown: number
  attackTimer: number
  hurtTimer: number
  deathTimer: number
  size: number
}

export interface EnemySpriteData {
  screenX: number
  distance: number
  height: number
  width: number
  drawStartX: number
  drawEndX: number
  drawStartY: number
  drawEndY: number
  color: Color4
  visible: boolean
  enemy: Enemy
}

// Per-column sprite strip for proper depth testing against walls
export interface SpriteStrip {
  left: number    // pixel X position
  top: number     // pixel Y position
  width: number   // strip width in pixels
  height: number  // strip height in pixels
  color: Color4
  visible: boolean
}

export enum DoorState {
  CLOSED,
  OPENING,
  OPEN,
  CLOSING
}

export interface Door {
  mapX: number
  mapY: number
  state: DoorState
  openAmount: number
  timer: number
}

export interface GameState {
  player: PlayerState
  columns: ColumnRenderData[]
  screenWidth: number
  screenHeight: number
  active: boolean
  frameCount: number
  minimapCells: Color4[]
  minimapSize: number
  enemies: Enemy[]
  enemySprites: EnemySpriteData[]
  spriteStrips: SpriteStrip[]
  spriteStripCount: number
  doors: Door[]
  damageFlash: number
  killCount: number
  dead: boolean
  deathTimer: number
}
