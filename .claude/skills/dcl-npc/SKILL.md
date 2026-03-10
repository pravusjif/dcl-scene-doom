---
name: dcl-npc
description: "Assists with Decentraland SDK7 NPC and dialog systems when the user mentions NPCs, dialog trees, dcl-npc-toolkit, avatar NPCs, conversations, quest NPCs, shop NPCs, NPC movement, NPC interaction, or createNPC."
---

# Decentraland SDK7 NPC and Dialog Systems

This skill covers creating NPCs, designing dialog trees, wiring interactions, and building advanced NPC patterns using the `dcl-npc-toolkit` for Decentraland SDK7 scenes.

## 1. NPC Setup

### Installation

```bash
npm i dcl-npc-toolkit
```

### Import

```typescript
import { createNPC, Dialog } from 'dcl-npc-toolkit'
```

### Creating an NPC with AvatarShape (no toolkit)

Use `AvatarShape` directly on an entity for a humanoid NPC with Decentraland avatar appearance:

```typescript
const npcEntity = engine.addEntity()
AvatarShape.create(npcEntity, {
  id: 'npc-001',
  name: 'Guide NPC',
  bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
  wearables: [
    'urn:decentraland:off-chain:base-avatars:blue_tshirt',
    'urn:decentraland:off-chain:base-avatars:brown_pants'
  ],
  eyeColor: Color3.create(0.3, 0.7, 0.9),
  skinColor: Color3.create(0.8, 0.6, 0.5),
  hairColor: Color3.create(0.1, 0.1, 0.1),
  talking: false
})
Transform.create(npcEntity, {
  position: Vector3.create(8, 0.25, 8),
  rotation: { x: 0, y: 0, z: 0, w: 1 }
})
```

### Creating an NPC with a Custom GLB Model (toolkit)

Use `createNPC` with `type: 'custom'` and a `model` path to use a GLB instead of an avatar:

```typescript
const guide = createNPC(
  {
    position: { x: 8, y: 0, z: 8 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 }
  },
  {
    type: 'custom',
    model: 'models/guide.glb',
    dialog: [{ text: "Welcome!", isEndOfDialog: true } as Dialog],
    onActivate: () => {
      console.log('Guide activated')
    }
  }
)
```

The `createNPC` function returns an entity and handles click detection, dialog state, and animation management internally.

## 2. Dialog Tree Design

Dialogs are defined as a `Dialog[]` array. Each element is a dialog step, referenced by its array index. The NPC advances through the array sequentially unless redirected by buttons or `goToDialog`.

### Dialog Structure

```typescript
const dialogs: Dialog[] = [
  // Index 0: opening line with choices
  {
    text: 'Welcome, traveler! What do you seek?',
    isQuestion: true,
    buttons: [
      { label: 'Tell me about this place', goToDialog: 1 },
      { label: 'Give me a quest', goToDialog: 2 },
      { label: 'Goodbye', goToDialog: 3 }
    ]
  } as unknown as Dialog,
  // Index 1: info branch
  { text: 'These lands are rich with secrets and stories.', isEndOfDialog: true } as Dialog,
  // Index 2: quest branch
  { text: 'Take this task and return victorious!', isEndOfDialog: true } as Dialog,
  // Index 3: farewell
  { text: 'Safe travels!', isEndOfDialog: true } as Dialog
]
```

Key design rules:
- Each dialog step is an object with at minimum a `text` field.
- Use `isEndOfDialog: true` to close the dialog window after that step.
- Use `isQuestion: true` with a `buttons` array for branching choices.
- Each button has a `label` (display text) and `goToDialog` (index into the array).
- Without `isQuestion` or `isEndOfDialog`, the dialog auto-advances to the next index.

## 3. Dialog Types Reference

