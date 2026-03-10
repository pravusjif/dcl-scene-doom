# @dcl-sdk/utils Library

> **Note:** For tweening, prefer the native Tween/TweenSequence/TweenLoop components from `@dcl/sdk/ecs` over @dcl-sdk/utils tween helpers. The native system is more performant and integrated with the engine. Use @dcl-sdk/utils tweens only when you need completion callbacks or the specific interpolation types it provides.

## Installation & Import

```typescript
// Install via npm
npm install @dcl-sdk/utils

// Import in your code
import * as utils from '@dcl-sdk/utils'
```

## Debug Helpers

### Add Label

```typescript
const entity = engine.addEntity()
utils.addLabel(
  'Label Text',     // Text to display
  entity,           // Parent entity
  true,             // Billboard mode (optional, default: true)
  Color4.Black(),   // Text color (optional, default: Black)
  3,                // Text size (optional, default: 3)
  {x: 0, y: 1.5, z: 0} // Position offset (optional)
)
```

### Add Test Cube

```typescript
const cube = utils.addTestCube(
  { position: { x: 1, y: 1, z: 1 } },  // Transform object
  (e) => { console.log('clicked') },     // Click callback (optional)
  'Cube Label',                          // Label text (optional)
  Color4.Red(),                          // Cube color (optional)
  false,                                 // Sphere shape instead (optional)
  false                                  // Disable collider (optional)
)
```

## Tweens

### Translation

```typescript
utils.tweens.startTranslation(
  entity,
  Vector3.create(1, 1, 1),     // Start position
  Vector3.create(5, 1, 5),     // End position
  2,                            // Duration in seconds
  utils.InterpolationType.LINEAR,
  () => { console.log('Done') }
)

utils.tweens.stopTranslation(entity)
```

### Rotation

```typescript
utils.tweens.startRotation(
  entity,
  Quaternion.fromEulerDegrees(0, 0, 0),
  Quaternion.fromEulerDegrees(0, 90, 0),
  2,
  utils.InterpolationType.EASEINQUAD,
  () => { console.log('Done') }
)

utils.tweens.stopRotation(entity)
```

### Scaling

```typescript
utils.tweens.startScaling(
  entity,
  Vector3.create(1, 1, 1),
  Vector3.create(2, 2, 2),
  2,
  utils.InterpolationType.LINEAR,
  () => { console.log('Done') }
)

utils.tweens.stopScaling(entity)
```

### Interpolation Types

```typescript
utils.InterpolationType.LINEAR
utils.InterpolationType.EASEINQUAD
utils.InterpolationType.EASEOUTQUAD
utils.InterpolationType.EASEQUAD
utils.InterpolationType.EASEINSINE
utils.InterpolationType.EASEOUTSINE
utils.InterpolationType.EASESINE
utils.InterpolationType.EASEINEXPO
utils.InterpolationType.EASEOUTEXPO
utils.InterpolationType.EASEEXPO
utils.InterpolationType.EASEINELASTIC
utils.InterpolationType.EASEOUTELASTIC
utils.InterpolationType.EASEELASTIC
utils.InterpolationType.EASEINBOUNCE
utils.InterpolationType.EASEOUTBOUNCE
utils.InterpolationType.EASEBOUNCE
```

## Perpetual Motions

```typescript
utils.perpetualMotions.smoothRotation(
  entity,     // Entity to rotate
  2000,       // Duration of full 360 rotation in milliseconds
  'y'         // Rotation axis (optional, default: 'y')
)

utils.perpetualMotions.stopRotation(entity)
```

## Paths

### Straight Path

```typescript
utils.paths.startStraightPath(
  entity,
  [
    Vector3.create(1, 1, 1),
    Vector3.create(5, 1, 5),
    Vector3.create(10, 1, 2)
  ],
  10,                     // Duration in seconds
  true,                   // Face movement direction (optional)
  () => console.log('Path complete'),
  (pointIndex, point, nextPoint) => console.log(`Reached point ${pointIndex}`)
)
```

### Smooth Path

```typescript
utils.paths.startSmoothPath(
  entity,
  [
    Vector3.create(1, 1, 1),
    Vector3.create(5, 1, 5),
    Vector3.create(10, 1, 2)
  ],
  10,    // Duration in seconds
  20,    // Number of segments (higher = smoother)
  true,  // Face movement direction
  () => console.log('Path complete'),
  (pointIndex, point, nextPoint) => console.log(`Reached point ${pointIndex}`)
)

utils.paths.stopPath(entity)
```

