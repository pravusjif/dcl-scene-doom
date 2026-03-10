# Decentraland SDK7 Networking and Sync Reference

Extracted from sdk7-complete-reference.md and sdk7-examples.mdc.

---

## syncEntity API

### Import

```typescript
import { syncEntity } from '@dcl/sdk/network'
```

### Signature

```typescript
syncEntity(entity: Entity, componentIds: number[], syncId?: number): void
```

- `entity` — the ECS entity to synchronize across all players
- `componentIds` — array of component IDs to sync (e.g., `[Transform.componentId, MeshRenderer.componentId]`)
- `syncId` — unique numeric ID for predefined entities; omit for player-spawned entities (auto-assigned)

### Predefined Entity Sync (Explicit IDs)

Use an enum to manage unique sync IDs and avoid collisions:

```typescript
import { syncEntity } from '@dcl/sdk/network'
import { engine, Transform, MeshRenderer } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

enum EntityIds {
  DOOR = 1,
  ELEVATOR = 2,
  DRAWBRIDGE = 3
}

const door = engine.addEntity()
Transform.create(door, { position: Vector3.create(8, 1, 8) })
MeshRenderer.setBox(door)
syncEntity(door, [Transform.componentId, MeshRenderer.componentId], EntityIds.DOOR)
```

### Player-Spawned Entity Sync (Auto IDs)

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

```typescript
const complexEntity = engine.addEntity()
Transform.create(complexEntity, { position: Vector3.create(5, 1, 5) })
MeshRenderer.setBox(complexEntity)

syncEntity(complexEntity, [
  Transform.componentId,
  MeshRenderer.componentId
], 2)
```

### Updating Synced Entities

Mutate synced components directly. Changes propagate automatically:

```typescript
Transform.getMutable(interactiveEntity).position = Vector3.create(4, 1, 4)
```

### Interactive Synced Entity

```typescript
const interactiveEntity = engine.addEntity()
Transform.create(interactiveEntity, { position: Vector3.create(3, 1, 3) })
MeshRenderer.setBox(interactiveEntity)
syncEntity(interactiveEntity, [Transform.componentId], 3)

// Any mutation is automatically synced
Transform.getMutable(interactiveEntity).position = Vector3.create(4, 1, 4)
```

---

## Parent-Child Relationships in Multiplayer

### Import

```typescript
import { syncEntity, parentEntity, getParent, getChildren, removeParent } from '@dcl/sdk/network'
```

### Usage

Both parent and child entities must be synced. Use `parentEntity()` instead of `Transform.parent`:

```typescript
const parent = engine.addEntity()
const child = engine.addEntity()

syncEntity(parent, [Transform.componentId], 1)
syncEntity(child, [Transform.componentId], 2)

// Establish parent-child relationship
parentEntity(child, parent)

// Query relationships
const parentRef = getParent(child)           // Returns parent entity
const childrenArray = Array.from(getChildren(parent))  // Returns [child]

// Remove parent relationship (child becomes child of root)
removeParent(child)
```

---

## Check Sync State

### Import

```typescript
import { isStateSyncronized } from '@dcl/sdk/network'
```

Note: the function is spelled `isStateSyncronized` (not "Synchronized") in the SDK.

### Usage

```typescript
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

---

## MessageBus API

### Import

```typescript
import { MessageBus } from '@dcl/sdk/message-bus'
```

### Create Instance

```typescript
const sceneMessageBus = new MessageBus()
```

### Emit Messages

```typescript
sceneMessageBus.emit('player-action', {
  playerId: 'player123',
  action: 'jump',
  timestamp: Date.now(),
  position: Vector3.create(8, 1, 8)
})
```

### Listen for Messages

```typescript
type PlayerAction = {
  playerId: string
  action: string
  timestamp: number
  position: Vector3
}

sceneMessageBus.on('player-action', (data: PlayerAction) => {
  console.log(`Player ${data.playerId} performed ${data.action}`)
  handlePlayerAction(data)
})
```

### Typed Message Patterns

```typescript
type SpawnMessage = {
  position: { x: number; y: number; z: number }
  entityEnumId: number
}

type UpdateMessage = {
  entityId: number
  position: { x: number; y: number; z: number }
}

// Emit typed message
messageBus.emit('spawn', {
  position: { x: 8, y: 1, z: 8 },
  entityEnumId: 1
} as SpawnMessage)

// Listen with type
messageBus.on('spawn', (message: SpawnMessage) => {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(
      message.position.x,
      message.position.y,
      message.position.z
    )
  })
  MeshRenderer.setBox(entity)
  syncEntity(entity, [Transform.componentId], message.entityEnumId)
})

// Update messages
messageBus.emit('update', {
  entityId: 1,
  position: { x: 10, y: 1, z: 10 }
} as UpdateMessage)

messageBus.on('update', (message: UpdateMessage) => {
  const entity = engine.getEntityById(message.entityId)
  if (entity) {
    Transform.getMutable(entity).position = Vector3.create(
      message.position.x,
      message.position.y,
      message.position.z
    )
  }
})
```

### Interaction Broadcast

```typescript
function handlePlayerInteraction(entity: Entity) {
  messageBus.emit('interaction', {
    entityId: entity,
    action: 'click',
    timestamp: Date.now()
  })
}