| Property | Type | Description |
|---|---|---|
| `text` | `string` | The dialog text displayed to the player. Required. |
| `isEndOfDialog` | `boolean` | If true, closes the dialog window after this step. |
| `isQuestion` | `boolean` | If true, shows button choices instead of auto-advancing. |
| `buttons` | `{ label: string, goToDialog: number }[]` | Choice buttons shown when `isQuestion` is true. |
| `typeSpeed` | `number` | Speed of the typewriter text effect (characters per second). |
| `ifPressE` | `number` | Dialog index to jump to if player presses E. |
| `ifPressF` | `number` | Dialog index to jump to if player presses F. |
| `triggeredByNext` | `() => void` | Callback function executed when this dialog step is reached. |
| `goToDialog` | `number` | Auto-jump to this dialog index (for non-question steps). |

### Type casting note

When using `isQuestion` with `buttons`, cast as `as unknown as Dialog` because the toolkit's type definition may not include the buttons field directly. For simple text-only steps, cast as `as Dialog`.

## 4. NPC Interaction Wiring

### Click-based activation (toolkit)

When using `createNPC`, pass an `onActivate` callback:

```typescript
const npc = createNPC(
  { position: { x: 8, y: 0, z: 8 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
  {
    type: 'custom',
    model: 'models/npc.glb',
    dialog: myDialogs,
    onActivate: () => {
      console.log('NPC activated')
    }
  }
)
```

### Click-based activation (manual, no toolkit)

For AvatarShape NPCs not created via `createNPC`, wire clicks manually:

```typescript
import { pointerEventsSystem, InputAction } from '@dcl/sdk/ecs'

pointerEventsSystem.onPointerDown(
  {
    entity: npc,
    opts: { button: InputAction.IA_POINTER, hoverText: 'Talk to NPC' }
  },
  () => {
    handleNPCInteraction(npc)
  }
)
```

### Toolkit Dialog UI setup

To display the toolkit's dialog HUD, mount `NpcUtilsUi` in your scene UI:

```typescript
import { NpcUtilsUi } from 'dcl-npc-toolkit'

ReactEcsRenderer.setUiRenderer(() => (
  <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
    <NpcUtilsUi />
  </UiEntity>
))
```

### Opening dialogs on entities not created via createNPC

If you need `openDialogWindow` or `talkBubble` on an entity that was NOT created via `createNPC`, you must initialize toolkit internal data first:

```typescript
import { addDialog } from 'dcl-npc-toolkit/dist/dialog'
import { openDialogWindow } from 'dcl-npc-toolkit'
import { npcDataComponent } from 'dcl-npc-toolkit/dist/npc'

// Initialize toolkit data
addDialog(npcEntity)
npcDataComponent.set(npcEntity as any, {
  introduced: false, inCooldown: false, coolDownDuration: 5,
  faceUser: undefined, walkingSpeed: 2, walkingAnim: undefined,
  pathData: undefined, currentPathData: [], manualStop: false,
  pathIndex: 0, state: 'STANDING', idleAnim: 'Idle',
  hasBubble: false, turnSpeed: 2,
  theme: 'https://decentraland.org/images/ui/light-atlas-v3.png',
  bubbleXOffset: 0, bubbleYOffset: 0, lastPlayedAnim: 'Idle'
})

// Then open the dialog
openDialogWindow(npcEntity, dialogs, 0)
```

### Bubble dialogs (world-space speech bubbles)

```typescript
import { addDialog } from 'dcl-npc-toolkit/dist/dialog'
import { createDialogBubble } from 'dcl-npc-toolkit/dist/bubble'
import { talkBubble } from 'dcl-npc-toolkit'

addDialog(npcEntity)
createDialogBubble(npcEntity)
talkBubble(npcEntity, dialogs, 0)
```

### Common errors and fixes

- **"Cannot set properties of undefined (setting 'script')"** in bubble.js: Call `createDialogBubble(npc)` before `talkBubble`.
- **Error in `<NpcUtilsUi>` from `getTheme`/`displayDialog`**: The entity is missing `npcDataComponent`. Call `addDialog` and set `npcDataComponent` before `openDialogWindow`.

### Interaction options

