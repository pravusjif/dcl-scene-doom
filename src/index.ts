// DOOM inside a Decentraland scene, with a multiplayer server for progress, savegames and the leaderboard.
//
// One bundle runs on both sides. The headless server (src/server) never touches the engine: it validates and
// scores level completions, stores progress and savegames, and publishes the leaderboard. The client
// (src/client) runs DOOM at the arcade cabinet and presents it through the scene UI.
//
// Messages and synced components are registered at module load (static imports), before the engine seals; the
// client module graph defines components too (react-ecs, players), so it is imported statically as well. Only
// the server module is loaded on demand, which keeps @dcl/sdk/server out of the client path.
import './shared/messages'
import './shared/schemas'

import { isServer } from '@dcl/sdk/network'

import { initClient } from './client/game'

export async function main() {
  if (isServer()) {
    const { initServer } = await import('./server/server')
    initServer()
    return
  }
  initClient()
}