messageBus.on('interaction', (message) => {
  console.log(`Entity ${message.entityId} was ${message.action}ed at ${message.timestamp}`)
})
```

### Combined syncEntity + MessageBus Example

```typescript
import { syncEntity } from '@dcl/sdk/network'
import { MessageBus } from '@dcl/sdk/message-bus'

const sceneMessageBus = new MessageBus()

function createMultiplayerCube() {
  const cube = engine.addEntity()
  Transform.create(cube, { position: Vector3.create(8, 1, 8) })
  MeshRenderer.setBox(cube)
  Material.setPbrMaterial(cube, { albedoColor: Color4.Blue() })

  syncEntity(cube, [Transform.componentId, Material.componentId], 100)

  pointerEventsSystem.onPointerDown(
    {
      entity: cube,
      opts: { button: InputAction.IA_POINTER, hoverText: 'Change Color' }
    },
    () => {
      const newColor = Color4.create(Math.random(), Math.random(), Math.random(), 1)
      sceneMessageBus.emit('cube-color-change', {
        cubeId: 100,
        color: newColor,
        timestamp: Date.now()
      })
    }
  )
}

sceneMessageBus.on('cube-color-change', (data: any) => {
  for (const [entity] of engine.getEntitiesWith(Transform, Material)) {
    const material = Material.getMutable(entity)
    material.albedoColor = data.color
  }
})
```

---

## fetch (REST API Calls)

### Import

```typescript
import { executeTask } from '@dcl/sdk/ecs'
```

All network calls must be wrapped in `executeTask`.

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
    const response = await fetch('https://api.example.com/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: 'value'
      })
    })
    const json = await response.json()
    console.log('Response:', json)
  } catch (error) {
    console.error('Failed to fetch:', error)
  }
})
```

### POST with Game Data

```typescript
executeTask(async () => {
  try {
    const response = await fetch('https://api.example.com/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'player123',
        score: 1500
      })
    })
    const result = await response.json()
    console.log('Submission result:', result)
  } catch (error) {
    console.log('Submission failed:', error)
  }
})
```

---

## signedFetch (Authenticated Requests)

### Import

```typescript
import { signedFetch } from '@dcl/sdk/network'
```

`signedFetch` works like `fetch` but attaches a cryptographic signature that proves the player's Decentraland identity to the server.

### Signed GET

```typescript
executeTask(async () => {
  try {
    const response = await signedFetch('https://api.example.com/data')
    const json = await response.json()
    console.log('Response:', json)
  } catch (error) {
    console.error('Failed to fetch:', error)
  }
})
```

### Signed POST

```typescript
executeTask(async () => {
  try {
    const response = await signedFetch('https://api.example.com/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: 'value'
      })
    })
    const json = await response.json()
    console.log('Response:', json)
  } catch (error) {
    console.error('Failed to fetch:', error)
  }
})
```

### Signed Action (Reward Claim)

```typescript
executeTask(async () => {
  try {
    const response = await signedFetch('https://example.com/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'claimReward',
        amount: 100
      })
    })
    const result = await response.json()
    console.log('Transaction result:', result)
  } catch (error) {
    console.log('Transaction failed:', error)
  }
})
```

---

## WebSocket Connections

### Basic Connection

```typescript
import { executeTask } from '@dcl/sdk/ecs'

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

### WebSocket with Reconnection Logic

```typescript
executeTask(async () => {
  let ws: WebSocket | null = null
  let reconnectAttempts = 0
  const maxReconnectAttempts = 5

  function connect() {
    ws = new WebSocket('wss://example.com/ws')

    ws.onopen = () => {
      console.log('Connected to WebSocket')
      reconnectAttempts = 0
      ws?.send('Hello Server!')
    }

    ws.onmessage = (event) => {
      console.log('Received:', event.data)
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('Disconnected from WebSocket')
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++
        setTimeout(connect, 1000 * reconnectAttempts)
      }
    }
  }

  connect()
})
```

---

## Multiplayer Testing

### Local Testing

Open multiple browser windows to test multiplayer:
1. Use the Creator Hub Preview button multiple times
2. Or use URL: `decentraland://realm=http://127.0.0.1:8000&local-scene=true&debug=true`

### Track Active Players

```typescript
function multiplayerTestSystem() {
  const players = Array.from(engine.getEntitiesWith(PlayerIdentityData))
  console.log(`Active players: ${players.length}`)

  players.forEach(([entity, playerData]) => {
    const transform = Transform.getOrNull(entity)
    if (transform) {
      console.log(`Player ${playerData.address} at position:`, transform.position)
    }
  })
}

engine.addSystem(multiplayerTestSystem)
```

---

## Single Player Mode (Worlds)

Configure `scene.json` for offline mode:

```json
{
  "worldConfiguration": {
    "name": "my-world.dcl.eth",
    "fixedAdapter": "offline:offline"
  }
}
```

In offline mode, players do not see each other. No `syncEntity` or `MessageBus` is needed:

```typescript
function singlePlayerScene() {
  const entity = engine.addEntity()
  Transform.create(entity, { position: Vector3.create(8, 1, 8) })
  MeshRenderer.setBox(entity)

  pointerEventsSystem.onPointerDown(
    { entity, opts: { button: InputAction.IA_POINTER } },
    () => {
      const transform = Transform.getMutable(entity)
      transform.position.y += 1
    }
  )
}
```
