---
name: dcl-scene
description: "Assists with Decentraland SDK7 scene development when the user mentions DCL entities, ECS components, SDK7, 3D models, GLB/GLTF, mesh renderers, materials, transforms, colliders, pointer events, raycasts, trigger areas, animations, audio, video, billboards, scene systems, game loops, virtual cameras, proximity interactions, lights, tweens, or emotes."
---

# Decentraland SDK7 Scene Development

## Quick Start

All SDK7 scenes export a `main()` function as the entry point. Import engine primitives from `@dcl/sdk/ecs` and math helpers from `@dcl/sdk/math`.

```typescript
import { engine, Transform, GltfContainer, MeshRenderer, Material, pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'
import { Vector3, Quaternion, Color4 } from '@dcl/sdk/math'

export function main() {
  const cube = engine.addEntity()
  Transform.create(cube, {
    position: Vector3.create(8, 1, 8),
    rotation: Quaternion.Zero(),
    scale: Vector3.create(1, 1, 1)
  })
  MeshRenderer.setBox(cube)
  Material.setPbrMaterial(cube, { albedoColor: Color4.Red() })
}
```

Preview: `npm run start`. Build: `npm run build`. Deploy: `npm run deploy`.

## ECS Decision Tree

Choose the right approach based on intent:

- **Display a 3D model** -> `GltfContainer` (for .glb/.gltf) or `MeshRenderer` (for primitives)
- **Apply color/texture** -> `Material.setPbrMaterial` (physically-based) or `Material.setBasicMaterial` (unlit)
- **Make clickable** -> Add `PointerEvents` component + collider, handle via `pointerEventsSystem.onPointerDown`
- **Animate model clips** -> `Animator` component with clip states
- **Move/rotate/scale over time** -> Native `Tween` component (prefer over @dcl-sdk/utils tweens)
- **Continuous game logic** -> `engine.addSystem(fn)` with per-frame function
- **Detect player in area** -> `TriggerArea` (native) or `utils.triggers.addTrigger` (@dcl-sdk/utils)
- **Play sound** -> `AudioSource` (clip) or `AudioStream` (URL stream)
- **Play video** -> `VideoPlayer` + `Material.Texture.Video`
- **Display text in 3D** -> `TextShape` component
- **Display NFT** -> `NftShape` component
- **Face player** -> `Billboard` component
- **Control camera** -> `VirtualCamera` + `MainCamera`
- **Add lighting** -> `LightSource` component (point, spot)
- **Custom data** -> `engine.defineComponent()` with `Schemas`
- **Hide entity** -> `VisibilityComponent.create(entity, { visible: false })`

## Entity Lifecycle

1. **Create**: `const e = engine.addEntity()`
2. **Add components**: `Transform.create(e, {...})`, `MeshRenderer.setBox(e)`, etc.
3. **Query**: `engine.getEntitiesWith(Transform, MeshRenderer)` in systems
4. **Mutate**: `Transform.getMutable(e).position.x = 10`
5. **Remove component**: `Transform.deleteFrom(e)`
6. **Remove entity**: `engine.removeEntity(e)`

Reserved entities: `engine.PlayerEntity`, `engine.CameraEntity`, `engine.RootEntity`.

## Component Quick Reference

