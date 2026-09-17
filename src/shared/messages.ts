// Client <-> server messages (multiplayer server, @dcl/sdk auth-server branch).
//
// Imported statically from index.ts so registerMessages runs at module load, before the engine seals.
// Room messages are dropped silently above ~13 KB, so savegames travel as base64 chunks of CHUNK_CHARS.
import { Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'

export const CHUNK_CHARS = 8000

export const Messages = {
  // ---- client -> server ----
  /** Sent once the room is synced: registers the display name and asks for the stored progress. */
  hello: Schemas.Map({ name: Schemas.String }),
  /** The intermission statistics of a level the player just finished (times in tics, 35 per second). */
  levelDone: Schemas.Map({
    episode: Schemas.Int,
    map: Schemas.Int,
    skill: Schemas.Int,
    kills: Schemas.Int,
    maxKills: Schemas.Int,
    items: Schemas.Int,
    maxItems: Schemas.Int,
    secrets: Schemas.Int,
    maxSecrets: Schemas.Int,
    time: Schemas.Int,
    par: Schemas.Int
  }),
  /** One base64 chunk of a savegame; `meta` (JSON SaveMeta) travels with the last chunk only. */
  saveChunk: Schemas.Map({
    slot: Schemas.Int,
    index: Schemas.Int,
    total: Schemas.Int,
    data: Schemas.String,
    meta: Schemas.String
  }),
  loadRequest: Schemas.Map({ slot: Schemas.Int }),
  /** Wipe the sender's progress, savegame and leaderboard row. */
  deleteRecord: Schemas.Map({ confirm: Schemas.Boolean }),

  // ---- server -> client (always addressed to one player) ----
  /** The player's Progress record as JSON. */
  progress: Schemas.Map({ json: Schemas.String }),
  saveResult: Schemas.Map({ slot: Schemas.Int, ok: Schemas.Boolean, error: Schemas.String }),
  loadChunk: Schemas.Map({ slot: Schemas.Int, index: Schemas.Int, total: Schemas.Int, data: Schemas.String }),
  loadResult: Schemas.Map({ slot: Schemas.Int, ok: Schemas.Boolean, error: Schemas.String }),
  deleteResult: Schemas.Map({ ok: Schemas.Boolean, error: Schemas.String })
}

export const room = registerMessages(Messages)

/** Split a base64 string into message-sized chunks. */
export function chunk(data: string): string[] {
  const parts: string[] = []
  for (let i = 0; i < data.length; i += CHUNK_CHARS) parts.push(data.slice(i, i + CHUNK_CHARS))
  if (parts.length === 0) parts.push('')
  return parts
}
