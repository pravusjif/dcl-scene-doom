# Player, Avatar & Runtime

## Player Position and Rotation

```typescript
import { engine, Transform } from '@dcl/sdk/ecs'

function getPlayerData() {
  if (!Transform.has(engine.PlayerEntity)) return
  if (!Transform.has(engine.CameraEntity)) return

  // Player position (at chest height, ~0.88m above ground)
  const playerPos = Transform.get(engine.PlayerEntity).position
  const playerRot = Transform.get(engine.PlayerEntity).rotation

  // Camera position (at eye level, ~1.75m above ground in 1st person)
  const cameraPos = Transform.get(engine.CameraEntity).position
  const cameraRot = Transform.get(engine.CameraEntity).rotation
}

engine.addSystem(getPlayerData)
```

## Player Identity

```typescript
import { engine, PlayerIdentityData, AvatarBase, AvatarEquippedData } from '@dcl/sdk/ecs'

for (const [entity, identity, base, equipped] of engine.getEntitiesWith(
  PlayerIdentityData, AvatarBase, AvatarEquippedData
)) {
  console.log('Address:', identity.address)
  console.log('Name:', base.name)
  console.log('Body shape:', base.bodyShapeUrn)
  console.log('Wearables:', equipped.wearableUrns)
  console.log('Emotes:', equipped.emoteUrns)
}
```

### Get Player Profile

```typescript
import { getPlayer } from '@dcl/sdk/src/players'

const player = getPlayer()
if (player) {
  console.log('Name:', player.name)
  console.log('User ID:', player.userId)
  console.log('Is Guest:', player.isGuest)
  console.log('Wearables:', player.wearables)
}
```

## Scene Entry/Exit Events

```typescript
import { onEnterScene, onLeaveScene } from '@dcl/sdk/src/players'

onEnterScene((player) => {
  if (!player) return
  console.log('Player entered:', player.userId)
})

onLeaveScene((userId) => {
  if (!userId) return
  console.log('Player left:', userId)
})
```

## Camera Mode

```typescript
import { CameraMode, CameraType } from '@dcl/sdk/ecs'

const cameraMode = CameraMode.get(engine.CameraEntity)
if (cameraMode.mode === CameraType.CT_FIRST_PERSON) {
  // First person
} else if (cameraMode.mode === CameraType.CT_THIRD_PERSON) {
  // Third person
}

// Listen for changes
CameraMode.onChange(engine.CameraEntity, (cam) => {
  if (!cam) return
  console.log('Camera mode:', cam.mode)
})
```

### Camera Mode Area

```typescript
import { CameraModeArea, CameraType } from '@dcl/sdk/ecs'

const area = engine.addEntity()
CameraModeArea.create(area, {
  area: Vector3.create(5, 5, 5),
  mode: CameraType.CT_FIRST_PERSON
})
Transform.create(area, { position: Vector3.create(8, 1, 8) })
```

### Camera Quaternion Yaw Extraction

Extract the camera's horizontal rotation angle from the quaternion. Useful for custom camera-based controls (raycasters, mini-games, compass UI):

```typescript
const rot = Transform.get(engine.CameraEntity).rotation
const yaw = Math.atan2(
  2 * (rot.w * rot.y + rot.x * rot.z),
  1 - 2 * (rot.y * rot.y + rot.z * rot.z)
)
// yaw can be passed directly to direction vectors — do NOT negate it
// Example: set a 2D direction from yaw
const dirX = Math.cos(yaw)
const dirY = Math.sin(yaw)
```

## Pointer Lock

```typescript
const isLocked = PointerLock.get(engine.CameraEntity).isPointerLocked

PointerLock.onChange(engine.CameraEntity, (pointerLock) => {
  if (!pointerLock) return
  console.log('Cursor locked:', pointerLock.isPointerLocked)
})
```

## Restricted Actions

### Move Player

**WARNING:** `Transform.createOrReplace(engine.PlayerEntity, { position: ... })` does NOT teleport the player. You must use `movePlayerTo` from `~system/RestrictedActions`:

```typescript
import { movePlayerTo } from '~system/RestrictedActions'

movePlayerTo({
  newRelativePosition: { x: 8, y: 0, z: 8 },
  cameraTarget: { x: 10, y: 1, z: 8 }  // Optional: where to look
})
```

### Trigger Emotes

```typescript
import { triggerEmote, triggerSceneEmote } from '~system/RestrictedActions'

// Default emote
triggerEmote({ predefinedEmote: 'robot' })  // 'wave', 'dance', etc.

// Custom emote (file must end with _emote.glb)
triggerSceneEmote({ src: 'animations/Snowball_Throw_emote.glb', loop: false })
```

Emotes play only while the player is still; walking/jumping interrupts.

### Emote Events

```typescript
import { AvatarEmoteCommand } from '@dcl/sdk/ecs'

AvatarEmoteCommand.onChange(engine.PlayerEntity, (emote) => {
  if (!emote) return
  console.log('Emote played:', emote.emoteUrn)
})
```

### External Links

```typescript
import { openExternalUrl, openNftDialog } from '~system/RestrictedActions'

openExternalUrl({ url: 'https://decentraland.org' })
openNftDialog({
  urn: 'urn:decentraland:ethereum:erc721:0x06012c8cf97bead5deae237070f9587f8e7a266d:1540722'
})
```

### Teleportation

```typescript
import { teleportTo, changeRealm } from '~system/RestrictedActions'

teleportTo({ worldCoordinates: { x: 10, y: 20 } })
changeRealm({ realm: 'https://peer.decentraland.org', message: 'Change realms?' })
```