| Component | Import | Usage |
|-----------|--------|-------|
| Transform | `@dcl/sdk/ecs` | `Transform.create(e, { position, rotation, scale, parent })` |
| GltfContainer | `@dcl/sdk/ecs` | `GltfContainer.create(e, { src: 'models/x.glb' })` |
| MeshRenderer | `@dcl/sdk/ecs` | `MeshRenderer.setBox(e)` / `.setSphere` / `.setCylinder` / `.setPlane` |
| Material | `@dcl/sdk/ecs` | `Material.setPbrMaterial(e, { albedoColor, metallic, roughness })` |
| Animator | `@dcl/sdk/ecs` | `Animator.create(e, { states: [{ clip, playing, loop }] })` |
| AudioSource | `@dcl/sdk/ecs` | `AudioSource.create(e, { audioClipUrl, playing, loop, volume })` |
| VideoPlayer | `@dcl/sdk/ecs` | `VideoPlayer.create(e, { src, playing, loop, volume })` |
| PointerEvents | `@dcl/sdk/ecs` | `PointerEvents.create(e, { pointerEvents: [{ eventType, eventInfo }] })` |
| Billboard | `@dcl/sdk/ecs` | `Billboard.create(e, { billboardMode: BillboardMode.BM_Y })` |
| VisibilityComponent | `@dcl/sdk/ecs` | `VisibilityComponent.create(e, { visible: false })` |
| TextShape | `@dcl/sdk/ecs` | `TextShape.create(e, { text, fontSize, textColor })` |
| NftShape | `@dcl/sdk/ecs` | `NftShape.create(e, { urn, style: NftFrameType.NFT_CLASSIC })` |
| LightSource | `@dcl/sdk/ecs` | `LightSource.create(e, { type: LightSource.Type.Point({}), intensity })` |
| VirtualCamera | `@dcl/sdk/ecs` | `VirtualCamera.create(e, { defaultTransition })` |
| TriggerArea | `@dcl/sdk/ecs` | `TriggerArea.setBox(e)` with `triggerAreaEventsSystem` |
| Tween | `@dcl/sdk/ecs` | `Tween.setMove(e, start, end, duration, easing)` |
| GltfNodeModifiers | `@dcl/sdk/ecs` | Per-node material overrides on GLTF models |
| MeshCollider | `@dcl/sdk/ecs` | `MeshCollider.setBox(e, ColliderLayer.CL_POINTER)` |
| InputModifier | `@dcl/sdk/ecs` | `InputModifier.create(engine.PlayerEntity, { mode })` |

## Systems & Game Loop

System function signature: `(dt: number) => void` where `dt` is seconds since last frame.

```typescript
function rotateSystem(dt: number) {
  for (const [entity, _spinner, _transform] of engine.getEntitiesWith(Spinner, Transform)) {
    const t = Transform.getMutable(entity)
    t.rotation = Quaternion.multiply(t.rotation, Quaternion.fromAngleAxis(dt * 45, Vector3.Up()))
  }
}

engine.addSystem(rotateSystem)
engine.addSystem(rotateSystem, 1, "RotationSystem")  // with priority and name
engine.removeSystem("RotationSystem")
```

Higher priority number = runs first. Use `engine.getEntitiesWith(ComponentA, ComponentB)` to query.

## Interactivity Patterns

### Pointer Events
```typescript
// Declarative component approach
PointerEvents.create(entity, {
  pointerEvents: [{
    eventType: PointerEventType.PET_DOWN,
    eventInfo: { button: InputAction.IA_POINTER, hoverText: 'Click me', maxDistance: 10 }
  }]
})

// Callback approach
pointerEventsSystem.onPointerDown(
  { entity, opts: { button: InputAction.IA_POINTER, hoverText: 'Click' } },
  (event) => { console.log('Clicked!', event.hit.position) }
)
```

Entity must have a collider (MeshCollider or GltfContainer with collision mask) for pointer events.

### System-based Input
```typescript
// In a system function:
if (inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN)) { /* global click */ }
const cmd = inputSystem.getInputCommand(InputAction.IA_POINTER, PointerEventType.PET_DOWN, entity)
if (cmd) { /* entity-specific click */ }
```

### Proximity Interactions
Configure on PointerEvents to respond to player proximity rather than clicks:
- `onProximityEnter` -- fires when player enters range
- `onProximityLeave` -- fires when player exits range
- `onProximityDown` -- fires when player presses button while in range

These use the same PointerEvents component but with proximity-based triggers.

### Raycasting
```typescript
raycastSystem.registerLocalDirectionRaycast(
  { entity, opts: { direction: Vector3.Forward(), maxDistance: 10, queryType: RaycastQueryType.RQT_HIT_FIRST } },
  (result) => { if (result.hits.length > 0) console.log('Hit:', result.hits[0].entityId) }
)
```

