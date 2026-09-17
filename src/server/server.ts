// The multiplayer server: keeps every player's progress and the global leaderboard in server storage, and holds
// each player's savegame (as base64) so a game can be resumed from any client.
//
// Runs headless (QuickJS, no DOOM engine here): the client reports intermission statistics, the server validates
// their bounds, scores them, persists at that checkpoint and republishes the synced Leaderboard component.
// Savegames arrive in chunks (room messages are capped at ~13 KB) and are stored whole.
import { engine } from '@dcl/sdk/ecs'
import { syncEntity } from '@dcl/sdk/network'
import { AUTH_SERVER_PEER_ID } from '@dcl/sdk/network/message-bus-sync'
import { Storage } from '@dcl/sdk/server'

import { chunk, room } from '../shared/messages'
import {
  emptyProgress,
  levelKey,
  levelScore,
  Progress,
  sanitizeName,
  totals,
  validLevelResult
} from '../shared/progress'
import { HEARTBEAT_S, Leaderboard, LEADERBOARD_SIZE, LeaderboardEntry, ServerHeartbeat, SyncId } from '../shared/schemas'

const KEY_PROGRESS = 'doom:progress'
const KEY_LEADERBOARD = 'doom:leaderboard'
const keySave = (slot: number) => `doom:save${slot}`
const keySaveMeta = (slot: number) => `doom:save${slot}:meta`
/** Vanilla DOOM refuses saves above 180 KB; base64 of that is 240 KB. Anything larger is not a savegame. */
const MAX_SAVE_CHARS = 260_000

const progressCache = new Map<string, Progress>()
const uploads = new Map<string, { slot: number; total: number; parts: (string | undefined)[]; received: number }>()
let board = [] as LeaderboardEntry[]
let boardEntity = engine.addEntity()
let heartbeatEntity = engine.addEntity()

const log = (s: string) => console.log('[SERVER] ' + s)

export function initServer() {
  Leaderboard.validateBeforeChange((v) => v.senderAddress === AUTH_SERVER_PEER_ID)
  ServerHeartbeat.validateBeforeChange((v) => v.senderAddress === AUTH_SERVER_PEER_ID)

  boardEntity = engine.addEntity()
  Leaderboard.create(boardEntity, { entries: [], updatedAt: Date.now() })
  syncEntity(boardEntity, [Leaderboard.componentId], SyncId.Leaderboard)

  heartbeatEntity = engine.addEntity()
  ServerHeartbeat.create(heartbeatEntity, { at: Date.now() })
  syncEntity(heartbeatEntity, [ServerHeartbeat.componentId], SyncId.Heartbeat)
  let acc = 0
  engine.addSystem((dt) => {
    acc += dt
    if (acc < HEARTBEAT_S) return
    acc = 0
    ServerHeartbeat.getMutable(heartbeatEntity).at = Date.now()
  })

  void loadLeaderboard()

  room.onMessage('hello', (data, ctx) => {
    if (!ctx) return
    void (async () => {
      const p = await getProgress(ctx.from)
      const name = sanitizeName(data.name)
      if (name && name !== p.name) {
        p.name = name
        await persistProgress(p)
        await refreshBoardNames(p)
      }
      sendProgress(ctx.from, p)
      log(`hello from ${p.name || ctx.from} (score ${p.score})`)
    })()
  })

  room.onMessage('levelDone', (data, ctx) => {
    if (!ctx) return
    const { episode, map, ...r } = data
    if (!validLevelResult(episode, map, r)) {
      log(`rejected levelDone from ${ctx.from}: ${JSON.stringify(data)}`)
      return
    }
    void (async () => {
      const p = await getProgress(ctx.from)
      const key = levelKey(episode, map)
      const score = levelScore(r)
      const prev = p.levels[key]
      if (!prev || score > prev.score) {
        p.levels[key] = { ...r, score }
        p.score = 0
        for (const k in p.levels) p.score += p.levels[k].score
        p.updatedAt = Date.now()
        const ok = await persistProgress(p)
        await updateBoard(p)
        log(`${p.name || ctx.from} finished ${key}: ${score} pts (total ${p.score}), persisted ${ok}`)
      }
      sendProgress(ctx.from, p)
    })()
  })

  room.onMessage('saveChunk', (data, ctx) => {
    if (!ctx) return
    const id = ctx.from.toLowerCase()
    const { slot, index, total } = data
    if (total < 1 || total > 40 || index < 0 || index >= total) return
    let up = uploads.get(id)
    if (!up || up.slot !== slot || up.total !== total) {
      up = { slot, total, parts: new Array(total), received: 0 }
      uploads.set(id, up)
    }
    if (up.parts[index] === undefined) up.received++
    up.parts[index] = data.data
    if (up.received < total) return
    uploads.delete(id)
    const b64 = up.parts.join('')
    void (async () => {
      if (b64.length === 0 || b64.length > MAX_SAVE_CHARS || !/^[A-Za-z0-9+/]+=*$/.test(b64)) {
        room.send('saveResult', { slot, ok: false, error: 'invalid savegame' }, { to: [ctx.from] })
        return
      }
      const ok = (await Storage.player.set(id, keySave(slot), b64)) && (await Storage.player.set(id, keySaveMeta(slot), data.meta))
      room.send('saveResult', { slot, ok, error: ok ? '' : 'storage write failed' }, { to: [ctx.from] })
      log(`save slot ${slot} for ${ctx.from}: ${b64.length} chars, ok ${ok}`)
    })()
  })

  room.onMessage('loadRequest', (data, ctx) => {
    if (!ctx) return
    const id = ctx.from.toLowerCase()
    const { slot } = data
    void (async () => {
      const b64 = await Storage.player.get<string>(id, keySave(slot))
      if (typeof b64 !== 'string' || b64.length === 0) {
        room.send('loadResult', { slot, ok: false, error: 'no savegame stored' }, { to: [ctx.from] })
        return
      }
      const parts = chunk(b64)
      for (let i = 0; i < parts.length; i++) {
        await room.send('loadChunk', { slot, index: i, total: parts.length, data: parts[i] }, { to: [ctx.from] })
      }
      room.send('loadResult', { slot, ok: true, error: '' }, { to: [ctx.from] })
      log(`load slot ${slot} for ${ctx.from}: ${parts.length} chunks`)
    })()
  })

  room.onMessage('deleteRecord', (data, ctx) => {
    if (!ctx || !data.confirm) return
    const id = ctx.from.toLowerCase()
    void (async () => {
      const name = (await getProgress(id)).name
      progressCache.delete(id)
      uploads.delete(id)
      const results = await Promise.all([
        Storage.player.delete(id, KEY_PROGRESS),
        Storage.player.delete(id, keySave(0)),
        Storage.player.delete(id, keySaveMeta(0))
      ])
      const hadRow = board.some((e) => e.address === id)
      if (hadRow) {
        board = board.filter((e) => e.address !== id)
        publishBoard()
        results.push(await Storage.set(KEY_LEADERBOARD, JSON.stringify(board)))
      }
      // keep the display name so a later level completion is attributed straight away
      const fresh = emptyProgress(id)
      fresh.name = name
      progressCache.set(id, fresh)
      if (name) results.push(await persistProgress(fresh))
      const ok = results.every(Boolean)
      sendProgress(ctx.from, fresh)
      room.send('deleteResult', { ok, error: ok ? '' : 'a storage delete failed' }, { to: [ctx.from] })
      log(`deleted record of ${ctx.from}: ok ${ok}`)
    })()
  })

  log('ready')
}