- `faceUser`: NPC turns to face the player during interaction.
- `cooldownDuration`: Seconds before the NPC can be activated again.
- `onWalkAway`: Callback when player moves away during conversation (toolkit manages this internally when using `createNPC`).

## 5. NPC Movement

### Path following with Tweens

```typescript
function createPatrollingNPC() {
  const patrollingNPC = createNPC(
    { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
    { type: 'custom', model: 'models/guard.glb' }
  )

  const patrolPath = [
    Vector3.create(0, 0.25, 0),
    Vector3.create(5, 0.25, 0),
    Vector3.create(5, 0.25, 5),
    Vector3.create(0, 0.25, 5),
    Vector3.create(0, 0.25, 0)
  ]

  // Play walk animation via toolkit
  npc.playAnimation(patrollingNPC, 'Walk', true)

  // Move along path using Tween + TweenSequence
  Tween.setMove(patrollingNPC, patrolPath[0], patrolPath[1], 4000, EasingFunction.EF_LINEAR)
  TweenSequence.create(patrollingNPC, {
    sequence: [
      { duration: 4000, easingFunction: EasingFunction.EF_LINEAR, mode: Tween.Mode.Move({ start: patrolPath[1], end: patrolPath[2] }) },
      { duration: 4000, easingFunction: EasingFunction.EF_LINEAR, mode: Tween.Mode.Move({ start: patrolPath[2], end: patrolPath[3] }) },
      { duration: 4000, easingFunction: EasingFunction.EF_LINEAR, mode: Tween.Mode.Move({ start: patrolPath[3], end: patrolPath[4] }) }
    ],
    loop: TweenLoop.TL_RESTART
  })

  return patrollingNPC
}
```

### NPC following the player

```typescript
function createFollowingNPC() {
  const followingNPC = createNPC(
    { position: { x: 2, y: 0, z: 2 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
    { type: 'custom', model: 'models/companion.glb' }
  )

  engine.addSystem(() => {
    if (!Transform.has(engine.PlayerEntity)) return
    const playerPos = Transform.get(engine.PlayerEntity).position
    const npcTransform = Transform.getMutable(followingNPC)
    const currentPos = npcTransform.position

    const direction = Vector3.subtract(playerPos, currentPos)
    const distance = Vector3.length(direction)

    if (distance > 3 && distance < 10) {
      const normalizedDir = Vector3.normalize(direction)
      npcTransform.position = Vector3.add(currentPos, Vector3.scale(normalizedDir, 0.05))
      npcTransform.rotation = Quaternion.lookRotation(normalizedDir)
    }
  })

  return followingNPC
}
```

### Walkable area constraints

Keep NPC positions clamped within scene boundaries. Decentraland parcels are 16x16 meters. Use `Math.max`/`Math.min` to clamp x and z positions within `[0, 16 * parcels]` range in your movement system.

## 6. Advanced Patterns

### Shop NPC

Combine dialog choices with purchase logic. Use `triggeredByNext` on a dialog step to execute the buy operation when the player reaches that step:

```typescript
const shopDialogs: Dialog[] = [
  {
    text: 'Welcome to my shop! What would you like?',
    isQuestion: true,
    buttons: [
      { label: 'Buy Health Potion (25 coins)', goToDialog: 1 },
      { label: 'Buy Magic Sword (100 coins)', goToDialog: 2 },
      { label: 'Just browsing', goToDialog: 3 }
    ]
  } as unknown as Dialog,
  { text: 'One Health Potion coming up!', triggeredByNext: () => buyItem('potion', 25), isEndOfDialog: true } as Dialog,
  { text: 'A fine choice! Here is your sword.', triggeredByNext: () => buyItem('sword', 100), isEndOfDialog: true } as Dialog,
  { text: 'Feel free to look around!', isEndOfDialog: true } as Dialog
]

const shopNPC = createNPC(
  { position: { x: 8, y: 0, z: 8 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
  { type: 'custom', model: 'models/merchant.glb', dialog: shopDialogs }
)
```

For crypto/MANA transactions, call the Decentraland crypto API within the `triggeredByNext` callback.

### Quest Giver NPC

