# Patterns & Systems

## Async Functions (executeTask)

```typescript
import { executeTask } from '@dcl/sdk/ecs'

executeTask(async () => {
  try {
    const data = await fetch('https://api.example.com/data')
    const result = await data.json()
    updateSceneWithData(result)
  } catch (error) {
    console.log('Async operation failed:', error)
  }
})
```

## Timers and Delays

```typescript
// Using executeTask
executeTask(async () => {
  await new Promise(resolve => setTimeout(resolve, 2000))
  console.log('Delayed action')
})

// Using @dcl-sdk/utils (preferred)
import * as utils from '@dcl-sdk/utils'

utils.timers.setTimeout(() => console.log('After 2s'), 2000)
const intervalId = utils.timers.setInterval(() => console.log('Every 1s'), 1000)
utils.timers.clearInterval(intervalId)
```

## State Machines

```typescript
enum NPCState {
  IDLE = 'idle',
  WALKING = 'walking',
  ATTACKING = 'attacking',
  DEAD = 'dead'
}

const NPCStateMachine = engine.defineComponent('NPCStateMachine', {
  currentState: Schemas.EnumString(NPCState, NPCState.IDLE),
  stateTimer: Schemas.Number
})

function npcStateMachineSystem(dt: number) {
  for (const [entity, stateMachine] of engine.getEntitiesWith(NPCStateMachine)) {
    const state = NPCStateMachine.getMutable(entity)
    state.stateTimer += dt

    switch (state.currentState) {
      case NPCState.IDLE:
        if (state.stateTimer > 3) {
          state.currentState = NPCState.WALKING
          state.stateTimer = 0
        }
        break

      case NPCState.WALKING:
        if (state.stateTimer > 5) {
          state.currentState = NPCState.IDLE
          state.stateTimer = 0
        }
        break
    }
  }
}

engine.addSystem(npcStateMachineSystem)
```

## Object Pool

```typescript
class ProjectilePool {
  private pool: Entity[] = []
  private active: Entity[] = []

  getProjectile(): Entity {
    if (this.pool.length > 0) {
      const p = this.pool.pop()!
      this.active.push(p)
      return p
    }
    return this.createProjectile()
  }

  releaseProjectile(p: Entity) {
    const idx = this.active.indexOf(p)
    if (idx > -1) {
      this.active.splice(idx, 1)
      this.pool.push(p)
      Transform.getMutable(p).position = Vector3.create(0, -100, 0)
    }
  }

  private createProjectile(): Entity {
    const p = engine.addEntity()
    MeshRenderer.setSphere(p)
    Material.setPbrMaterial(p, { albedoColor: Color4.Yellow() })
    this.active.push(p)
    return p
  }
}
```

## Game Object Pattern

```typescript
class GameObject {
  entity: Entity

  constructor(position: Vector3) {
    this.entity = engine.addEntity()
    Transform.create(this.entity, { position })
  }

  setPosition(position: Vector3) {
    Transform.getMutable(this.entity).position = position
  }

  getPosition(): Vector3 {
    return Transform.get(this.entity).position
  }

  destroy() {
    engine.removeEntity(this.entity)
  }
}

class Enemy extends GameObject {
  health: number = 100

  constructor(position: Vector3) {
    super(position)
    MeshRenderer.setBox(this.entity)
    Material.setPbrMaterial(this.entity, { albedoColor: Color4.Red() })
  }

  takeDamage(amount: number) {
    this.health -= amount
    if (this.health <= 0) this.destroy()
  }
}
```

## Component Factory

```typescript
function createProjectile(start: Vector3, direction: Vector3, speed: number): Entity {
  const p = engine.addEntity()
  Transform.create(p, { position: start, scale: Vector3.create(0.1, 0.1, 0.1) })
  MeshRenderer.setSphere(p)
  Material.setPbrMaterial(p, { albedoColor: Color4.Yellow(), emissiveColor: Color4.Yellow() })
  Movement.create(p, { velocity: Vector3.normalize(direction), speed })
  return p
}
```

