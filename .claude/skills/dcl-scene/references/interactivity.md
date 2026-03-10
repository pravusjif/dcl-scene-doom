# Interactivity

## Pointer Events

### Declarative Component

```typescript
import { PointerEvents, PointerEventType, InputAction } from '@dcl/sdk/ecs'

PointerEvents.create(entity, {
  pointerEvents: [
    {
      eventType: PointerEventType.PET_DOWN,
      eventInfo: {
        button: InputAction.IA_POINTER,
        hoverText: 'Click me',
        showFeedback: true,
        maxDistance: 10
      }
    }
  ]
})
```

### Callback System

```typescript
import { pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'

// Simple click handler
pointerEventsSystem.onPointerDown(
  {
    entity: myEntity,
    opts: { button: InputAction.IA_POINTER, hoverText: 'Click me!', maxDistance: 10 }
  },
  (event) => {
    console.log('Entity clicked!', event.hit.position)
  }
)

// Multiple button support
pointerEventsSystem.onPointerDown(
  { entity: myEntity, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Press E' } },
  () => console.log('E key pressed!')
)

pointerEventsSystem.onPointerDown(
  { entity: myEntity, opts: { button: InputAction.IA_SECONDARY, hoverText: 'Press F' } },
  () => console.log('F key pressed!')
)
```

**Important**: Entity must have a collider for pointer events to work. Use `MeshCollider.setBox(entity, ColliderLayer.CL_POINTER)` or set `visibleMeshesCollisionMask` on `GltfContainer`.

### Available Input Actions

```typescript
InputAction.IA_POINTER    // Left mouse button
InputAction.IA_PRIMARY    // E key
InputAction.IA_SECONDARY  // F key
InputAction.IA_ACTION_3   // 1 key
InputAction.IA_ACTION_4   // 2 key
InputAction.IA_ACTION_5   // 3 key
InputAction.IA_ACTION_6   // 4 key
InputAction.IA_JUMP       // Space key
InputAction.IA_FORWARD    // W key
InputAction.IA_BACKWARD   // S key
InputAction.IA_LEFT       // A key
InputAction.IA_RIGHT      // D key
InputAction.IA_WALK       // Shift key
```

### Event Types

```typescript
PointerEventType.PET_DOWN         // Button pressed
PointerEventType.PET_UP           // Button released
PointerEventType.PET_HOVER_ENTER  // Cursor enters entity
PointerEventType.PET_HOVER_LEAVE  // Cursor leaves entity
```

## Input System (Global / System-Based)

```typescript
import { inputSystem, InputAction, PointerEventType } from '@dcl/sdk/ecs'

function myInputSystem(dt: number) {
  // Check if a button is currently held
  if (inputSystem.isPressed(InputAction.IA_FORWARD)) {
    // W key is being held
  }

  // Check for single press this frame
  if (inputSystem.isTriggered(InputAction.IA_JUMP, PointerEventType.PET_DOWN)) {
    // Space bar just pressed
  }

  // Check for key release
  if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_UP)) {
    // E key just released
  }

  // Entity-specific input command
  const clickData = inputSystem.getInputCommand(
    InputAction.IA_POINTER,
    PointerEventType.PET_DOWN,
    myEntity
  )
  if (clickData) {
    console.log('Entity clicked via system:', clickData.hit.entityId)
  }
}

engine.addSystem(myInputSystem)
```

## Proximity Interactions

Configure on PointerEvents to respond to player proximity rather than clicks:

- `onProximityEnter` -- fires when player enters range
- `onProximityLeave` -- fires when player exits range
- `onProximityDown` -- fires when player presses button while in range

These use the same PointerEvents component but with proximity-based triggers.

## Raycasting

### Callback-Based Raycasting

```typescript
import { raycastSystem, RaycastQueryType } from '@dcl/sdk/ecs'

// Local direction raycast (relative to entity rotation)
raycastSystem.registerLocalDirectionRaycast(
  {
    entity: myEntity,
    opts: {
      direction: Vector3.Forward(),
      maxDistance: 10,
      queryType: RaycastQueryType.RQT_HIT_FIRST
    }
  },
  (result) => {
    if (result.hits.length > 0) {
      console.log('Hit entity:', result.hits[0].entityId)
      console.log('Hit position:', result.hits[0].position)
    }
  }
)

// Global direction raycast (ignores entity rotation)
raycastSystem.registerGlobalDirectionRaycast(
  {
    entity: myEntity,
    opts: {
      direction: Vector3.Down(),
      maxDistance: 5,
      queryType: RaycastQueryType.RQT_QUERY_ALL
    }
  },
  (result) => { console.log('All hits:', result.hits) }
)

// Target position raycast
raycastSystem.registerGlobalTargetRaycast(
  {
    entity: myEntity,
    opts: { globalTarget: Vector3.create(8, 0, 8), maxDistance: 20 }
  },
  (result) => { /* handle result */ }
)

// Target entity raycast
raycastSystem.registerTargetEntityRaycast(
  {
    entity: sourceEntity,
    opts: { targetEntity: targetEntity, maxDistance: 15 }
  },
  (result) => { /* handle result */ }
)
```

