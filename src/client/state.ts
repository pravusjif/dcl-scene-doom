// Client-side state shared by the game system, the network layer, the UI and the in-world signs. Plain data.
import { Progress } from '../shared/progress'
import { LeaderboardEntry } from '../shared/schemas'

export type TransferKind = 'idle' | 'saving' | 'loading'

export const client = {
  /** Room transport synced (isStateSyncronized). */
  synced: false,
  /** Server heartbeat observed changing recently. */
  serverAlive: false,
  /** My display name (from the avatar profile), sent with hello. */
  name: '',
  /** My stored progress, as last sent by the server; null until the server answers. */
  progress: null as Progress | null,
  leaderboard: [] as LeaderboardEntry[],
  /** Savegame transfer in flight, for the loading bar. */
  transfer: { kind: 'idle' as TransferKind, done: 0, total: 0 },
  /** Last save/load outcome, shown next to the buttons. */
  message: '',
  /** The delete button has been pressed once; the row shows the confirmation. */
  confirmDelete: false,
  /** Live values read from the engine every tick while playing. */
  live: {
    inLevel: false,
    episode: 0,
    map: 0,
    skill: 0,
    kills: 0,
    maxKills: 0,
    items: 0,
    maxItems: 0,
    secrets: 0,
    maxSecrets: 0,
    time: 0,
    health: 0,
    /** In a level with the game running: a save is possible. */
    canSave: false
  },
  /** Wired by the game module; the UI buttons call these. */
  actions: {
    save: () => {},
    load: () => {},
    deleteRecord: () => {}
  }
}
