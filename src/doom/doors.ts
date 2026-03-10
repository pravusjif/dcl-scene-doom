import { GameState, Door, DoorState, WallType } from './types'
import { WORLD_MAP } from './map'

const DOOR_SPEED = 2.0      // opens/closes in 0.5 seconds
const DOOR_STAY_OPEN = 3.0  // seconds before auto-closing

export function findDoors(): Door[] {
  const doors: Door[] = []
  for (let y = 0; y < WORLD_MAP.length; y++) {
    for (let x = 0; x < WORLD_MAP[y].length; x++) {
      if (WORLD_MAP[y][x] === WallType.DOOR_RED) {
        doors.push({
          mapX: x,
          mapY: y,
          state: DoorState.CLOSED,
          openAmount: 0,
          timer: 0
        })
      }
    }
  }
  return doors
}

export function updateDoors(state: GameState, dt: number): void {
  if (!state.doors) return

  for (const door of state.doors) {
    switch (door.state) {
      case DoorState.OPENING:
        door.openAmount += DOOR_SPEED * dt
        if (door.openAmount >= 1) {
          door.openAmount = 1
          door.state = DoorState.OPEN
          door.timer = DOOR_STAY_OPEN
          // Remove wall from map so player can walk through
          WORLD_MAP[door.mapY][door.mapX] = WallType.EMPTY
        }
        break

      case DoorState.OPEN:
        door.timer -= dt
        if (door.timer <= 0) {
          // Check if player is in the doorway before closing
          const px = Math.floor(state.player.pos.x)
          const py = Math.floor(state.player.pos.y)
          if (px !== door.mapX || py !== door.mapY) {
            door.state = DoorState.CLOSING
          } else {
            door.timer = 0.5 // retry shortly
          }
        }
        break

      case DoorState.CLOSING:
        door.openAmount -= DOOR_SPEED * dt
        if (door.openAmount <= 0) {
          door.openAmount = 0
          door.state = DoorState.CLOSED
          // Restore wall
          WORLD_MAP[door.mapY][door.mapX] = WallType.DOOR_RED
        }
        break
    }
  }
}

export function tryUseDoor(state: GameState): void {
  if (!state.doors) return

  const { player } = state
  // Check a few units ahead of the player for a door
  const checkDist = 2.0
  const checkX = Math.floor(player.pos.x + player.dir.x * checkDist)
  const checkY = Math.floor(player.pos.y + player.dir.y * checkDist)

  // Also check immediate adjacent cell
  const adjX = Math.floor(player.pos.x + player.dir.x * 1.0)
  const adjY = Math.floor(player.pos.y + player.dir.y * 1.0)

  for (const door of state.doors) {
    const match =
      (door.mapX === checkX && door.mapY === checkY) ||
      (door.mapX === adjX && door.mapY === adjY)

    if (match && door.state === DoorState.CLOSED) {
      door.state = DoorState.OPENING
      break
    }
  }
}

// For the raycaster: get the effective wall type at a position
// Returns 0 if the door is fully open, DOOR_RED if closed,
// and a partially-open indicator via openAmount
export function getDoorAt(x: number, y: number, doors: Door[]): Door | null {
  for (const door of doors) {
    if (door.mapX === x && door.mapY === y) return door
  }
  return null
}