### Component-Based Raycasting

```typescript
import { Raycast, RaycastResult, RaycastQueryType } from '@dcl/sdk/ecs'

// One-shot raycast
Raycast.create(entity, {
  direction: { $case: 'localDirection', localDirection: Vector3.Forward() },
  maxDistance: 16,
  queryType: RaycastQueryType.RQT_HIT_FIRST,
  originOffset: Vector3.create(0, 0.5, 0),
  continuous: false
})

// Continuous raycast (every frame)
Raycast.create(entity, {
  direction: { $case: 'localDirection', localDirection: Vector3.Forward() },
  maxDistance: 16,
  queryType: RaycastQueryType.RQT_HIT_FIRST,
  originOffset: Vector3.create(0.5, 0, 0),
  continuous: true
})

// Read results in system
engine.addSystem(() => {
  for (const [entity, result] of engine.getEntitiesWith(RaycastResult)) {
    for (const hit of result.hits) {
      console.log(`Hit entity: ${hit.entityId} at ${hit.position}, distance: ${hit.length}`)
    }
  }
})

// Remove continuous raycast
raycastSystem.removeRaycasterEntity(myEntity)
```

### Direction Types
- `{ $case: 'globalDirection', globalDirection: Vector3.Down() }` -- world-space direction
- `{ $case: 'localDirection', localDirection: Vector3.Forward() }` -- entity-relative
- `{ $case: 'globalTarget', globalTarget: Vector3.create(10, 0, 10) }` -- aim at world position
- `{ $case: 'targetEntity', targetEntity: entityId }` -- aim at another entity

### Raycast from Camera

```typescript
raycastSystem.registerGlobalDirectionRaycast(
  {
    entity: engine.CameraEntity,
    opts: {
      direction: Vector3.rotate(Vector3.Forward(), Transform.get(engine.CameraEntity).rotation),
      maxDistance: 16
    }
  },
  (result) => {
    if (result.hits.length > 0) console.log('Looking at:', result.hits[0].entityId)
  }
)
```

### Raycast Options

```typescript
{
  direction: Vector3.Forward(),
  maxDistance: 16,
  queryType: RaycastQueryType.RQT_HIT_FIRST,  // or RQT_QUERY_ALL
  originOffset: Vector3.create(0, 0.5, 0),
  collisionMask: ColliderLayer.CL_PHYSICS | ColliderLayer.CL_CUSTOM1,
  continuous: false
}
```

## Trigger Areas (Native)

Detect when the player or any entity enters, stays in, or exits a shaped area. Size the area via `Transform.scale`.

```typescript
import { engine, Transform, TriggerArea, triggerAreaEventsSystem, ColliderLayer, MeshCollider } from '@dcl/sdk/ecs'

// Create a box trigger at (8,0,8), size 4x2x4
const area = engine.addEntity()
TriggerArea.setBox(area)  // or TriggerArea.setSphere(area)
Transform.create(area, { position: Vector3.create(8, 0, 8), scale: Vector3.create(4, 2, 4) })

// Events
triggerAreaEventsSystem.onTriggerEnter(area, (e) => {
  console.log('Enter by entity', e.trigger.entity)
})
triggerAreaEventsSystem.onTriggerExit(area, () => {
  console.log('Exit')
})
triggerAreaEventsSystem.onTriggerStay(area, () => {
  // Called every frame while inside
})

// Restrict which entities activate the area
TriggerArea.setBox(area, ColliderLayer.CL_CUSTOM1 | ColliderLayer.CL_CUSTOM2)

// Mark a moving entity to activate the area
const mover = engine.addEntity()
Transform.create(mover, { position: Vector3.create(8, 0, 8) })
MeshCollider.setBox(mover, ColliderLayer.CL_CUSTOM1)
```

Callback parameter fields: `triggeredEntity`, `eventType` (ENTER/EXIT/STAY), `trigger.entity`, `trigger.layer`, `trigger.position`, `trigger.rotation`, `trigger.scale`.

## Avatar Modifier Areas

```typescript
import { AvatarModifierArea, AvatarModifierType } from '@dcl/sdk/ecs'

AvatarModifierArea.create(entity, {
  area: { box: Vector3.create(4, 3, 4) },
  modifiers: [AvatarModifierType.AMT_HIDE_AVATARS],
  excludeIds: ['0x123...abc']  // Optional
})

// Modifiers: AMT_HIDE_AVATARS, AMT_DISABLE_PASSPORTS, AMT_DISABLE_JUMPING
```

## Cursor State

```typescript
// Check if cursor is locked
const isLocked = PointerLock.get(engine.CameraEntity).isPointerLocked

// Get cursor position
const pointerInfo = PrimaryPointerInfo.get(engine.RootEntity)
console.log('Cursor position:', pointerInfo.screenCoordinates)
console.log('World ray direction:', pointerInfo.worldRayDirection)
```