### Trigger Areas (Native)
```typescript
const area = engine.addEntity()
TriggerArea.setBox(area)
Transform.create(area, { position: Vector3.create(8, 0, 8), scale: Vector3.create(4, 2, 4) })
triggerAreaEventsSystem.onTriggerEnter(area, (e) => console.log('Enter'))
triggerAreaEventsSystem.onTriggerExit(area, () => console.log('Exit'))
```

### Trigger Areas (@dcl-sdk/utils)
```typescript
utils.triggers.addTrigger(entity, utils.LAYER_2, utils.LAYER_1,
  [{ type: 'box', scale: { x: 4, y: 2, z: 4 } }],
  (other) => console.log('Enter'), (other) => console.log('Exit')
)
```

## Camera System

```typescript
// Create virtual camera
const cam = engine.addEntity()
Transform.create(cam, { position: Vector3.create(8, 5, 2) })
VirtualCamera.create(cam, {
  defaultTransition: VirtualCamera.Transition.Time(0.5),
  lookAtEntity: targetEntity  // optional
})

// Activate camera
MainCamera.createOrReplace(engine.PlayerEntity, { virtualCameraEntity: cam })

// Return to default
MainCamera.deleteFrom(engine.PlayerEntity)

// Force camera mode in area
CameraModeArea.create(entity, {
  area: Vector3.create(8, 4, 8),
  mode: CameraType.CT_FIRST_PERSON
})
```

Transitions: `VirtualCamera.Transition.Time(seconds)` or `VirtualCamera.Transition.Speed(unitsPerSec)`.

## Player & Avatar

```typescript
// Teleport player
import { movePlayerTo } from '~system/RestrictedActions'
movePlayerTo({ newRelativePosition: { x: 8, y: 0, z: 8 }, cameraTarget: { x: 10, y: 1, z: 8 } })

// Trigger emotes
import { triggerEmote, triggerSceneEmote } from '~system/RestrictedActions'
triggerEmote({ predefinedEmote: 'robot' })
triggerSceneEmote({ src: 'animations/dance_emote.glb', loop: false })

// Block specific inputs
InputModifier.createOrReplace(engine.PlayerEntity, {
  mode: InputModifier.Mode.Standard({ disableRun: true, disableJump: true, disableEmote: true })
})

// Freeze player completely
InputModifier.create(engine.PlayerEntity, {
  mode: InputModifier.Mode.Standard({ disableAll: true })
})

// Adjust avatar locomotion
AvatarLocomotionSettings.createOrReplace(engine.PlayerEntity, { runSpeed: 8, jumpHeight: 3 })

// Get explorer info
import { getExplorerInformation } from '~system/Runtime'
const info = await getExplorerInformation({})  // returns { agent, platform }
```

## Custom Components

```typescript
import { Schemas, engine } from '@dcl/sdk/ecs'

const Health = engine.defineComponent('Health', {
  current: Schemas.Number,
  max: Schemas.Number
}, { current: 100, max: 100 })

// Flag component (no data)
const IsEnemy = engine.defineComponent('isEnemy', {})

// Complex schemas
const Complex = engine.defineComponent('Complex', {
  items: Schemas.Array(Schemas.Int),
  nested: Schemas.Map({ name: Schemas.String, pos: Schemas.Vector3 }),
  variant: Schemas.OneOf({ vec: Schemas.Vector3, quat: Schemas.Quaternion }),
  kind: Schemas.EnumString<MyEnum>(MyEnum, MyEnum.Default)
})

// Listen for changes
Health.onChange(entity, (data) => { if (data) console.log('HP:', data.current) })
```

## Observables

Use `@dcl/sdk/observables` for scene lifecycle and player events:
- `onEnterScene` / `onLeaveScene` from `@dcl/sdk/src/players`
- `AvatarEmoteCommand.onChange(engine.PlayerEntity, cb)` for emote events
- `CameraMode.onChange(engine.CameraEntity, cb)` for camera mode changes
- `PointerLock.onChange(engine.CameraEntity, cb)` for cursor lock state