## Entity Factory

```typescript
class EntityFactory {
  static createPlayer(position: Vector3): Entity {
    const e = engine.addEntity()
    Transform.create(e, { position })
    MeshRenderer.setBox(e)
    Material.setPbrMaterial(e, { albedoColor: Color4.Blue() })
    return e
  }

  static createPickup(position: Vector3, type: string): Entity {
    const e = engine.addEntity()
    Transform.create(e, { position })
    MeshRenderer.setSphere(e)
    Pickup.create(e, { type })
    return e
  }
}
```

## Component Composition

```typescript
const Health = engine.defineComponent('Health', {
  current: Schemas.Number,
  max: Schemas.Number
})

const Movement = engine.defineComponent('Movement', {
  speed: Schemas.Number,
  direction: Schemas.Vector3
})

const AI = engine.defineComponent('AI', {
  state: Schemas.String,
  target: Schemas.Entity
})

// Different entity types by combining components
function createPlayer(pos: Vector3) {
  const e = engine.addEntity()
  Transform.create(e, { position: pos })
  Health.create(e, { current: 100, max: 100 })
  Movement.create(e, { speed: 5, direction: Vector3.Zero() })
}

function createEnemy(pos: Vector3) {
  const e = engine.addEntity()
  Transform.create(e, { position: pos })
  Health.create(e, { current: 50, max: 50 })
  Movement.create(e, { speed: 2, direction: Vector3.Zero() })
  AI.create(e, { state: 'patrol', target: 0 as Entity })
}
```

## Error Handling

```typescript
function safeGetTransform(entity: Entity): Vector3 | null {
  try {
    if (Transform.has(entity)) {
      return Transform.get(entity).position
    }
    return null
  } catch (error) {
    console.log('Error getting transform:', error)
    return null
  }
}
```

## Multiplayer Sync

```typescript
import { syncEntity } from '@dcl/sdk/network'

enum EntityIds { DOOR = 1, ELEVATOR = 2 }

const door = engine.addEntity()
Transform.create(door, { position: Vector3.create(8, 1, 8) })
syncEntity(door, [Transform.componentId, MeshRenderer.componentId], EntityIds.DOOR)

// Player-created entities (auto-assigned ID)
function createProjectile() {
  const p = engine.addEntity()
  Transform.create(p, { position: Vector3.create(4, 1, 4) })
  syncEntity(p, [Transform.componentId])
  return p
}
```

### Message Bus

```typescript
import { MessageBus } from '@dcl/sdk/message-bus'

const sceneMessageBus = new MessageBus()

sceneMessageBus.emit('player-action', { playerId: '...', action: 'jump' })

sceneMessageBus.on('player-action', (data) => {
  console.log(`Player ${data.playerId} performed ${data.action}`)
})
```

## Combine Scene Editor with Code

```typescript
import { EntityNames } from '../assets/scene/entity-names'

export function main() {
  const door = engine.getEntityOrNullByName(EntityNames.Door_1)
  if (door) {
    pointerEventsSystem.onPointerDown(
      { entity: door, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Open' } },
      () => { /* custom logic */ }
    )
  }
}
```

### Tags

```typescript
import { Tags } from '@dcl/sdk/ecs'

Tags.add(entity, 'myTag')
const tagged = engine.getEntitiesByTag('myTag')
```

### Smart Item Events

```typescript
import { getTriggerEvents, getActionEvents } from '@dcl/asset-packs/dist/events'
import { TriggerType } from '@dcl/asset-packs'

const buttonTriggers = getTriggerEvents(buttonEntity)
const doorActions = getActionEvents(doorEntity)

buttonTriggers.on(TriggerType.ON_INPUT_ACTION, () => {
  doorActions.emit('Open', {})
})
```
