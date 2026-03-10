import { PlayerState } from './types'
import { isWall } from './map'

const MOVE_SPEED = 3.5
const WALL_MARGIN = 0.25

export function createPlayer(): PlayerState {
  return {
    pos: { x: 3.5, y: 3.5 },
    dir: { x: 1, y: 0 },
    plane: { x: 0, y: 0.66 },
    health: 100,
    ammo: 50,
    shooting: false,
    shootCooldown: 0
  }
}

export function movePlayer(
  player: PlayerState,
  forward: number,
  strafe: number,
  dt: number
): void {
  const speed = MOVE_SPEED * dt

  // Forward/backward
  if (forward !== 0) {
    const moveX = player.dir.x * speed * forward
    const moveY = player.dir.y * speed * forward

    // Axis-separated collision
    const newX = player.pos.x + moveX
    if (!isWall(Math.floor(newX + WALL_MARGIN * Math.sign(moveX)), Math.floor(player.pos.y))) {
      player.pos.x = newX
    }

    const newY = player.pos.y + moveY
    if (!isWall(Math.floor(player.pos.x), Math.floor(newY + WALL_MARGIN * Math.sign(moveY)))) {
      player.pos.y = newY
    }
  }

  // Strafe (perpendicular to direction)
  if (strafe !== 0) {
    const strafeX = -player.dir.y * speed * strafe
    const strafeY = player.dir.x * speed * strafe

    const newX = player.pos.x + strafeX
    if (!isWall(Math.floor(newX + WALL_MARGIN * Math.sign(strafeX)), Math.floor(player.pos.y))) {
      player.pos.x = newX
    }

    const newY = player.pos.y + strafeY
    if (!isWall(Math.floor(player.pos.x), Math.floor(newY + WALL_MARGIN * Math.sign(strafeY)))) {
      player.pos.y = newY
    }
  }

  // Update shoot cooldown
  if (player.shootCooldown > 0) {
    player.shootCooldown -= dt
    if (player.shootCooldown < 0) player.shootCooldown = 0
  }
}

export function setPlayerAngle(player: PlayerState, angle: number): void {
  player.dir.x = Math.cos(angle)
  player.dir.y = Math.sin(angle)
  // Camera plane perpendicular to direction, FOV ~66 degrees
  player.plane.x = -Math.sin(angle) * 0.66
  player.plane.y = Math.cos(angle) * 0.66
}