## Native Tween System

Prefer native Tween/TweenSequence/TweenLoop from `@dcl/sdk/ecs` over @dcl-sdk/utils tweens.

```typescript
import { Tween, TweenSequence, TweenLoop, EasingFunction } from '@dcl/sdk/ecs'

// Concise helpers
Tween.setMove(entity, startPos, endPos, durationMs, easingOrOpts)
Tween.setRotate(entity, startQuat, endQuat, durationMs, easing)
Tween.setScale(entity, startScale, endScale, durationMs, easing)
Tween.setTextureMove(entity, startUV, endUV, durationMs)
Tween.setMoveContinuous(entity, direction, speed)
Tween.setRotateContinuous(entity, rotation, speed)

// Verbose Tween.create approach
Tween.create(entity, {
  mode: Tween.Mode.Move({ start: Vector3.create(4,1,4), end: Vector3.create(8,1,8) }),
  duration: 2000,
  easingFunction: EasingFunction.EF_LINEAR
})

// Sequences
TweenSequence.create(entity, {
  sequence: [
    { mode: Tween.Mode.Move({...}), duration: 1000, easingFunction: EasingFunction.EF_LINEAR },
    { mode: Tween.Mode.Rotate({...}), duration: 1000, easingFunction: EasingFunction.EF_LINEAR }
  ],
  loop: TweenLoop.TL_RESTART  // or TL_YOYO
})

// Detect completion
engine.addSystem(() => { if (tweenSystem.tweenCompleted(entity)) console.log('Done') })
```

EasingFunction values: `EF_LINEAR`, `EF_EASEINQUAD`, `EF_EASEOUTQUAD`, `EF_EASEINOUTQUAD`, `EF_EASEINSINE`, `EF_EASEOUTSINE`, `EF_EASEINOUTSINE`, `EF_EASEINEXPO`, `EF_EASEOUTEXPO`, `EF_EASEINOUTEXPO`, `EF_EASEINELASTIC`, `EF_EASEOUTELASTIC`, `EF_EASEINOUTELASTIC`, `EF_EASEINBOUNCE`, `EF_EASEOUTBOUNCE`, `EF_EASEINOUTBOUNCE`.

## Common Recipes

### Spinning Entity
```typescript
const Spinner = engine.defineComponent('spinner', { speed: Schemas.Number })
Spinner.create(entity, { speed: 45 })

engine.addSystem((dt) => {
  for (const [e] of engine.getEntitiesWith(Spinner)) {
    const t = Transform.getMutable(e)
    t.rotation = Quaternion.multiply(t.rotation, Quaternion.fromAngleAxis(dt * Spinner.get(e).speed, Vector3.Up()))
  }
})
```

### Clickable Door
```typescript
let doorOpen = false
pointerEventsSystem.onPointerDown(
  { entity: door, opts: { button: InputAction.IA_POINTER, hoverText: 'Open/Close' } },
  () => {
    doorOpen = !doorOpen
    Tween.setRotate(door,
      Quaternion.fromEulerDegrees(0, doorOpen ? 0 : 90, 0),
      Quaternion.fromEulerDegrees(0, doorOpen ? 90 : 0, 0),
      500, EasingFunction.EF_EASEOUTQUAD
    )
  }
)
```

### Spawner Pattern
```typescript
function spawnCube(pos: Vector3) {
  const e = engine.addEntity()
  Transform.create(e, { position: pos })
  MeshRenderer.setBox(e)
  MeshCollider.setBox(e, ColliderLayer.CL_POINTER)
  Material.setPbrMaterial(e, { albedoColor: Color4.create(Math.random(), Math.random(), Math.random(), 1) })
  return e
}
```

### Virtual Camera Cutscene
```typescript
const cam1 = engine.addEntity()
Transform.create(cam1, { position: Vector3.create(8, 5, 2) })
VirtualCamera.create(cam1, { defaultTransition: VirtualCamera.Transition.Time(1) })

MainCamera.createOrReplace(engine.PlayerEntity, { virtualCameraEntity: cam1 })
utils.timers.setTimeout(() => MainCamera.deleteFrom(engine.PlayerEntity), 5000)
```

