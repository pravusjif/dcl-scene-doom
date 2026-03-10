import { Color4 } from '@dcl/sdk/math'
import { GameState } from './types'
import { WORLD_MAP, MAP_WIDTH, MAP_HEIGHT, getWallColor } from './map'

export function castRays(state: GameState): void {
  const { player, screenWidth, screenHeight } = state
  const pw = screenWidth

  for (let x = 0; x < pw; x++) {
    const cameraX = (2.0 * x) / pw - 1.0
    const rayDirX = player.dir.x + player.plane.x * cameraX
    const rayDirY = player.dir.y + player.plane.y * cameraX

    let mapX = Math.floor(player.pos.x)
    let mapY = Math.floor(player.pos.y)

    const deltaDistX = rayDirX === 0 ? 1e30 : Math.abs(1.0 / rayDirX)
    const deltaDistY = rayDirY === 0 ? 1e30 : Math.abs(1.0 / rayDirY)

    let stepX: number
    let stepY: number
    let sideDistX: number
    let sideDistY: number

    if (rayDirX < 0) {
      stepX = -1
      sideDistX = (player.pos.x - mapX) * deltaDistX
    } else {
      stepX = 1
      sideDistX = (mapX + 1.0 - player.pos.x) * deltaDistX
    }

    if (rayDirY < 0) {
      stepY = -1
      sideDistY = (player.pos.y - mapY) * deltaDistY
    } else {
      stepY = 1
      sideDistY = (mapY + 1.0 - player.pos.y) * deltaDistY
    }

    // DDA
    let hit = false
    let side = 0
    let maxSteps = 64

    while (!hit && maxSteps-- > 0) {
      if (sideDistX < sideDistY) {
        sideDistX += deltaDistX
        mapX += stepX
        side = 0
      } else {
        sideDistY += deltaDistY
        mapY += stepY
        side = 1
      }

      if (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT) {
        hit = true
      } else if (WORLD_MAP[mapY][mapX] > 0) {
        hit = true
      }
    }

    let perpWallDist: number
    if (side === 0) {
      perpWallDist = sideDistX - deltaDistX
    } else {
      perpWallDist = sideDistY - deltaDistY
    }
    if (perpWallDist < 0.01) perpWallDist = 0.01

    const lineHeight = Math.floor(screenHeight / perpWallDist)
    let drawStart = Math.floor(-lineHeight / 2 + screenHeight / 2)
    if (drawStart < 0) drawStart = 0
    let drawEnd = Math.floor(lineHeight / 2 + screenHeight / 2)
    if (drawEnd >= screenHeight) drawEnd = screenHeight - 1

    const wallType =
      mapX >= 0 && mapX < MAP_WIDTH && mapY >= 0 && mapY < MAP_HEIGHT
        ? WORLD_MAP[mapY][mapX]
        : 1

    const col = state.columns[x]
    col.drawStart = drawStart
    col.drawEnd = drawEnd
    col.distance = perpWallDist

    // Replace color object
    col.color = getWallColor(wallType, side, perpWallDist)
  }
}
