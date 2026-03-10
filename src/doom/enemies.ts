import { Color4 } from '@dcl/sdk/math'
import { Vec2, GameState, Enemy, EnemyState, EnemySpriteData, SpriteStrip } from './types'
import { isWall } from './map'

const ENEMY_COLORS = {
  imp: Color4.create(0.8, 0.3, 0.1, 1),
  demon: Color4.create(0.6, 0.1, 0.1, 1),
  sergeant: Color4.create(0.3, 0.5, 0.2, 1)
}

export function createEnemy(x: number, y: number, type: 'imp' | 'demon' | 'sergeant'): Enemy {
  const configs = {
    imp: { health: 30, speed: 1.5, attackRange: 8, color: ENEMY_COLORS.imp, size: 0.4 },
    demon: { health: 60, speed: 2.0, attackRange: 2, color: ENEMY_COLORS.demon, size: 0.5 },
    sergeant: { health: 20, speed: 1.0, attackRange: 10, color: ENEMY_COLORS.sergeant, size: 0.35 }
  }
  const cfg = configs[type]
  return {
    pos: { x, y },
    health: cfg.health,
    maxHealth: cfg.health,
    state: EnemyState.IDLE,
    color: cfg.color,
    speed: cfg.speed,
    attackRange: cfg.attackRange,
    attackCooldown: 1.0,
    attackTimer: 0,
    hurtTimer: 0,
    deathTimer: 0,
    size: cfg.size
  }
}

export function spawnEnemies(): Enemy[] {
  return [
    // Room with stone brown walls
    createEnemy(5.5, 5.5, 'imp'),
    createEnemy(6.5, 5.5, 'imp'),
    // Room with tech blue walls
    createEnemy(16.5, 5.5, 'sergeant'),
    // Metal room
    createEnemy(11.5, 11.5, 'demon'),
    // Brick rooms
    createEnemy(3.0, 18.5, 'imp'),
    createEnemy(20.5, 18.5, 'sergeant'),
    // Corridor enemies
    createEnemy(8.5, 14.5, 'imp'),
    createEnemy(15.5, 9.5, 'sergeant'),
    // Exit area
    createEnemy(11.5, 21.5, 'demon'),
  ]
}

const ALERT_DISTANCE = 10
const ATTACK_DAMAGE = 10

export function updateEnemies(state: GameState, dt: number): void {
  const { player } = state
  if (!state.enemies) return

  for (const enemy of state.enemies) {
    if (enemy.state === EnemyState.DEAD) {
      enemy.deathTimer -= dt
      continue
    }

    // Hurt recovery
    if (enemy.state === EnemyState.HURT) {
      enemy.hurtTimer -= dt
      if (enemy.hurtTimer <= 0) {
        enemy.state = EnemyState.CHASE
      }
      continue
    }

    const dx = player.pos.x - enemy.pos.x
    const dy = player.pos.y - enemy.pos.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    // Attack cooldown
    if (enemy.attackTimer > 0) enemy.attackTimer -= dt

    // State transitions
    if (enemy.state === EnemyState.IDLE) {
      if (dist < ALERT_DISTANCE) {
        // Simple LOS check — if we can see them, they can see us
        if (hasLineOfSight(enemy.pos, player.pos)) {
          enemy.state = EnemyState.CHASE
        }
      }
    }

    if (enemy.state === EnemyState.CHASE) {
      if (dist <= enemy.attackRange && enemy.attackTimer <= 0) {
        enemy.state = EnemyState.ATTACK
      } else {
        // Move toward player
        const moveSpeed = enemy.speed * dt
        const nx = dx / dist
        const ny = dy / dist
        const newX = enemy.pos.x + nx * moveSpeed
        const newY = enemy.pos.y + ny * moveSpeed

        // Collision with walls (axis-separated)
        if (!isWall(Math.floor(newX), Math.floor(enemy.pos.y))) {
          enemy.pos.x = newX
        }
        if (!isWall(Math.floor(enemy.pos.x), Math.floor(newY))) {
          enemy.pos.y = newY
        }
      }
    }

    if (enemy.state === EnemyState.ATTACK) {
      if (enemy.attackTimer <= 0) {
        // Deal damage to player
        if (dist <= enemy.attackRange + 1) {
          player.health = Math.max(0, player.health - ATTACK_DAMAGE)
          state.damageFlash = 0.15
        }
        enemy.attackTimer = enemy.attackCooldown
        enemy.state = EnemyState.CHASE
      }
    }
  }
}

function hasLineOfSight(from: Vec2, to: Vec2): boolean {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const steps = Math.ceil(dist * 2)
  const sx = dx / steps
  const sy = dy / steps

  for (let i = 1; i < steps; i++) {
    const cx = Math.floor(from.x + sx * i)
    const cy = Math.floor(from.y + sy * i)
    if (isWall(cx, cy)) return false
  }
  return true
}

export function damageEnemy(enemy: Enemy, damage: number): void {
  if (enemy.state === EnemyState.DEAD) return
  enemy.health -= damage
  if (enemy.health <= 0) {
    enemy.health = 0
    enemy.state = EnemyState.DEAD
    enemy.deathTimer = 3.0
  } else {
    enemy.state = EnemyState.HURT
    enemy.hurtTimer = 0.2
  }
}

// Viewport pixel dimensions (must match doom-ui.tsx)
const VP_WIDTH = 1920
const VP_HEIGHT = 960

