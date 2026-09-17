// Client side of the multiplayer server: greets it once the room is synced, mirrors the progress and leaderboard
// into `client`, watches the server heartbeat, and moves savegames to and from the server in chunks.
import { engine } from '@dcl/sdk/ecs'
import { isStateSyncronized } from '@dcl/sdk/network'
import { getPlayer } from '@dcl/sdk/src/players'

import { chunk, room } from '../shared/messages'
import { Progress, SaveMeta } from '../shared/progress'
import { HEARTBEAT_S, Leaderboard, ServerHeartbeat } from '../shared/schemas'
import { client } from './state'

const log = (s: string) => console.log('[CLIENT] ' + s)

let greeted = false
let outbox: { slot: number; index: number; total: number; data: string; meta: string }[] = []
let onLoaded: ((bytes: string) => void) | null = null
let inbox: { slot: number; total: number; parts: (string | undefined)[]; received: number } | null = null
let heartbeatValue = 0
let heartbeatSeenAt = 0
let boardUpdatedAt = -1

export function initNet() {
  room.onMessage('progress', (data) => {
    try {
      client.progress = JSON.parse(data.json) as Progress
    } catch (e) {
      log('bad progress json: ' + String(e))
    }
  })

  room.onMessage('saveResult', (data) => {
    client.transfer = { kind: 'idle', done: 0, total: 0 }
    client.message = data.ok ? 'Saved to the server' : 'Save failed: ' + data.error
    log(`saveResult slot ${data.slot} ok ${data.ok} ${data.error}`)
  })

  room.onMessage('loadChunk', (data) => {
    if (!inbox || inbox.slot !== data.slot || inbox.total !== data.total) {
      inbox = { slot: data.slot, total: data.total, parts: new Array(data.total), received: 0 }
    }
    if (inbox.parts[data.index] === undefined) inbox.received++
    inbox.parts[data.index] = data.data
    client.transfer = { kind: 'loading', done: inbox.received, total: data.total }
  })

  room.onMessage('loadResult', (data) => {
    const box = inbox
    inbox = null
    client.transfer = { kind: 'idle', done: 0, total: 0 }
    if (!data.ok) {
      client.message = 'Load failed: ' + data.error
      onLoaded = null
      return
    }
    if (!box || box.received < box.total) {
      client.message = 'Load failed: incomplete transfer'
      onLoaded = null
      return
    }
    const cb = onLoaded
    onLoaded = null
    client.message = 'Loaded from the server'
    if (cb) cb(box.parts.join(''))
  })

  room.onMessage('deleteResult', (data) => {
    client.message = data.ok ? 'Your record was deleted' : 'Delete failed: ' + data.error
    log(`deleteResult ok ${data.ok} ${data.error}`)
  })

  client.actions.deleteRecord = deleteRecord
  engine.addSystem(netSystem)
}

/** Confirmed by the UI: wipe progress, savegame and leaderboard row on the server. */
export function deleteRecord() {
  client.confirmDelete = false
  if (!client.serverAlive) {
    client.message = 'Server not responding'
    return
  }
  client.message = 'Deleting your record…'
  room.send('deleteRecord', { confirm: true })
}

function netSystem(dt: number) {
  // room readiness and the one-off greeting (needs the profile name, which can arrive a little later)
  if (!client.synced) client.synced = isStateSyncronized()
  if (client.synced && !greeted) {
    const me = getPlayer()
    if (me) {
      client.name = me.name || ''
      greeted = true
      room.send('hello', { name: client.name })
      log(`hello as "${client.name}"`)
    }
  }

  // heartbeat: alive while the server keeps changing the value (client-observed time, so a stale snapshot from a
  // previous server run does not count)
  const now = Date.now()
  for (const [, hb] of engine.getEntitiesWith(ServerHeartbeat)) {
    const at = Number(hb.at)
    if (at !== heartbeatValue) {
      heartbeatValue = at
      heartbeatSeenAt = now
    }
  }
  const alive = heartbeatSeenAt > 0 && now - heartbeatSeenAt < HEARTBEAT_S * 3 * 1000
  if (alive !== client.serverAlive) {
    client.serverAlive = alive
    log(alive ? 'server alive' : 'server not responding')
    if (!alive && client.transfer.kind !== 'idle') {
      client.transfer = { kind: 'idle', done: 0, total: 0 }
      client.message = 'Server not responding'
    }
  }

  // leaderboard mirror (copied when the server republishes it)
  for (const [, lb] of engine.getEntitiesWith(Leaderboard)) {
    const at = Number(lb.updatedAt)
    if (at !== boardUpdatedAt) {
      boardUpdatedAt = at
      client.leaderboard = lb.entries.map((e) => ({ ...e }))
    }
  }

  // one upload chunk per tick keeps well under the server's inbound rate limit and animates the bar
  if (outbox.length > 0) {
    const part = outbox.shift()!
    room.send('saveChunk', part)
    client.transfer = { kind: 'saving', done: part.index + 1, total: part.total }
  }
}

export function reportLevel(data: {
  episode: number
  map: number
  skill: number
  kills: number
  maxKills: number
  items: number
  maxItems: number
  secrets: number
  maxSecrets: number
  time: number
  par: number
}) {
  if (!client.synced) return
  room.send('levelDone', data)
  log(`levelDone ${JSON.stringify(data)}`)
}

/** Queue a savegame (already base64) for upload; the result lands in client.message. */
export function uploadSave(slot: number, b64: string, meta: SaveMeta) {
  if (!client.serverAlive) {
    client.message = 'Server not responding'
    return
  }
  const parts = chunk(b64)
  outbox = parts.map((data, index) => ({
    slot,
    index,
    total: parts.length,
    data,
    meta: index === parts.length - 1 ? JSON.stringify(meta) : ''
  }))
  client.transfer = { kind: 'saving', done: 0, total: parts.length }
  client.message = `Saving ${Math.round(b64.length / 1024)} KB…`
}

/** Ask the server for the stored savegame; `cb` receives the base64 once every chunk has arrived. */
export function downloadSave(slot: number, cb: (b64: string) => void) {
  if (!client.serverAlive) {
    client.message = 'Server not responding'
    return
  }
  onLoaded = cb
  inbox = null
  client.transfer = { kind: 'loading', done: 0, total: 1 }
  client.message = 'Loading from the server…'
  room.send('loadRequest', { slot })
}

export function transferBusy(): boolean {
  return client.transfer.kind !== 'idle'
}
