---
name: dcl-multiplayer
description: "Assists with Decentraland SDK7 multiplayer and networking when the user mentions multiplayer, syncEntity, MessageBus, state sync, networked entities, WebSocket connections, REST API calls, fetch, signedFetch, authoritative servers, player sync, or shared state."
---

# Decentraland SDK7 Multiplayer and Networking

## Sync Strategy Decision Tree

Choose the right networking approach based on what you need:

| Strategy | Use When | Persistence | Example |
|----------|----------|-------------|---------|
| `syncEntity` | Shared state that all players see and that persists for new arrivals | Yes — state survives player join/leave | Doors, switches, scoreboards, elevators |
| `MessageBus` | Ephemeral events that only matter in the moment | No — late joiners miss past messages | Chat messages, sound effects, particle triggers, notifications |
| `fetch` / REST API | Reading or writing data to an external server | Server-dependent | Leaderboards, inventory, external game state |
| `signedFetch` | Authenticated requests that prove player identity | Server-dependent | Claiming rewards, submitting verified scores |
| `WebSocket` | Real-time bidirectional communication with a server | Connection-dependent | Live game servers, real-time chat, authoritative multiplayer |

**Decision flow:**
1. Does every player need to see the same state, including late joiners? --> `syncEntity`
2. Is it a fire-and-forget event only for players currently in the scene? --> `MessageBus`
3. Do you need to talk to an external server? --> `fetch` or `signedFetch`
4. Do you need continuous real-time server communication? --> `WebSocket`
5. Combine approaches freely: use `syncEntity` for world state, `MessageBus` for effects, and `fetch` for persistence to your own backend.

---

## syncEntity Essentials

### Import and Basic Usage

```typescript
import { syncEntity } from '@dcl/sdk/network'
```

Signature: `syncEntity(entity, componentIds[], syncId?)`

- `entity` — the entity to synchronize
- `componentIds[]` — array of component IDs to keep in sync (e.g., `[Transform.componentId]`)
- `syncId` — unique numeric identifier (required for predefined entities, optional for player-spawned entities)

### Enum Sync IDs (Predefined Entities)

Every predefined synced entity MUST have a unique numeric ID. Use an enum to avoid collisions:

```typescript
enum SyncIds {
  DOOR = 1,
  ELEVATOR = 2,
  DRAWBRIDGE = 3,
  SCOREBOARD = 4
}

const door = engine.addEntity()
Transform.create(door, { position: Vector3.create(8, 1, 8) })
MeshRenderer.setBox(door)
syncEntity(door, [Transform.componentId, MeshRenderer.componentId], SyncIds.DOOR)
```

### Auto-Generated IDs (Player-Spawned Entities)

Entities created at runtime by players do not need an explicit sync ID:

```typescript
function createProjectile() {
  const projectile = engine.addEntity()
  Transform.create(projectile, { position: Vector3.create(4, 1, 4) })
  MeshRenderer.setSphere(projectile)
  syncEntity(projectile, [Transform.componentId])
  return projectile
}
```

### Syncing Multiple Components

Pass multiple component IDs to sync several properties:

```typescript
syncEntity(entity, [
  Transform.componentId,
  MeshRenderer.componentId,
  Material.componentId
], SyncIds.MY_ENTITY)
```

### Parent-Child Sync Relationships

For synced entities with parent-child relationships, use `parentEntity()` instead of setting `Transform.parent`:

```typescript
import { syncEntity, parentEntity, getParent, getChildren, removeParent } from '@dcl/sdk/network'

const parent = engine.addEntity()
const child = engine.addEntity()

syncEntity(parent, [Transform.componentId], 1)
syncEntity(child, [Transform.componentId], 2)

// Use parentEntity() — NOT Transform.parent
parentEntity(child, parent)

// Helper functions
const parentRef = getParent(child)
const childrenArray = Array.from(getChildren(parent))

// Remove parent relationship
removeParent(child)
```

### Check Sync State

Wait for synchronization before allowing interactions:

```typescript
import { isStateSyncronized } from '@dcl/sdk/network'

function gameStateSystem() {
  const isSynced = isStateSyncronized()
  if (isSynced) {
    enableGameControls()
  } else {
    disableGameControls()
    showSyncingMessage()
  }
}

engine.addSystem(gameStateSystem)
```

Note: the function is spelled `isStateSyncronized` (not "Synchronized") in the SDK.

### Updating Synced Entities

Mutate synced components normally. Changes propagate automatically:

```typescript
Transform.getMutable(interactiveEntity).position = Vector3.create(4, 1, 4)
```

---

## MessageBus Patterns

### Import and Setup

```typescript
import { MessageBus } from '@dcl/sdk/message-bus'

const sceneMessageBus = new MessageBus()
```

### Emit and Listen

