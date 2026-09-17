// Two in-world signs flanking the cabinet: the viewer's own progress on the left, the global leaderboard on the
// right. Plain TextShape over a black panel; the text is rebuilt only when its content changes.
import { engine, Entity, Font, Material, MeshRenderer, TextAlignMode, TextShape, Transform } from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

import { CABINET_POSITION } from '../cabinet'
import { formatTics, furthestMap, levelKey, totals } from '../shared/progress'
import { LEADERBOARD_SIZE } from '../shared/schemas'
import { client } from './state'

const PANEL_W = 1.3
const PANEL_H = 2
const PANEL_Y = 1.55
/** Signs stand beside the cabinet, a little forward, turned towards the player spot in front of it. */
const SIDE_OFFSET = 1.75
const FORWARD_OFFSET = -0.2
const TURN_DEG = 28
/** The board has 17 lines, the progress sign up to 16; both must fit the 1.7 m panel. */
const FONT_PROGRESS = 1.05
const FONT_BOARD = 0.85
const TITLE = Color4.create(1, 0.2, 0.15, 1)
const BODY = Color4.create(0.95, 0.9, 0.8, 1)

let progressText: Entity
let boardText: Entity
let lastProgress = ''
let lastBoard = ''
let acc = 0

export function setupSigns() {
  progressText = makeSign(-SIDE_OFFSET, TURN_DEG, FONT_PROGRESS)
  boardText = makeSign(SIDE_OFFSET, -TURN_DEG, FONT_BOARD)
  engine.addSystem(signSystem)
}

function makeSign(sideX: number, yawDeg: number, fontSize: number): Entity {
  const root = engine.addEntity()
  Transform.create(root, {
    position: Vector3.create(CABINET_POSITION.x + sideX, 0, CABINET_POSITION.z + FORWARD_OFFSET),
    rotation: Quaternion.fromEulerDegrees(0, yawDeg, 0)
  })
  const panel = engine.addEntity()
  Transform.create(panel, { parent: root, position: Vector3.create(0, PANEL_Y, 0), scale: Vector3.create(PANEL_W, PANEL_H, 0.05) })
  MeshRenderer.setBox(panel)
  Material.setPbrMaterial(panel, { albedoColor: Color4.Black(), roughness: 1, metallic: 0, specularIntensity: 0 })
  const text = engine.addEntity()
  Transform.create(text, { parent: root, position: Vector3.create(0, PANEL_Y, -0.03) })
  TextShape.create(text, {
    text: '',
    fontSize,
    font: Font.F_MONOSPACE,
    textColor: BODY,
    textAlign: TextAlignMode.TAM_MIDDLE_CENTER,
    width: PANEL_W - 0.1,
    height: PANEL_H - 0.1,
    textWrapping: false,
    outlineWidth: 0.05,
    outlineColor: Color4.Black()
  })
  return text
}

function signSystem(dt: number) {
  acc += dt
  if (acc < 0.5) return
  acc = 0
  const p = progressLines()
  if (p !== lastProgress) {
    lastProgress = p
    TextShape.getMutable(progressText).text = p
  }
  const b = boardLines()
  if (b !== lastBoard) {
    lastBoard = b
    TextShape.getMutable(boardText).text = b
  }
}

function progressLines(): string {
  const lines = [`<color=#ff3326>YOUR PROGRESS</color>`]
  const p = client.progress
  if (!client.serverAlive) {
    lines.push('', 'server offline')
  } else if (!p) {
    lines.push('', 'fetching…')
  } else {
    const t = totals(p)
    lines.push(
      p.name || 'anonymous',
      '',
      `score    ${p.score}`,
      `levels   ${t.levels}/9`,
      `furthest ${t.levels ? levelKey(1, furthestMap(p)) : '-'}`,
      `kills    ${t.kills}`,
      `items    ${t.items}`,
      `secrets  ${t.secrets}`,
      `time     ${formatTics(t.time)}`
    )
  }
  const l = client.live
  if (l.inLevel) {
    lines.push(
      '',
      `<color=#ff3326>NOW ${levelKey(l.episode, l.map)}</color>`,
      `kills ${l.kills}/${l.maxKills}  secrets ${l.secrets}/${l.maxSecrets}`,
      `health ${l.health}  time ${formatTics(l.time)}`
    )
  }
  return lines.join('\n')
}

function boardLines(): string {
  const lines = [`<color=#ff3326>LEADERBOARD</color>`, '']
  if (!client.serverAlive) {
    lines.push('server offline')
    return lines.join('\n')
  }
  for (let i = 0; i < LEADERBOARD_SIZE; i++) {
    const e = client.leaderboard[i]
    const name = e ? (e.name || e.address.slice(0, 8)).slice(0, 12).padEnd(12) : '------------'
    const score = e ? String(e.score).padStart(6) : '   ---'
    lines.push(`${String(i + 1).padStart(2)} ${name} ${score}`)
  }
  lines.push('', 'per level: 1000', '+10/kill +2/item', '+50/secret', '+5/s under par')
  return lines.join('\n')
}
