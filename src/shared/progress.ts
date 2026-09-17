// Player progress: the best result per finished level, scored for the leaderboard, plus the savegame summary.
// Shared by the server (validation, scoring, storage) and the client (signs, UI).

export const SAVE_SLOT = 0

/** Intermission statistics of one finished level; times in tics (35 per second). */
export type LevelResult = {
  kills: number
  maxKills: number
  items: number
  maxItems: number
  secrets: number
  maxSecrets: number
  time: number
  par: number
}

export type Progress = {
  address: string
  name: string
  /** Sum of the level scores. */
  score: number
  /** Best result per level, keyed by levelKey(). */
  levels: Record<string, LevelResult & { score: number }>
  updatedAt: number
}

export function levelKey(episode: number, map: number): string {
  return `E${episode}M${map}`
}

/** 1000 per level, 10 per kill, 2 per item, 50 per secret, 5 per second under par. */
export function levelScore(r: LevelResult): number {
  const underPar = r.par > 0 ? Math.max(0, Math.floor((r.par - r.time) / 35)) : 0
  return 1000 + 10 * r.kills + 2 * r.items + 50 * r.secrets + 5 * underPar
}

export function emptyProgress(address: string): Progress {
  return { address, name: '', score: 0, levels: {}, updatedAt: 0 }
}

/** Shareware DOOM: episode 1, maps 1-9; counts within the level's totals; at least 3 s of play. */
export function validLevelResult(episode: number, map: number, r: LevelResult): boolean {
  const int = (n: number, lo: number, hi: number) => Number.isInteger(n) && n >= lo && n <= hi
  return (
    int(episode, 1, 1) &&
    int(map, 1, 9) &&
    int(r.maxKills, 0, 1000) &&
    int(r.maxItems, 0, 1000) &&
    int(r.maxSecrets, 0, 100) &&
    int(r.kills, 0, r.maxKills) &&
    int(r.items, 0, r.maxItems) &&
    int(r.secrets, 0, r.maxSecrets) &&
    int(r.time, 35 * 3, 35 * 3600 * 10) &&
    int(r.par, 0, 35 * 3600)
  )
}

export function totals(p: Progress): { levels: number; kills: number; items: number; secrets: number; time: number } {
  const t = { levels: 0, kills: 0, items: 0, secrets: 0, time: 0 }
  for (const k in p.levels) {
    const r = p.levels[k]
    t.levels++
    t.kills += r.kills
    t.items += r.items
    t.secrets += r.secrets
    t.time += r.time
  }
  return t
}

/** Furthest map finished (0 when none). */
export function furthestMap(p: Progress): number {
  let best = 0
  for (const k in p.levels) {
    const m = parseInt(k.slice(k.indexOf('M') + 1), 10)
    if (m > best) best = m
  }
  return best
}

export function formatTics(tics: number): string {
  const s = Math.floor(tics / 35)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export function sanitizeName(name: string, max = 20): string {
  return name.replace(/[^\x20-\x7e]/g, '').trim().slice(0, max)
}

// ---- savegame summary ----
// Chocolate-Doom-format save (doomgeneric): 24-byte description, 16-byte version, skill, episode, map,
// 4 playeringame flags, 3-byte big-endian leveltime, padding to 4, then player_t with 32-bit fields
// (health at 84, armour at 88, kill/item/secret counts at 256/260/264). Verified against the engine build.
export type SaveMeta = {
  description: string
  version: string
  skill: number
  episode: number
  map: number
  leveltime: number
  health: number
  armor: number
  kills: number
  items: number
  secrets: number
  bytes: number
  savedAt: number
}

export function summarizeSave(b: Uint8Array, savedAt = Date.now()): SaveMeta | null {
  if (b.length < 268) return null
  const cstr = (from: number, len: number) => {
    let s = ''
    for (let i = from; i < from + len && b[i] !== 0; i++) s += String.fromCharCode(b[i])
    return s
  }
  const i32 = (o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) | 0
  return {
    description: cstr(0, 24),
    version: cstr(24, 16),
    skill: b[40],
    episode: b[41],
    map: b[42],
    leveltime: (b[47] << 16) | (b[48] << 8) | b[49],
    health: i32(84),
    armor: i32(88),
    kills: i32(256),
    items: i32(260),
    secrets: i32(264),
    bytes: b.length,
    savedAt
  }
}
