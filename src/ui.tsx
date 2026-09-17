import { Color4 } from '@dcl/sdk/math'
import ReactEcs, { Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'

import { arcade, leaveCabinet } from './cabinet'
import { client } from './client/state'
import { CELL_OPTIONS, settings } from './settings'
import { PANEL_H, PANEL_LEFT, PANEL_TOP, PANEL_W } from './layout'
import { formatTics, furthestMap, levelKey, totals } from './shared/progress'

const WHITE = Color4.White()
const PANEL_BG = Color4.create(0, 0, 0, 0.7)
const BTN_ON = Color4.create(0.8, 0.2, 0.2, 1)
const BTN_OFF = Color4.create(0.25, 0.25, 0.25, 0.95)
const BTN_DISABLED = Color4.create(0.18, 0.18, 0.18, 0.6)
const BTN_LEAVE = Color4.create(0.45, 0.1, 0.1, 0.95)
const BTN_SAVE = Color4.create(0.15, 0.4, 0.2, 0.95)
const HINT = Color4.create(0.8, 0.8, 0.8, 1)
const STATUS = Color4.create(1, 0.85, 0.6, 1)
const BAR_BG = Color4.create(0.1, 0.1, 0.1, 1)
const BAR_FG = Color4.create(1, 0.3, 0.2, 1)
const TEXT_DISABLED = Color4.create(0.55, 0.55, 0.55, 1)

const CONTROLS =
  'W/S move   A/D strafe   mouse turn   click fire   E/Space use (doors, switches)   ' +
  'F Enter   4 menu (Esc)   1-3 weapons   Shift run   |   hold right-click for a cursor to use the settings or leave'

function Button(props: {
  key?: string | number
  label: string
  active: boolean
  color?: Color4
  disabled?: boolean
  onClick: () => void
}) {
  const color = props.disabled ? BTN_DISABLED : props.active ? BTN_ON : props.color ?? BTN_OFF
  return (
    <UiEntity
      uiTransform={{ width: 110, height: 30, margin: { right: 6 }, justifyContent: 'center', alignItems: 'center' }}
      uiBackground={{ color }}
      onMouseDown={props.disabled ? undefined : props.onClick}
    >
      <Label value={props.label} fontSize={15} color={props.disabled ? TEXT_DISABLED : WHITE} />
    </UiEntity>
  )
}

function Caption(props: { text: string }) {
  return (
    <UiEntity uiTransform={{ width: 100, height: 30, justifyContent: 'flex-end', alignItems: 'center', margin: { right: 8 } }}>
      <Label value={props.text} fontSize={15} color={HINT} textAlign="middle-right" />
    </UiEntity>
  )
}

/** Savegame transfer progress; sized for the row, hidden (transparent) while idle. */
function TransferBar() {
  const t = client.transfer
  const busy = t.kind !== 'idle'
  const frac = busy && t.total > 0 ? Math.min(1, t.done / t.total) : 0
  return (
    <UiEntity
      uiTransform={{ width: 160, height: 14, margin: { left: 4, right: 10 } }}
      uiBackground={{ color: busy ? BAR_BG : Color4.create(0, 0, 0, 0) }}
    >
      <UiEntity uiTransform={{ width: `${Math.round(frac * 100)}%`, height: '100%' }} uiBackground={{ color: busy ? BAR_FG : Color4.create(0, 0, 0, 0) }} />
    </UiEntity>
  )
}

/** Delete my record: one button that turns into an in-place confirmation. */
function DeleteControls(props: { busy: boolean }) {
  const hasRecord = !!client.progress && (client.progress.score > 0 || Object.keys(client.progress.levels).length > 0)
  if (!client.confirmDelete) {
    return (
      <Button
        label="Delete record"
        active={false}
        color={BTN_LEAVE}
        disabled={!client.serverAlive || props.busy}
        onClick={() => (client.confirmDelete = true)}
      />
    )
  }
  return (
    <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
      <Label
        value={hasRecord ? 'Delete your progress, score and savegame?' : 'Delete your (empty) record and savegame?'}
        fontSize={14}
        color={STATUS}
        textAlign="middle-right"
        uiTransform={{ width: 300, height: 20, margin: { right: 8 } }}
      />
      <Button label="Yes, delete" active={true} onClick={client.actions.deleteRecord} />
      <Button label="Cancel" active={false} onClick={() => (client.confirmDelete = false)} />
    </UiEntity>
  )
}

function progressLine(): string {
  if (!client.serverAlive) return 'server offline: progress and saves unavailable'
  const p = client.progress
  if (!p) return 'fetching your progress…'
  const t = totals(p)
  const furthest = t.levels ? levelKey(1, furthestMap(p)) : '-'
  return `${p.name || 'you'}: ${p.score} pts | ${t.levels}/9 levels (furthest ${furthest}) | ${t.kills} kills | ${t.secrets} secrets | ${formatTics(t.time)}`
}

function SettingsPanel() {
  const busy = client.transfer.kind !== 'idle'
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { left: 0, top: 24 },
        width: '100%',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      <UiEntity
        uiTransform={{ flexDirection: 'column', alignItems: 'center', padding: { top: 8, bottom: 6, left: 16, right: 16 } }}
        uiBackground={{ color: PANEL_BG }}
      >
        <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { bottom: 6 } }}>
          <Caption text="Renderer" />
          <Button label="Doom (pixels)" active={settings.renderer === 'pixels'} onClick={() => (settings.renderer = 'pixels')} />
          <Button label="DoomTex" active={settings.renderer === 'textured'} onClick={() => (settings.renderer = 'textured')} />
          <Caption text="Cells" />
          {CELL_OPTIONS.map((c) => (
            <Button key={c} label={String(c)} active={settings.cells === c} onClick={() => (settings.cells = c)} />
          ))}
          <Caption text="" />
          <Button label="Leave cabinet" active={false} color={BTN_LEAVE} onClick={leaveCabinet} />
        </UiEntity>
        <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { bottom: 6 } }}>
          <Caption text="Server" />
          <Button
            label="Save game"
            active={false}
            color={BTN_SAVE}
            disabled={!client.serverAlive || !client.live.canSave || busy}
            onClick={client.actions.save}
          />
          <Button
            label="Load game"
            active={false}
            color={BTN_SAVE}
            disabled={!client.serverAlive || busy}
            onClick={client.actions.load}
          />
          <TransferBar />
          {!client.confirmDelete && (
            <Label value={client.message} fontSize={14} color={HINT} textAlign="middle-left" uiTransform={{ width: 420, height: 20 }} />
          )}
          <DeleteControls busy={busy} />
        </UiEntity>
        <Label value={progressLine()} fontSize={14} color={HINT} textAlign="middle-center" uiTransform={{ width: 1100, height: 20 }} />
        <Label
          value={settings.status}
          fontSize={13}
          color={STATUS}
          textAlign="middle-center"
          uiTransform={{ width: 1100, height: 20 }}
        />
      </UiEntity>
    </UiEntity>
  )
}

function ControlsStrip() {
  return (
    <UiEntity
      uiTransform={{
        positionType: 'absolute',
        position: { left: PANEL_LEFT, top: PANEL_TOP + PANEL_H + 8 },
        width: PANEL_W,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center'
      }}
      uiBackground={{ color: PANEL_BG }}
    >
      <Label value={CONTROLS} fontSize={15} color={STATUS} textAlign="middle-center" />
    </UiEntity>
  )
}

// Nothing is drawn until the screen has grown out of the cabinet (the presenters hide themselves too, see
// src/client/game.ts).
const uiRoot = () => {
  if (!arcade.screenOn) return null
  return (
    <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute', position: { top: 0, left: 0 } }}>
      <SettingsPanel />
      <ControlsStrip />
    </UiEntity>
  )
}

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(uiRoot, { virtualWidth: 1920, virtualHeight: 1080 })
}
