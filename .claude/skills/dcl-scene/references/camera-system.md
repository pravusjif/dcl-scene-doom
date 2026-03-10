# Camera System

## VirtualCamera

Define camera viewpoints. Create an entity with the VirtualCamera component:

```typescript
import { MainCamera, VirtualCamera, CameraModeArea, CameraType } from '@dcl/sdk/ecs'

const camEntity = engine.addEntity()
Transform.create(camEntity, {
  position: Vector3.create(8, 5, 2),
  rotation: Quaternion.fromEulerDegrees(-20, 0, 0)
})

VirtualCamera.create(camEntity, {
  defaultTransition: VirtualCamera.Transition.Time(0.5),
  lookAtEntity: targetEntity  // optional: entity to focus on
})
```

## MainCamera

Switch the active camera by writing to the player entity:

```typescript
// Activate a virtual camera
MainCamera.createOrReplace(engine.PlayerEntity, {
  virtualCameraEntity: camEntity
})

// Return to default player camera
MainCamera.deleteFrom(engine.PlayerEntity)
```

Alternative pattern from examples:

```typescript
MainCamera.getMutable(engine.CameraEntity).virtualCameraEntity = camEntity

// Return to normal
MainCamera.getMutable(engine.CameraEntity).virtualCameraEntity = undefined
```

## CameraModeArea

Volume that forces camera mode when the player enters:

```typescript
const modeArea = engine.addEntity()
Transform.create(modeArea, { position: Vector3.create(8, 1, 8) })

CameraModeArea.create(modeArea, {
  area: Vector3.create(8, 4, 8),  // box size
  mode: CameraType.CT_FIRST_PERSON  // or CT_THIRD_PERSON
})
```

## Transitions

Two transition modes for switching between cameras:

- `VirtualCamera.Transition.Time(seconds)` -- fixed duration transition
- `VirtualCamera.Transition.Speed(unitsPerSec)` -- speed-based transition

```typescript
// 2-second smooth transition
VirtualCamera.create(camEntity, {
  defaultTransition: VirtualCamera.Transition.Time(2)
})

// Speed-based transition
VirtualCamera.create(camEntity, {
  defaultTransition: VirtualCamera.Transition.Speed(10)
})
```

## Reading Camera State

```typescript
import { CameraMode, CameraType, Transform } from '@dcl/sdk/ecs'

// Current camera mode
const mode = CameraMode.get(engine.CameraEntity)
if (mode.mode === CameraType.CT_FIRST_PERSON) { /* first person */ }

// Camera position and rotation
const cameraTransform = Transform.get(engine.CameraEntity)
const cameraPos = cameraTransform.position
const cameraRot = cameraTransform.rotation

// Listen for mode changes
CameraMode.onChange(engine.CameraEntity, (cam) => {
  if (!cam) return
  console.log('Camera mode changed:', cam.mode)
})
```

## Cutscene Pattern

```typescript
import * as utils from '@dcl-sdk/utils'

// Create camera positions
const cam1 = engine.addEntity()
Transform.create(cam1, { position: Vector3.create(8, 5, 2) })
VirtualCamera.create(cam1, {
  defaultTransition: VirtualCamera.Transition.Time(1),
  lookAtEntity: targetEntity
})

const cam2 = engine.addEntity()
Transform.create(cam2, { position: Vector3.create(12, 3, 8) })
VirtualCamera.create(cam2, {
  defaultTransition: VirtualCamera.Transition.Time(1.5)
})

// Cutscene sequence
function startCutscene() {
  // Disable player movement
  InputModifier.create(engine.PlayerEntity, {
    mode: InputModifier.Mode.Standard({ disableAll: true })
  })

  // First camera
  MainCamera.createOrReplace(engine.PlayerEntity, { virtualCameraEntity: cam1 })

  // Switch to second camera after 3 seconds
  utils.timers.setTimeout(() => {
    MainCamera.createOrReplace(engine.PlayerEntity, { virtualCameraEntity: cam2 })
  }, 3000)

  // Return to player camera after 6 seconds
  utils.timers.setTimeout(() => {
    MainCamera.deleteFrom(engine.PlayerEntity)
    InputModifier.deleteFrom(engine.PlayerEntity)
  }, 6000)
}
```
