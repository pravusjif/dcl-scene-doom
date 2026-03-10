# ECS Architecture

Decentraland SDK7 uses an Entity-Component-System architecture. Entities are numeric IDs, components store data, and systems contain per-frame logic.

## Entities

```typescript
import { engine } from '@dcl/sdk/ecs'

// Create entity
const myEntity = engine.addEntity()

// Remove entity
engine.removeEntity(myEntity)

// Remove entity with children
removeEntityWithChildren(engine, myEntity)

// Get entity by name (from Scene Editor)
const door = engine.getEntityOrNullByName('door-1')
```

### Reserved Entities
- `engine.PlayerEntity` -- the local player's avatar
- `engine.CameraEntity` -- the local player's camera
- `engine.RootEntity` -- the scene root

## Components

Components store data about entities. Every built-in component follows the same API:

```typescript
// Create component on entity
Transform.create(myEntity, {
  position: Vector3.create(5, 1, 5)
})

// Get component (read-only)
const transform = Transform.get(myEntity)

// Get mutable component (allows writes)
const mutableTransform = Transform.getMutable(myEntity)
mutableTransform.position.x = 10

// Check if component exists
const hasTransform = Transform.has(myEntity)

// Remove component
Transform.deleteFrom(myEntity)

// Create or replace (upsert)
Transform.createOrReplace(myEntity, {
  position: Vector3.create(3, 1, 3)
})
```

## Systems

Systems contain logic that runs every frame. The function receives `dt` (delta time in seconds since last frame).

```typescript
function mySystem(dt: number) {
  for (const [entity] of engine.getEntitiesWith(Transform, MeshRenderer)) {
    const transform = Transform.getMutable(entity)
    transform.rotation = Quaternion.multiply(
      transform.rotation,
      Quaternion.fromAngleAxis(dt * 10, Vector3.Up())
    )
  }
}

// Add system to engine
engine.addSystem(mySystem)

// Add system with priority (higher runs first) and name
engine.addSystem(mySystem, 1, "RotationSystem")

// Remove system by name
engine.removeSystem("RotationSystem")
```

## Querying Components

```typescript
// Query entities with specific components
for (const [entity, transform, meshRenderer] of engine.getEntitiesWith(Transform, MeshRenderer)) {
  // Process entities that have both Transform and MeshRenderer
}
```

## Custom Components

```typescript
import { Schemas, engine } from '@dcl/sdk/ecs'

// Define custom component schema
const HealthSchema = {
  current: Schemas.Number,
  max: Schemas.Number
}

// Create component with default values
export const Health = engine.defineComponent('Health', HealthSchema, {
  current: 100,
  max: 100
})

// Use custom component
Health.create(player, { current: 100, max: 100 })

const health = Health.getMutable(player)
health.current -= 10

// Flag components (no data, just marking)
export const IsEnemyFlag = engine.defineComponent('isEnemyFlag', {})
IsEnemyFlag.create(enemy)
```

### Complex Schema Types

```typescript
const ComplexSchema = {
  simpleField: Schemas.Boolean,
  numberList: Schemas.Array(Schemas.Int),
  nestedObject: Schemas.Map({
    nestedField1: Schemas.String,
    nestedField2: Schemas.Vector3
  }),
  enumField: Schemas.EnumString<Color>(Color, Color.Red)
}

// OneOf types for interchangeable data
const FlexibleSchema = {
  flexField: Schemas.OneOf({
    vector: Schemas.Vector3,
    quaternion: Schemas.Quaternion
  })
}

// Usage with $case
MyComponent.create(entity, {
  flexField: {
    $case: 'vector',
    value: Vector3.create(1, 2, 3)
  }
})
```

### Component Change Detection

```typescript
// Subscribe to component changes
Health.onChange(playerEntity, (healthData) => {
  if (!healthData) return
  console.log('Health changed:', healthData.current)
})

Transform.onChange(myEntity, (newTransform) => {
  if (!newTransform) return
  console.log('Transform changed:', newTransform.position)
})
```

## Entity Relationships

```typescript
// Parent-child relationships via Transform
const parent = engine.addEntity()
const child = engine.addEntity()

Transform.create(child, {
  position: Vector3.create(2, 0, 0),
  parent: parent
})
```

Child entity positions, rotations, and scales are relative to their parent.

## Basic Project Structure

```
src/
  index.ts          # Main entry point (exports main())
  components.ts     # Custom component definitions
  systems.ts        # Custom system implementations
  factory.ts        # Entity creation functions
  utils.ts          # Helper functions
  ui.tsx            # UI definitions with React
```

### Entry Point Pattern

```typescript
// index.ts
import { engine } from '@dcl/sdk/ecs'
import { setupUi } from './ui'
import { mySystem } from './systems'

export function main() {
  engine.addSystem(mySystem)
  setupUi()
  // Create initial entities here
}
```