// Sprite-cast enemies into per-column strips with depth testing against walls.
// Only emits a strip for columns where the sprite is closer than the wall.
export function castEnemySprites(state: GameState): void {
  if (!state.enemies || !state.spriteStrips) return

  const { player, screenWidth, screenHeight, columns } = state
  const colWidth = VP_WIDTH / screenWidth // 24px per ray column
  let stripIdx = 0
  const maxStrips = state.spriteStrips.length

  // Sort enemies far-to-near so nearer sprites overwrite farther ones in overlapping strips
  const sorted = state.enemies
    .filter(e => e.state !== EnemyState.DEAD || e.deathTimer > 0)
    .map(e => {
      const dx = e.pos.x - player.pos.x
      const dy = e.pos.y - player.pos.y
      return { enemy: e, dist: dx * dx + dy * dy }
    })
    .sort((a, b) => b.dist - a.dist)

  for (const { enemy } of sorted) {
    const dx = enemy.pos.x - player.pos.x
    const dy = enemy.pos.y - player.pos.y

    // Transform enemy position relative to camera
    const invDet = 1.0 / (player.plane.x * player.dir.y - player.dir.x * player.plane.y)
    const transformX = invDet * (player.dir.y * dx - player.dir.x * dy)
    const transformY = invDet * (-player.plane.y * dx + player.plane.x * dy)

    // Behind camera
    if (transformY <= 0.1) continue

    // Sprite geometry in viewport pixel space
    const centerX = (VP_WIDTH / 2) * (1 + transformX / transformY)
    const wallHeight = VP_HEIGHT / transformY
    const spriteH = Math.floor(wallHeight * enemy.size)
    const spriteW = Math.floor(spriteH * 0.8)

    const drawStartY = Math.max(0, Math.floor(VP_HEIGHT / 2 - spriteH / 2))
    const drawEndY = Math.min(VP_HEIGHT - 1, Math.floor(VP_HEIGHT / 2 + spriteH / 2))
    const drawHeight = drawEndY - drawStartY
    if (drawHeight <= 0) continue

    // Determine color based on state
    let color: Color4
    if (enemy.state === EnemyState.DEAD) {
      color = Color4.create(0.3, 0.1, 0.1, 0.6)
    } else if (enemy.state === EnemyState.HURT) {
      color = Color4.create(1, 1, 1, 1)
    } else if (enemy.state === EnemyState.ATTACK) {
      color = Color4.create(
        Math.min(1, enemy.color.r * 1.5),
        enemy.color.g * 0.5,
        enemy.color.b * 0.5, 1
      )
    } else {
      const fogFactor = Math.max(0, 1.0 - transformY / 16.0)
      color = Color4.create(
        enemy.color.r * fogFactor,
        enemy.color.g * fogFactor,
        enemy.color.b * fogFactor, 1
      )
    }

    // Determine which ray columns this sprite covers
    const pixelStartX = centerX - spriteW / 2
    const pixelEndX = centerX + spriteW / 2
    const colStart = Math.max(0, Math.floor(pixelStartX / colWidth))
    const colEnd = Math.min(screenWidth - 1, Math.floor(pixelEndX / colWidth))

    // Emit one strip per ray column where sprite is in front of the wall
    for (let c = colStart; c <= colEnd; c++) {
      if (stripIdx >= maxStrips) break
      // Depth test: only draw if sprite is closer than the wall at this column
      if (transformY >= columns[c].distance) continue

      const strip = state.spriteStrips[stripIdx]
      strip.left = Math.floor(c * colWidth)
      strip.top = drawStartY
      strip.width = Math.ceil(colWidth) + 1
      strip.height = drawHeight
      strip.color = color
      strip.visible = true
      stripIdx++
    }
    if (stripIdx >= maxStrips) break
  }

  state.spriteStripCount = stripIdx

  // Hide remaining strips
  for (let i = stripIdx; i < maxStrips; i++) {
    state.spriteStrips[i].visible = false
  }
}

// Hitscan: find the first enemy hit by the player's center ray
export function hitscanShoot(state: GameState): Enemy | null {
  if (!state.enemies) return null

  const { player } = state

  // Check each enemy against the center ray
  let closestEnemy: Enemy | null = null
  let closestDist = Infinity

  for (const enemy of state.enemies) {
    if (enemy.state === EnemyState.DEAD) continue

    const dx = enemy.pos.x - player.pos.x
    const dy = enemy.pos.y - player.pos.y

    // Transform to camera space
    const invDet = 1.0 / (player.plane.x * player.dir.y - player.dir.x * player.plane.y)
    const transformX = invDet * (player.dir.y * dx - player.dir.x * dy)
    const transformY = invDet * (-player.plane.y * dx + player.plane.x * dy)

    if (transformY <= 0) continue

    // Check if enemy is near the center of screen
    const screenX = (state.screenWidth / 2) * (1 + transformX / transformY)
    const halfWidth = (state.screenHeight / transformY) * enemy.size
    const centerScreen = state.screenWidth / 2

    if (Math.abs(screenX - centerScreen) < halfWidth) {
      // Check LOS (no wall between player and enemy)
      if (transformY < closestDist && hasLineOfSight(player.pos, enemy.pos)) {
        closestDist = transformY
        closestEnemy = enemy
      }
    }
  }

  return closestEnemy
}