Track quest state externally and swap dialog arrays based on progress:

```typescript
let questState: 'not_started' | 'in_progress' | 'completed' = 'not_started'

const questDialogsNotStarted: Dialog[] = [
  { text: 'I need someone brave. Will you help?', isQuestion: true, buttons: [
    { label: 'Accept quest', goToDialog: 1 },
    { label: 'Not now', goToDialog: 2 }
  ]} as unknown as Dialog,
  { text: 'Find the lost artifact in the cave to the north!', triggeredByNext: () => { questState = 'in_progress' }, isEndOfDialog: true } as Dialog,
  { text: 'Come back when you are ready.', isEndOfDialog: true } as Dialog
]

const questDialogsInProgress: Dialog[] = [
  { text: 'Have you found the artifact yet? Keep looking!', isEndOfDialog: true } as Dialog
]

const questDialogsCompleted: Dialog[] = [
  { text: 'You found it! You are a true hero. Here is your reward.', isEndOfDialog: true } as Dialog
]

const questNPC = createNPC(
  { position: { x: 10, y: 0, z: 10 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
  {
    type: 'custom',
    model: 'models/quest_giver.glb',
    onActivate: () => {
      let dialogs = questDialogsNotStarted
      if (questState === 'in_progress') dialogs = questDialogsInProgress
      if (questState === 'completed') dialogs = questDialogsCompleted
      openDialogWindow(questNPC, dialogs, 0)
    }
  }
)
```

### Guard NPC

Blocks a path and only lets the player pass after a dialog condition is met:

```typescript
let hasAccess = false

const guardDialogs: Dialog[] = [
  { text: 'Halt! You cannot pass without the key.', isQuestion: true, buttons: [
    { label: 'I have the key', goToDialog: 1 },
    { label: 'I will find it', goToDialog: 2 }
  ]} as unknown as Dialog,
  { text: 'Very well, you may pass.', triggeredByNext: () => { hasAccess = true; removeBarrier() }, isEndOfDialog: true } as Dialog,
  { text: 'Return when you have it.', isEndOfDialog: true } as Dialog
]
```

### Custom GLB Model NPC

When using `createNPC` with `type: 'custom'`, the toolkit uses `GltfContainer` internally to load the model. Ensure your GLB file is in the scene's file tree (typically under `models/`). The NPC's animations are driven from the GLB's embedded animation clips. Use `npc.playAnimation(entity, 'ClipName', loop)` to trigger them.

## 7. NPC Configuration Options

Options passed as the second argument to `createNPC`:

| Option | Type | Description |
|---|---|---|
| `type` | `'custom'` | Use a custom GLB model. |
| `model` | `string` | Path to the GLB model file (e.g. `'models/npc.glb'`). |
| `dialog` | `Dialog[]` | Array of dialog steps for the NPC. |
| `onActivate` | `() => void` | Callback when the NPC is clicked/activated. |
| `faceUser` | `boolean` | NPC rotates to face the player during interaction. |
| `cooldownDuration` | `number` | Seconds before NPC can be activated again. |
| `onWalkAway` | `() => void` | Callback when the player walks away during dialog. |
| `idleAnim` | `string` | Name of the idle animation clip in the GLB. |
| `walkingAnim` | `string` | Name of the walking animation clip in the GLB. |
| `walkingSpeed` | `number` | Movement speed when following a path. |
| `turnSpeed` | `number` | Rotation speed when turning to face the player. |
| `hasBubble` | `boolean` | Enable world-space speech bubble instead of HUD dialog. |
| `bubbleXOffset` | `number` | Horizontal offset for the speech bubble. |
| `bubbleYOffset` | `number` | Vertical offset for the speech bubble. |

## 8. Common Recipes

### Simple Greeter

```typescript
const greeter = createNPC(
  { position: { x: 8, y: 0, z: 8 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
  {
    type: 'custom',
    model: 'models/greeter.glb',
    dialog: [
      { text: "Hello! Welcome to our scene. Enjoy your visit!", isEndOfDialog: true } as Dialog
    ],
    onActivate: () => console.log('Greeter activated')
  }
)
```

