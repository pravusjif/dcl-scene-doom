import { engine, InputModifier } from '@dcl/sdk/ecs'
import { Color4 } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import { GameState, ColumnRenderData, EnemySpriteData, EnemyState, SpriteStrip } from './types'
import { createPlayer, movePlayer } from './player'
import { castRays } from './raycaster'
import { readInput, syncPlayerAngleFromCamera, checkToggle } from './input'
import { WORLD_MAP, MAP_WIDTH, MAP_HEIGHT, getMinimapColor, resetMap } from './map'
import { findDoors, updateDoors, tryUseDoor } from './doors'
import { spawnEnemies, updateEnemies, castEnemySprites, hitscanShoot, damageEnemy } from './enemies'

const SCREEN_WIDTH = 80
const SCREEN_HEIGHT = 960
const MINIMAP_SIZE = 11
const MAX_ENEMY_SPRITES = 16
const MAX_SPRITE_STRIPS = 160
const WEAPON_DAMAGE = 25
const DEATH_SCREEN_TIME = 2.0

let gameState: GameState | null = null
let initialized = false

export function getGameState(): GameState | null {
  return gameState
}

function createColumns(count: number): ColumnRenderData[] {
  const cols: ColumnRenderData[] = []
  for (let i = 0; i < count; i++) {
    cols.push({
      drawStart: 0,
      drawEnd: 0,
      color: Color4.create(0, 0, 0, 1),
      distance: 0
    })
  }
  return cols
}

function createMinimapCells(size: number): Color4[] {
  const cells: Color4[] = []
  for (let i = 0; i < size * size; i++) {
    cells.push(Color4.create(0.1, 0.1, 0.1, 0.8))
  }
  return cells
}

function createSpriteStrips(count: number): SpriteStrip[] {
  const strips: SpriteStrip[] = []
  for (let i = 0; i < count; i++) {
    strips.push({
      left: 0, top: 0, width: 0, height: 0,
      color: Color4.create(0, 0, 0, 0), visible: false
    })
  }
  return strips
}

function createEnemySpriteSlots(count: number): EnemySpriteData[] {
  const slots: EnemySpriteData[] = []
  for (let i = 0; i < count; i++) {
    slots.push({
      screenX: 0, distance: 0, height: 0, width: 0,
      drawStartX: 0, drawEndX: 0, drawStartY: 0, drawEndY: 0,
      color: Color4.create(0, 0, 0, 0), visible: false, enemy: null!
    })
  }
  return slots
}

function lockAvatar(): void {
  InputModifier.createOrReplace(engine.PlayerEntity, {
    mode: InputModifier.Mode.Standard({
      disableAll: true
    })
  })
}

function unlockAvatar(): void {
  InputModifier.createOrReplace(engine.PlayerEntity, {
    mode: InputModifier.Mode.Standard({
      disableAll: false
    })
  })
}

function teleportPlayer(): void {
  movePlayerTo({
    newRelativePosition: { x: 8, y: 0, z: 8 },
    cameraTarget: { x: 12, y: 1, z: 8 }
  })
}

function resetGame(): void {
  if (!gameState) return

  // Restore the map (doors may have opened cells)
  resetMap()

  // Reset player
  const player = createPlayer()
  gameState.player = player

  // Re-spawn enemies and doors
  gameState.enemies = spawnEnemies()
  gameState.doors = findDoors()

  // Reset state
  gameState.damageFlash = 0
  gameState.killCount = 0
  gameState.dead = false
  gameState.deathTimer = 0
  gameState.spriteStripCount = 0
  gameState.frameCount = 0

  // Hide all sprite strips
  for (const strip of gameState.spriteStrips) {
    strip.visible = false
  }

  teleportPlayer()
}

export function initDoomGame(): void {
  const player = createPlayer()

  gameState = {
    player,
    columns: createColumns(SCREEN_WIDTH),
    screenWidth: SCREEN_WIDTH,
    screenHeight: SCREEN_HEIGHT,
    active: true,
    frameCount: 0,
    minimapCells: createMinimapCells(MINIMAP_SIZE),
    minimapSize: MINIMAP_SIZE,
    enemies: spawnEnemies(),
    enemySprites: createEnemySpriteSlots(MAX_ENEMY_SPRITES),
    spriteStrips: createSpriteStrips(MAX_SPRITE_STRIPS),
    spriteStripCount: 0,
    doors: findDoors(),
    damageFlash: 0,
    killCount: 0,
    dead: false,
    deathTimer: 0
  }

  // Register ECS system — lock + teleport deferred to first tick
  initialized = false
  engine.addSystem(doomSystem)
}