## Multiplayer Sync

```typescript
import { syncEntity } from '@dcl/sdk/network'
import { MessageBus } from '@dcl/sdk/message-bus'

// Sync entity state across players
syncEntity(door, [Transform.componentId], 1)  // 1 = unique entity enum ID

// Message bus for custom events
const bus = new MessageBus()
bus.emit('action', { type: 'open' })
bus.on('action', (data) => { /* handle */ })
```

## Networking & HTTP

```typescript
import { executeTask } from '@dcl/sdk/ecs'
import { signedFetch } from '@dcl/sdk/network'

// Standard fetch
executeTask(async () => {
  const res = await fetch('https://api.example.com/data')
  const json = await res.json()
})

// Signed fetch (includes player auth headers)
executeTask(async () => {
  const res = await signedFetch('https://api.example.com/secure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'claim' })
  })
})
```

## NFT & Blockchain

```typescript
import { NftShape, NftFrameType } from '@dcl/sdk/ecs'

// Display NFT artwork
NftShape.create(entity, {
  urn: 'urn:decentraland:ethereum:erc721:0x06012c8cf97bead5deae237070f9587f8e7a266d:558536',
  style: NftFrameType.NFT_CLASSIC
})

// Smart contract interaction
import { createEthereumProvider } from '@dcl/sdk/ethereum-provider'
import { RequestManager, ContractFactory } from 'eth-connect'
```

## Avatar Modifier Areas

```typescript
// Hide other avatars in an area
AvatarModifierArea.create(entity, {
  area: { box: Vector3.create(4, 3, 4) },
  modifiers: [AvatarModifierType.AMT_HIDE_AVATARS],
  excludeIds: ['0x123...']  // Optional exclusions
})
```

## Debugging & Optimization

- Use `console.log()` in preview to debug
- Entities must have colliders for click events to work
- Check `GltfContainerLoadingState` to confirm model loading
- Scene coordinates: (0,0,0) is south-west corner, single parcel = 16x16m, center = (8,0,8)
- Use object pooling for frequently created/destroyed entities
- Use `VisibilityComponent` to hide distant entities
- Use `AssetLoad.create(e, { src: 'models/heavy.glb' })` to pre-download assets at scene startup; track progress with `assetLoadLoadingStateSystem` and `LoadingState`
- Scene limits per parcel (n parcels): Triangles n*10000, Entities n*200, Bodies n*300, Materials log2(n+1)*20, Textures log2(n+1)*10, Height log2(n+1)*20m, File size 15MB/parcel (300MB max), Files 200/parcel (50MB/file max)
- Supported 3D formats: `.glb`, `.gltf` only. Max recommended texture: 512x512, limit 1024x1024
- Performance target: 30 FPS minimum, system execution under 100ms per frame

## Reference Files

Detailed documentation is split across these reference files in the `references/` directory:

1. `ecs-architecture.md` -- ECS fundamentals, entities, components, systems, engine API
2. `3d-essentials.md` -- GltfContainer, MeshRenderer, Material, colliders, billboard, text, NFT
3. `interactivity.md` -- Pointer events, input system, raycasting, trigger areas, proximity
4. `media-audio-video.md` -- AudioSource, AudioStream, VideoPlayer, video events
5. `movement-animation.md` -- Tween system, Animator, LightSource, manual movement
6. `player-avatar-runtime.md` -- Player data, camera, emotes, input modifiers, runtime APIs
7. `camera-system.md` -- VirtualCamera, MainCamera, CameraModeArea, transitions
8. `patterns-and-systems.md` -- State machines, object pools, spawners, factories, async
9. `utils-library.md` -- @dcl-sdk/utils triggers, tweens, paths, toggles, timers
10. `setup-debugging-optimization.md` -- Project setup, deployment, scene limits, optimization