async function getProgress(address: string): Promise<Progress> {
  const id = address.toLowerCase()
  let p = progressCache.get(id)
  if (p) return p
  const raw = await Storage.player.get<string>(id, KEY_PROGRESS)
  p = emptyProgress(id)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as Progress
      if (parsed && parsed.levels) p = { ...p, ...parsed, address: id }
    } catch (e) {
      log(`corrupt progress for ${id}: ${String(e)}`)
    }
  }
  progressCache.set(id, p)
  return p
}

async function persistProgress(p: Progress): Promise<boolean> {
  const ok = await Storage.player.set(p.address, KEY_PROGRESS, JSON.stringify(p))
  if (!ok) log(`progress write failed for ${p.address}`)
  return ok
}

function sendProgress(to: string, p: Progress) {
  room.send('progress', { json: JSON.stringify(p) }, { to: [to] })
}

function entryFor(p: Progress): LeaderboardEntry {
  const t = totals(p)
  return { address: p.address, name: p.name, score: p.score, levels: t.levels, kills: t.kills, secrets: t.secrets, time: t.time }
}

async function loadLeaderboard() {
  const raw = await Storage.get<string>(KEY_LEADERBOARD)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) board = parsed
    } catch (e) {
      log(`corrupt leaderboard: ${String(e)}`)
    }
  }
  publishBoard()
  log(`leaderboard loaded: ${board.length} entries`)
}

function publishBoard() {
  const lb = Leaderboard.getMutable(boardEntity)
  lb.entries = board
  lb.updatedAt = Date.now()
}

async function updateBoard(p: Progress) {
  if (p.score <= 0) return
  board = board.filter((e) => e.address !== p.address)
  board.push(entryFor(p))
  board.sort((a, b) => b.score - a.score || a.time - b.time)
  board = board.slice(0, LEADERBOARD_SIZE)
  publishBoard()
  const ok = await Storage.set(KEY_LEADERBOARD, JSON.stringify(board))
  if (!ok) log('leaderboard write failed')
}

/** A renamed player keeps their row; refresh the name without rescoring. */
async function refreshBoardNames(p: Progress) {
  const row = board.find((e) => e.address === p.address)
  if (!row || row.name === p.name) return
  row.name = p.name
  publishBoard()
  await Storage.set(KEY_LEADERBOARD, JSON.stringify(board))
}