function doomSystem(dt: number): void {
  if (!gameState) return

  // Defer lock + teleport to first tick so PlayerEntity is ready
  if (!initialized) {
    initialized = true
    lockAvatar()
    teleportPlayer()
  }

  // Check toggle
  try {
    if (checkToggle()) {
      gameState.active = !gameState.active
      if (gameState.active) {
        lockAvatar()
        teleportPlayer()
      } else {
        unlockAvatar()
      }
    }
  } catch (_e) {
    // isTriggered may throw if entity is undefined, ignore
  }

  if (!gameState.active) return

  // Death screen countdown — reset when timer expires
  if (gameState.dead) {
    gameState.deathTimer -= dt
    if (gameState.deathTimer <= 0) {
      resetGame()
    }
    return
  }

  gameState.frameCount++

  // Read input
  const input = readInput()

  // Sync angle from camera
  syncPlayerAngleFromCamera(gameState.player)

  // Move player
  movePlayer(gameState.player, input.forward, input.strafe, dt)

  // Handle door use (secondary action)
  if (input.use) {
    tryUseDoor(gameState)
  }

  // Handle shooting
  if (input.shoot && gameState.player.shootCooldown <= 0 && gameState.player.ammo > 0) {
    gameState.player.shooting = true
    gameState.player.shootCooldown = 0.3
    gameState.player.ammo--

    // Hitscan — check if we hit an enemy
    const hitEnemy = hitscanShoot(gameState)
    if (hitEnemy) {
      const wasDead = hitEnemy.health <= 0
      damageEnemy(hitEnemy, WEAPON_DAMAGE)
      if (!wasDead && hitEnemy.health <= 0) {
        gameState.killCount++
      }
    }
  } else {
    gameState.player.shooting = false
  }

  // Update doors
  updateDoors(gameState, dt)

  // Update enemies (AI, movement, attacks)
  updateEnemies(gameState, dt)

  // Cast rays (walls)
  castRays(gameState)

  // Cast enemy sprites (after rays so we have wall distances)
  castEnemySprites(gameState)

  // Decay damage flash
  if (gameState.damageFlash > 0) {
    gameState.damageFlash -= dt
    if (gameState.damageFlash < 0) gameState.damageFlash = 0
  }

  // Check for death
  if (gameState.player.health <= 0) {
    gameState.dead = true
    gameState.deathTimer = DEATH_SCREEN_TIME
    gameState.damageFlash = DEATH_SCREEN_TIME
    return
  }

  // Update minimap (every 5th frame)
  if (gameState.frameCount % 5 === 0) {
    updateMinimap(gameState)
  }
}

function updateMinimap(state: GameState): void {
  const { player, minimapCells, minimapSize } = state
  const half = Math.floor(minimapSize / 2)

  for (let dy = 0; dy < minimapSize; dy++) {
    for (let dx = 0; dx < minimapSize; dx++) {
      const mapX = Math.floor(player.pos.x) - half + dx
      const mapY = Math.floor(player.pos.y) - half + dy
      const idx = dy * minimapSize + dx

      if (dx === half && dy === half) {
        minimapCells[idx] = Color4.create(1, 1, 0, 1)
      } else if (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT) {
        minimapCells[idx] = Color4.create(0.05, 0.05, 0.05, 0.8)
      } else {
        minimapCells[idx] = getMinimapColor(WORLD_MAP[mapY][mapX])
      }
    }
  }

  // Overlay enemy positions on minimap
  if (state.enemies) {
    const playerMapX = Math.floor(player.pos.x)
    const playerMapY = Math.floor(player.pos.y)
    for (const enemy of state.enemies) {
      if (enemy.state === EnemyState.DEAD) continue
      const ex = Math.floor(enemy.pos.x) - playerMapX + half
      const ey = Math.floor(enemy.pos.y) - playerMapY + half
      if (ex >= 0 && ex < minimapSize && ey >= 0 && ey < minimapSize) {
        const idx = ey * minimapSize + ex
        minimapCells[idx] = Color4.create(1, 0, 0, 1) // red dot for enemies
      }
    }
  }
}
