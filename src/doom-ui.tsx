import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { getGameState } from './doom/game'

const CEILING_COLOR = Color4.create(0.15, 0.15, 0.2, 1)
const FLOOR_COLOR = Color4.create(0.25, 0.18, 0.1, 1)
const HUD_BG = Color4.create(0.15, 0.15, 0.15, 0.95)
const SHOOT_FLASH = Color4.create(1, 1, 0.5, 0.3)

const VIEWPORT_WIDTH = 1920
const VIEWPORT_HEIGHT = 960
const HUD_HEIGHT = 48
const MINIMAP_CELL = 8
const MINIMAP_PADDING = 8
const Z_OVERLAY = 9999

export function setupDoomUi(): void {
  ReactEcsRenderer.setUiRenderer(doomRenderer)
}

function doomRenderer() {
  const state = getGameState()
  if (!state || !state.active) return null

  const colWidth = VIEWPORT_WIDTH / state.screenWidth
  const halfHeight = VIEWPORT_HEIGHT / 2

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* Game container — background is floor color */}
      <UiEntity
        uiTransform={{
          width: VIEWPORT_WIDTH,
          height: VIEWPORT_HEIGHT + HUD_HEIGHT + 24,
          flexShrink: 0
        }}
        uiBackground={{ color: FLOOR_COLOR }}
      >
        {/* Ceiling */}
        <UiEntity
          uiTransform={{
            width: VIEWPORT_WIDTH,
            height: halfHeight,
            positionType: 'absolute',
            position: { top: 0, left: 0 },
            zIndex: 0
          }}
          uiBackground={{ color: CEILING_COLOR }}
        />

        {/* Enemy sprite strips — depth-tested per column, rendered BEFORE walls */}
        {state.spriteStrips.map((strip, i) => {
          if (!strip.visible) return null
          return (
            <UiEntity
              key={`s${i}`}
              uiTransform={{
                width: strip.width,
                height: strip.height,
                positionType: 'absolute',
                position: {
                  top: strip.top,
                  left: strip.left
                },
                zIndex: 1
              }}
              uiBackground={{ color: strip.color }}
            />
          )
        })}

        {/* Wall columns — always on top of sprites */}
        {state.columns.map((col, i) => {
          const height = col.drawEnd - col.drawStart
          if (height <= 0) return null
          return (
            <UiEntity
              key={i}
              uiTransform={{
                width: Math.ceil(colWidth) + 1,
                height: height,
                positionType: 'absolute',
                position: {
                  top: col.drawStart,
                  left: Math.floor(i * colWidth)
                },
                zIndex: 2
              }}
              uiBackground={{ color: col.color }}
            />
          )
        })}

        {/* Shoot flash overlay */}
        {state.player.shooting && (
          <UiEntity
            uiTransform={{
              width: VIEWPORT_WIDTH,
              height: VIEWPORT_HEIGHT,
              positionType: 'absolute',
              position: { top: 0, left: 0 },
              zIndex: Z_OVERLAY
            }}
            uiBackground={{ color: SHOOT_FLASH }}
          />
        )}

        {/* Damage flash overlay */}
        {state.damageFlash > 0 && (
          <UiEntity
            uiTransform={{
              width: VIEWPORT_WIDTH,
              height: VIEWPORT_HEIGHT,
              positionType: 'absolute',
              position: { top: 0, left: 0 },
              zIndex: Z_OVERLAY
            }}
            uiBackground={{ color: Color4.create(1, 0, 0, Math.min(0.5, state.damageFlash * 3)) }}
          />
        )}

        {/* Death screen text */}
        {state.dead && (
          <Label
            value="YOU DIED"
            fontSize={64}
            color={Color4.create(1, 0, 0, 1)}
            uiTransform={{
              width: VIEWPORT_WIDTH,
              height: 100,
              positionType: 'absolute',
              position: { top: halfHeight - 50, left: 0 },
              zIndex: Z_OVERLAY
            }}
            textAlign="middle-center"
          />
        )}

        {/* Crosshair */}
        {!state.dead && (
          <UiEntity
            uiTransform={{
              width: 4,
              height: 4,
              positionType: 'absolute',
              position: {
                top: halfHeight - 2,
                left: VIEWPORT_WIDTH / 2 - 2
              },
              zIndex: Z_OVERLAY
            }}
            uiBackground={{ color: Color4.create(1, 1, 1, 0.8) }}
          />
        )}

        {/* Minimap */}
        <UiEntity
          uiTransform={{
            width: state.minimapSize * MINIMAP_CELL,
            height: state.minimapSize * MINIMAP_CELL,
            positionType: 'absolute',
            position: {
              top: MINIMAP_PADDING,
              left: VIEWPORT_WIDTH - state.minimapSize * MINIMAP_CELL - MINIMAP_PADDING
            },
            zIndex: Z_OVERLAY
          }}
          uiBackground={{ color: Color4.create(0, 0, 0, 0.6) }}
        >
          {state.minimapCells.map((cell, idx) => {
            const mx = idx % state.minimapSize
            const my = Math.floor(idx / state.minimapSize)
            return (
              <UiEntity
                key={idx}
                uiTransform={{
                  width: MINIMAP_CELL,
                  height: MINIMAP_CELL,
                  positionType: 'absolute',
                  position: {
                    top: my * MINIMAP_CELL,
                    left: mx * MINIMAP_CELL
                  }
                }}
                uiBackground={{ color: cell }}
              />
            )
          })}
        </UiEntity>

        {/* HUD bar */}
        <UiEntity
          uiTransform={{
            width: VIEWPORT_WIDTH,
            height: HUD_HEIGHT,
            positionType: 'absolute',
            position: { top: VIEWPORT_HEIGHT, left: 0 },
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: { left: 16, right: 16 },
            zIndex: Z_OVERLAY
          }}
          uiBackground={{ color: HUD_BG }}
        >
          <Label
            value={`HEALTH: ${state.player.health}`}
            fontSize={18}
            color={state.player.health <= 25
              ? Color4.create(1, 0, 0, 1)
              : Color4.create(1, 0.2, 0.2, 1)}
            uiTransform={{ width: 200, height: HUD_HEIGHT }}
          />
          <Label
            value={`KILLS: ${state.killCount}`}
            fontSize={18}
            color={Color4.create(0.9, 0.9, 0.9, 1)}
            uiTransform={{ width: 150, height: HUD_HEIGHT }}
            textAlign="middle-center"
          />
          <Label
            value="DOOM-DCL"
            fontSize={22}
            color={Color4.create(0.8, 0.8, 0.8, 1)}
            uiTransform={{ width: 200, height: HUD_HEIGHT }}
            textAlign="middle-center"
          />
          <Label
            value={`AMMO: ${state.player.ammo}`}
            fontSize={18}
            color={state.player.ammo <= 10
              ? Color4.create(1, 0.5, 0, 1)
              : Color4.create(1, 1, 0.2, 1)}
            uiTransform={{ width: 200, height: HUD_HEIGHT }}
            textAlign="middle-right"
          />
        </UiEntity>

        {/* Toggle hint */}
        <Label
          value="Press 4 to toggle | WASD move | Mouse look | Click shoot | F use door"
          fontSize={12}
          color={Color4.create(0.6, 0.6, 0.6, 0.8)}
          uiTransform={{
            width: VIEWPORT_WIDTH,
            height: 20,
            positionType: 'absolute',
            position: { top: VIEWPORT_HEIGHT + HUD_HEIGHT + 4, left: 0 },
            zIndex: Z_OVERLAY
          }}
          textAlign="middle-center"
        />
      </UiEntity>
    </UiEntity>
  )
}