## Input Modifiers

Granular flags to block specific player inputs:

```typescript
import { InputModifier } from '@dcl/sdk/ecs'

// Freeze player completely
InputModifier.create(engine.PlayerEntity, {
  mode: InputModifier.Mode.Standard({ disableAll: true })
})

// Restrict specific locomotion
InputModifier.createOrReplace(engine.PlayerEntity, {
  mode: InputModifier.Mode.Standard({
    disableRun: true,
    disableJump: true,
    disableEmote: true,
    disableWalk: false
  })
})

// Re-enable
InputModifier.getMutable(engine.PlayerEntity).mode = {
  $case: 'standard',
  standard: { disableWalk: false, disableRun: false, disableJump: false }
}
```

Supported in the DCL 2.0 desktop client; only affects the local player inside scene bounds.

**WARNING — Timing:** InputModifier applied during `main()` may silently fail because `engine.PlayerEntity` is not fully initialized yet. Defer InputModifier creation to the first system tick:

```typescript
let initialized = false
engine.addSystem((dt) => {
  if (!initialized) {
    initialized = true
    InputModifier.createOrReplace(engine.PlayerEntity, {
      mode: InputModifier.Mode.Standard({ disableAll: true })
    })
  }
})
```

**WARNING — `disableAll` blocks `isTriggered()`:** When `InputModifier` has `disableAll: true`, `inputSystem.isTriggered()` silently stops firing for keyboard actions like `IA_PRIMARY` (E), `IA_SECONDARY` (F), and `IA_ACTION_*` keys. This is because `isTriggered` relies on the pointer event system, which `disableAll` disables.

If your scene locks movement but still needs keyboard input (mini-games, cutscenes, puzzles), use `inputSystem.isPressed()` with a manual debounce flag instead:

```typescript
// isTriggered WILL NOT WORK when disableAll is true — use isPressed + debounce
let useWasPressed = false

function checkUseAction(): boolean {
  const down = inputSystem.isPressed(InputAction.IA_SECONDARY)
  const triggered = down && !useWasPressed
  useWasPressed = down
  return triggered  // true only on the first frame the key is held
}
```

Note: `isPressed()` is a raw input check that works regardless of InputModifier state. The debounce flag ensures it fires once per key press, not every frame while held.

## Avatar Locomotion Settings

Adjust player movement parameters:

```typescript
AvatarLocomotionSettings.createOrReplace(engine.PlayerEntity, {
  runSpeed: 8,
  jumpHeight: 3
})
```

## Avatar Shapes (NPC Avatars)

```typescript
import { AvatarShape } from '@dcl/sdk/ecs'

AvatarShape.create(entity, {
  id: 'npc-1',
  name: 'NPC Name',
  bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
  wearables: [
    'urn:decentraland:off-chain:base-avatars:blue_tshirt',
    'urn:decentraland:off-chain:base-avatars:brown_pants'
  ],
  hairColor: { r: 0.92, g: 0.76, b: 0.62 },
  skinColor: { r: 0.94, g: 0.85, b: 0.6 }
})

// Show only wearables (mannequin/storefront)
AvatarShape.create(entity, {
  id: 'mannequin-1',
  name: 'Display',
  wearables: ['urn:decentraland:matic:collections-v2:0x...:0'],
  show_only_wearables: true
})
```

## Runtime Data

### World Time

```typescript
import { getWorldTime } from '~system/Runtime'

executeTask(async () => {
  const time = await getWorldTime({})
  const hours = (time.seconds / 3600) % 24
})
```

### Realm Information

```typescript
import { getRealm } from '~system/Runtime'

executeTask(async () => {
  const { realmInfo } = await getRealm({})
  console.log('Realm:', realmInfo.realmName)
  console.log('Network ID:', realmInfo.networkId)
  console.log('Is preview:', realmInfo.isPreview)
})
```

### Scene Metadata

```typescript
import { getSceneInformation } from '~system/Runtime'

executeTask(async () => {
  const info = await getSceneInformation({})
  if (!info) return
  const sceneJson = JSON.parse(info.metadataJson)
  console.log(sceneJson.scene?.parcels, sceneJson.spawnPoints)
})
```

### Platform Detection

```typescript
import { getPlatform } from '~system/EnvironmentApi'

executeTask(async () => {
  const { platform } = await getPlatform()
  // 'BROWSER' or 'DESKTOP'
})
```

### Explorer Information

```typescript
import { getExplorerInformation } from '~system/Runtime'

executeTask(async () => {
  const info = await getExplorerInformation({})
  // returns { agent, platform } for device detection
})
```

### Engine Information

```typescript
import { EngineInfo } from '@dcl/sdk/ecs'

engine.addSystem((dt) => {
  const engineInfo = EngineInfo.getOrNull(engine.RootEntity)
  if (!engineInfo) return

  const frame = engineInfo.frameNumber
  const runtime = engineInfo.totalRuntime
  const tick = engineInfo.tickNumber
})
```

## Skybox Control

### Fixed Time (scene.json)

```json
"skyboxConfig": {
  "fixedTime": 36000
}
```

### Dynamic Time

```typescript
import { SkyboxTime, TransitionMode } from '~system/Runtime'

SkyboxTime.create(engine.RootEntity, { fixed_time: 36000 })

SkyboxTime.createOrReplace(engine.RootEntity, {
  fixed_time: 54000,
  direction: TransitionMode.TM_BACKWARD
})
```