```typescript
// Send a message to all players in the scene
sceneMessageBus.emit('player-action', {
  playerId: 'player123',
  action: 'jump',
  timestamp: Date.now(),
  position: Vector3.create(8, 1, 8)
})

// Listen for messages
sceneMessageBus.on('player-action', (data: PlayerAction) => {
  console.log(`Player ${data.playerId} performed ${data.action}`)
  handlePlayerAction(data)
})
```

### Typed Payloads

Define types for message data to keep code safe:

```typescript
type SpawnMessage = {
  position: { x: number; y: number; z: number }
  entityEnumId: number
}

type UpdateMessage = {
  entityId: number
  position: { x: number; y: number; z: number }
}

messageBus.emit('spawn', { position: { x: 8, y: 1, z: 8 }, entityEnumId: 1 } as SpawnMessage)

messageBus.on('spawn', (message: SpawnMessage) => {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(message.position.x, message.position.y, message.position.z)
  })
  MeshRenderer.setBox(entity)
  syncEntity(entity, [Transform.componentId], message.entityEnumId)
})
```

### syncEntity vs MessageBus

- `syncEntity`: state is persistent, late joiners get current state, automatic conflict resolution
- `MessageBus`: fire-and-forget, late joiners miss past messages, good for transient effects
- Combine both: use `syncEntity` for the door open/closed state, `MessageBus` for the sound effect when it opens

---

## REST API Calls (fetch)

### Import

```typescript
import { executeTask } from '@dcl/sdk/ecs'
```

All network calls must run inside `executeTask` because the SDK runtime does not support top-level await.

### GET Request

```typescript
executeTask(async () => {
  try {
    const response = await fetch('https://api.example.com/data')
    const json = await response.json()
    console.log('Response:', json)
  } catch (error) {
    console.error('Failed to fetch:', error)
  }
})
```

### POST Request

```typescript
executeTask(async () => {
  try {
    const response = await fetch('https://api.example.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'player123', score: 1500 })
    })
    const result = await response.json()
    console.log('Submission result:', result)
  } catch (error) {
    console.log('Submission failed:', error)
  }
})
```

### Error Handling Pattern

Always wrap fetch in try/catch inside executeTask. Check response status:

```typescript
executeTask(async () => {
  try {
    const response = await fetch('https://api.example.com/data')
    if (!response.ok) {
      console.error('HTTP error:', response.status)
      return
    }
    const data = await response.json()
    // use data
  } catch (error) {
    console.error('Network error:', error)
  }
})
```

---

## Signed Fetch (Authenticated Requests)

`signedFetch` attaches a cryptographic signature proving the player's identity. Use it when your server needs to verify who is making the request.

```typescript
import { signedFetch } from '@dcl/sdk/network'

executeTask(async () => {
  try {
    const response = await signedFetch('https://example.com/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'claimReward', amount: 100 })
    })
    const result = await response.json()
    console.log('Transaction result:', result)
  } catch (error) {
    console.log('Transaction failed:', error)
  }
})
```

Note: some examples import from `@dcl/sdk/signed-fetch`, others from `@dcl/sdk/network`. Check the SDK version. The `@dcl/sdk/network` import is the more current pattern.

---

## WebSocket Connections

### Basic Connection

```typescript
executeTask(async () => {
  const ws = new WebSocket('wss://example.com/ws')

  ws.onopen = () => {
    console.log('Connected to WebSocket')
    ws.send('Hello Server!')
  }

  ws.onmessage = (event) => {
    console.log('Received:', event.data)
  }

  ws.onerror = (error) => {
    console.error('WebSocket error:', error)
  }

  ws.onclose = () => {
    console.log('Disconnected from WebSocket')
  }
})
```

### Reconnection Logic

```typescript
executeTask(async () => {
  let ws: WebSocket | null = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 5

  function connect() {
    ws = new WebSocket('wss://example.com/ws')

    ws.onopen = () => {
      console.log('Connected')
      reconnectAttempts = 0
    }

    ws.onclose = () => {
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++
        setTimeout(connect, 1000 * reconnectAttempts) // exponential backoff
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  connect()
})
```

### Heartbeat Pattern

Send periodic pings to keep the connection alive:

```typescript
ws.onopen = () => {
  const heartbeat = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }))
    } else {
      clearInterval(heartbeat)
    }
  }, 30000)
}
```

### Message Format Convention

Use JSON with a `type` field for structured communication:

```typescript
// Send
ws.send(JSON.stringify({ type: 'playerMove', position: { x: 8, y: 1, z: 8 } }))

// Receive
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  switch (msg.type) {
    case 'gameState': handleGameState(msg); break
    case 'playerJoin': handlePlayerJoin(msg); break
    case 'playerLeave': handlePlayerLeave(msg); break
  }
}
```

---

## Multiplayer Testing

Open multiple browser windows to test multiplayer locally:

1. Use the Creator Hub Preview button multiple times (each window is a separate player)
2. Or use the URL: `decentraland://realm=http://127.0.0.1:8000&local-scene=true&debug=true`