### Multi-Branch Dialog

```typescript
const dialogs: Dialog[] = [
  { text: 'Greetings! I know many things.', isQuestion: true, buttons: [
    { label: 'Tell me about the forest', goToDialog: 1 },
    { label: 'Tell me about the castle', goToDialog: 3 },
    { label: 'Goodbye', goToDialog: 5 }
  ]} as unknown as Dialog,
  { text: 'The forest is ancient and full of mysteries.' } as Dialog,
  { text: 'Many creatures dwell within. Be careful!', isEndOfDialog: true } as Dialog,
  { text: 'The castle was built centuries ago by a powerful king.' } as Dialog,
  { text: 'It is said treasure still lies in the dungeons.', isEndOfDialog: true } as Dialog,
  { text: 'Farewell, traveler!', isEndOfDialog: true } as Dialog
]
```

### Walking NPC (Patrol)

```typescript
import * as npc from 'dcl-npc-toolkit'

const guard = createNPC(
  { position: { x: 2, y: 0, z: 2 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
  { type: 'custom', model: 'models/guard.glb' }
)

npc.playAnimation(guard, 'Walk', true)

// Use Tween + TweenSequence for patrol (see section 5)
```

### NPC with Animations

```typescript
const dancer = createNPC(
  { position: { x: 8, y: 0, z: 8 }, rotation: { x: 0, y: 0, z: 0, w: 1 }, scale: { x: 1, y: 1, z: 1 } },
  {
    type: 'custom',
    model: 'models/dancer.glb',
    idleAnim: 'Idle',
    onActivate: () => {
      npc.playAnimation(dancer, 'Dance', true)
      // Return to idle after 5 seconds
      utils.timers.setTimeout(() => {
        npc.playAnimation(dancer, 'Idle', true)
      }, 5000)
    }
  }
)
```

### AvatarShape NPC with Emotes

For avatar-based NPCs (not GLB), use predefined emotes:

```typescript
const waver = engine.addEntity()
AvatarShape.create(waver, {
  id: 'waver-npc',
  name: 'Friendly NPC',
  expressionTriggerId: 'wave'
})
Transform.create(waver, { position: Vector3.create(8, 0.25, 8) })

// Change emote dynamically
AvatarShape.getMutable(waver).expressionTriggerId = 'clap'
```

Available emotes: `wave`, `fistpump`, `robot`, `raiseHand`, `clap`, `money`, `kiss`, `tik`, `hammer`, `tektonik`, `dontsee`, `handsair`, `shrug`, `disco`, `dab`, `headexplode`, `buttonDown`, `buttonFront`, `getHit`, `knockOut`, `lever`, `openChest`, `openDoor`, `punch`, `push`, `swingWeaponOneHand`, `swingWeaponTwoHands`, `throw`, `sittingChair1`, `sittingChair2`, `sittingGround1`, `sittingGround2`.

## 9. Multiplayer NPC Sync

For NPCs whose state must be consistent across all players, use `syncEntity`:

```typescript
import { syncEntity } from '@dcl/sdk/network'

syncEntity(npcEntity, [Transform.componentId, AvatarShape.componentId], 1)
```

Use `MessageBus` for broadcasting NPC interaction events to all players:

```typescript
import { MessageBus } from '@dcl/sdk/message-bus'
const messageBus = new MessageBus()

messageBus.emit('npc-interaction', { npcId: 'guard-01', action: 'talked' })
messageBus.on('npc-interaction', (msg) => { /* handle */ })
```

## 10. Cross-References

- **Trigger areas** for starting NPC conversations when a player approaches (proximity-based activation) are covered in the **dcl-scene** skill.
- **UI rendering** (ReactEcsRenderer, UiEntity, Label, Button) used in shop NPC patterns is covered in Decentraland SDK7 UI documentation.
- **Tween and TweenSequence** for NPC movement are part of the core `@dcl/sdk/ecs` module.
