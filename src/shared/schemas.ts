// Synced components written by the server only (the validators are registered in server.ts).
import { engine, Schemas } from '@dcl/sdk/ecs'

export const LEADERBOARD_SIZE = 10

export const LeaderboardEntrySchema = Schemas.Map({
  address: Schemas.String,
  name: Schemas.String,
  score: Schemas.Int,
  levels: Schemas.Int,
  kills: Schemas.Int,
  secrets: Schemas.Int,
  /** Sum of the best level times, in tics. */
  time: Schemas.Int
})

export const Leaderboard = engine.defineComponent('doom:Leaderboard', {
  entries: Schemas.Array(LeaderboardEntrySchema),
  updatedAt: Schemas.Int64
})

/** The server writes Date.now() here every HEARTBEAT_S; clients treat it as alive while the value keeps changing. */
export const ServerHeartbeat = engine.defineComponent('doom:Heartbeat', { at: Schemas.Int64 })
export const HEARTBEAT_S = 2

/** Fixed sync ids for the singleton entities. */
export const SyncId = { Leaderboard: 1, Heartbeat: 2 } as const

export type LeaderboardEntry = {
  address: string
  name: string
  score: number
  levels: number
  kills: number
  secrets: number
  time: number
}