### Track Active Players

```typescript
function multiplayerTestSystem() {
  const players = Array.from(engine.getEntitiesWith(PlayerIdentityData))
  console.log(`Active players: ${players.length}`)

  players.forEach(([entity, playerData]) => {
    const transform = Transform.getOrNull(entity)
    if (transform) {
      console.log(`Player ${playerData.address} at:`, transform.position)
    }
  })
}

engine.addSystem(multiplayerTestSystem)
```

---

## Architecture Patterns

### Optimistic Updates

Apply changes locally immediately, then let sync propagate. With `syncEntity`, local mutations are shown instantly while the SDK handles replication:

```typescript
// Player clicks a door — update locally, sync handles the rest
Transform.getMutable(door).rotation = Quaternion.fromEulerDegrees(0, 90, 0)
```

### Conflict Resolution

`syncEntity` uses last-write-wins. The most recent mutation from any player becomes the authoritative state. For cases requiring stricter control, use an authoritative server via WebSocket.

### Authority Model

- **Decentralized (syncEntity):** Any player can mutate synced components. Good for simple shared objects.
- **Authoritative server (WebSocket):** Server validates and broadcasts state. Use for competitive games, economies, or anti-cheat.
- **Hybrid:** Use `syncEntity` for world objects, WebSocket for game logic validation.

### Single Player Mode (Worlds)

For Decentraland Worlds that do not need multiplayer, set the scene.json adapter to offline:

```json
{
  "worldConfiguration": {
    "name": "my-world.dcl.eth",
    "fixedAdapter": "offline:offline"
  }
}
```

No `syncEntity` or `MessageBus` needed in offline mode.

---

## Common Recipes

### Synced Door

```typescript
import { syncEntity } from '@dcl/sdk/network'

enum SyncIds { DOOR = 1 }

const door = engine.addEntity()
Transform.create(door, { position: Vector3.create(8, 1, 8) })
MeshRenderer.setBox(door)
syncEntity(door, [Transform.componentId], SyncIds.DOOR)

let doorOpen = false
pointerEventsSystem.onPointerDown(
  { entity: door, opts: { button: InputAction.IA_POINTER, hoverText: 'Toggle Door' } },
  () => {
    doorOpen = !doorOpen
    Transform.getMutable(door).rotation = doorOpen
      ? Quaternion.fromEulerDegrees(0, 90, 0)
      : Quaternion.fromEulerDegrees(0, 0, 0)
  }
)
```

### Shared Scoreboard (syncEntity + MessageBus)

```typescript
import { syncEntity } from '@dcl/sdk/network'
import { MessageBus } from '@dcl/sdk/message-bus'

const bus = new MessageBus()

enum SyncIds { SCOREBOARD = 10 }

const scoreboard = engine.addEntity()
Transform.create(scoreboard, { position: Vector3.create(8, 2, 8) })
TextShape.create(scoreboard, { text: 'Score: 0' })
syncEntity(scoreboard, [TextShape.componentId], SyncIds.SCOREBOARD)

bus.on('score-update', (data: { score: number }) => {
  TextShape.getMutable(scoreboard).text = `Score: ${data.score}`
})

// Call from game logic:
// bus.emit('score-update', { score: newScore })
```

### Chat System (MessageBus)

```typescript
import { MessageBus } from '@dcl/sdk/message-bus'

const bus = new MessageBus()

type ChatMessage = { sender: string; text: string; timestamp: number }

bus.on('chat', (msg: ChatMessage) => {
  console.log(`[${msg.sender}]: ${msg.text}`)
  // Update UI with message
})

function sendChat(text: string, playerName: string) {
  bus.emit('chat', { sender: playerName, text, timestamp: Date.now() })
}
```

### Multiplayer Game State (Combined)

```typescript
import { syncEntity } from '@dcl/sdk/network'
import { MessageBus } from '@dcl/sdk/message-bus'

const bus = new MessageBus()

// Sync the interactive cube — persistent state
const cube = engine.addEntity()
Transform.create(cube, { position: Vector3.create(8, 1, 8) })
MeshRenderer.setBox(cube)
Material.setPbrMaterial(cube, { albedoColor: Color4.Blue() })
syncEntity(cube, [Transform.componentId, Material.componentId], 100)

// Use MessageBus for ephemeral color-change events
pointerEventsSystem.onPointerDown(
  { entity: cube, opts: { button: InputAction.IA_POINTER, hoverText: 'Change Color' } },
  () => {
    const newColor = Color4.create(Math.random(), Math.random(), Math.random(), 1)
    bus.emit('cube-color-change', { cubeId: 100, color: newColor })
  }
)

bus.on('cube-color-change', (data: any) => {
  Material.getMutable(cube).albedoColor = data.color
})
```

---

## Reference Files

- `references/networking-sync.md` — Full API reference and code examples for syncEntity, MessageBus, fetch, signedFetch, and WebSocket