## Toggles

```typescript
utils.toggles.addToggle(
  entity,
  utils.ToggleState.Off,
  (state) => {
    if (state === utils.ToggleState.On) {
      // Handle ON
    } else {
      // Handle OFF
    }
  }
)

utils.toggles.isOn(entity)
utils.toggles.set(entity, utils.ToggleState.On)
utils.toggles.flip(entity)
utils.toggles.removeToggle(entity)
```

## Timers

```typescript
const timeoutId = utils.timers.setTimeout(() => {
  console.log('After 2 seconds')
}, 2000)

utils.timers.clearTimeout(timeoutId)

const intervalId = utils.timers.setInterval(() => {
  console.log('Every second')
}, 1000)

utils.timers.clearInterval(intervalId)
```

## Triggers

### Trigger Areas

```typescript
// Predefined layers
utils.LAYER_1, utils.LAYER_2, ... utils.LAYER_8
utils.ALL_LAYERS
utils.NO_LAYERS

utils.triggers.addTrigger(
  entity,
  utils.LAYER_2,        // Layers this entity belongs to
  utils.LAYER_1,        // Layers that can trigger this entity
  [
    { type: 'box', position: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    { type: 'sphere', position: { x: 0, y: 0, z: 0 }, radius: 2 }
  ],
  (otherEntity) => console.log(`${otherEntity} entered trigger`),
  (otherEntity) => console.log(`${otherEntity} exited trigger`),
  Color4.Red()  // Debug visualization color (optional)
)

utils.triggers.enableDebugDraw(true)
utils.triggers.enableTrigger(entity, false)
utils.triggers.removeTrigger(entity)
```

### One-Time Trigger

```typescript
utils.triggers.oneTimeTrigger(
  entity,
  utils.NO_LAYERS,
  utils.LAYER_1,
  [{ type: 'box', scale: { x: 5, y: 2, z: 5 } }],
  (otherEntity) => console.log('Triggered once')
)
```

## Math Helpers

```typescript
// Remap value from one range to another
const result = utils.remap(5, 0, 10, 0, 100)  // Returns 50

// World position/rotation (considering parent hierarchy)
const worldPos = utils.getWorldPosition(entity)
const worldRot = utils.getWorldRotation(entity)
```

## Entity Helpers

```typescript
const parent = utils.getEntityParent(entity)
const children = utils.getEntitiesWithParent(parentEntity)
const playerPos = utils.getPlayerPosition()

utils.playSound(
  'sounds/mySound.mp3',
  false,                      // Loop
  Vector3.create(10, 1, 10)   // Position (optional)
)
```

## Action Sequences

```typescript
class MyAction implements utils.actions.IAction {
  hasFinished: boolean = false

  onStart(): void {
    // Set hasFinished = true when done
  }

  update(dt: number): void {
    // Per-frame logic
  }

  onFinish(): void {
    // Clean-up
  }
}

const sequence = new utils.actions.SequenceBuilder()
  .then(new MyAction())
  .if(() => condition)
    .then(new MyAction())
  .else()
    .then(new MyAction())
  .endIf()
  .while(() => loopCondition)
    .then(new MyAction())
  .endWhile()

const runner = new utils.actions.SequenceRunner(
  engine,
  sequence,
  () => console.log('Sequence complete')
)

runner.stop()
runner.resume()
runner.reset()
runner.destroy()
```

## Common Patterns

### Toggle Position on Click

```typescript
const pos1 = Vector3.create(1, 1, 1)
const pos2 = Vector3.create(5, 1, 5)

utils.toggles.addToggle(entity, utils.ToggleState.Off, (state) => {
  if (state === utils.ToggleState.On) {
    utils.tweens.startTranslation(entity, pos1, pos2, 1)
  } else {
    utils.tweens.startTranslation(entity, pos2, pos1, 1)
  }
})

pointerEventsSystem.onPointerDown(
  entity,
  () => utils.toggles.flip(entity),
  { button: InputAction.IA_POINTER, hoverText: 'Move' }
)
```

### Looping Path

```typescript
function createLoopingPath(entity: Entity) {
  const path = [
    Vector3.create(1, 1, 1),
    Vector3.create(5, 1, 5),
    Vector3.create(8, 1, 2),
    Vector3.create(1, 1, 1)  // Back to start
  ]

  function startPath() {
    utils.paths.startSmoothPath(entity, path, 10, 20, true, () => startPath())
  }

  startPath()
}
```
