---
name: dcl-wearables
description: "Assists with Decentraland SDK7 smart wearables and portable experiences when the user mentions smart wearables, portable experiences, wearable.json, wearable projects, wearable publishing, ENS names, spawn portable, kill portable, wearable categories, rarity, or wearable slots."
---

# Decentraland SDK7 Smart Wearables & Portable Experiences

## Project Types Decision Guide

Decentraland SDK7 supports three project types. Choose based on deployment target and behavior:

### Scene
- Deploys to LAND parcels (owned or rented)
- Uses `scene.json` as manifest
- Full scene capabilities: multiple parcels, all media types, unlimited entities (within parcel budget)
- Players visit the scene by navigating to the parcel coordinates

### Smart Wearable
- A wearable item (clothing, accessory) with attached scene logic
- Uses `wearable.json` as manifest
- Runs automatically when the player equips the wearable
- Single-parcel equivalent resource limits
- Code executes relative to the player, not world coordinates
- Cannot use VideoPlayer or AudioStream

### Portable Experience
- A standalone scene that runs as an overlay on top of whatever scene the player is in
- Can be spawned programmatically by other scenes or by smart wearables
- Ideal for HUDs, cross-scene tools, companion systems
- Same single-parcel resource limits as smart wearables
- Persists across scene boundaries until explicitly killed

**When to use which:**
- Building an environment or game on LAND? Use a **Scene**.
- Want logic triggered when a player wears an item? Use a **Smart Wearable**.
- Need persistent UI or cross-scene functionality? Use a **Portable Experience**.

## Smart Wearable Setup

### Creating a New Project

```bash
npx @dcl/sdk-commands init --project smart-wearable
```

This scaffolds a project with `wearable.json` instead of `scene.json`.

### wearable.json Schema

```json
{
  "id": "urn:decentraland:off-chain:base-avatars:my_wearable",
  "name": "My Wearable",
  "description": "A smart wearable with scene logic",
  "rarity": "epic",
  "data": {
    "category": "upper_body",
    "replaces": ["lower_body"],
    "hides": ["hair"],
    "tags": ["sci-fi"],
    "representations": [
      {
        "bodyShapes": ["urn:decentraland:off-chain:base-avatars:BaseMale"],
        "mainFile": "model.glb",
        "contents": ["model.glb", "texture.png"],
        "overrideReplaces": [],
        "overrideHides": []
      },
      {
        "bodyShapes": ["urn:decentraland:off-chain:base-avatars:BaseFemale"],
        "mainFile": "model_female.glb",
        "contents": ["model_female.glb", "texture.png"],
        "overrideReplaces": [],
        "overrideHides": []
      }
    ]
  }
}
```

## Wearable Categories

All valid values for `data.category`:

| Category | Slot |
|---|---|
| `eyebrows` | Face |
| `eyes` | Face |
| `facial_hair` | Face |
| `hair` | Head |
| `mouth` | Face |
| `upper_body` | Torso |
| `lower_body` | Legs |
| `feet` | Feet |
| `earring` | Ears |
| `eyewear` | Eyes |
| `hat` | Head |
| `helmet` | Head |
| `mask` | Face |
| `tiara` | Head |
| `top_head` | Head |
| `skin` | Full body |
| `hands_wear` | Hands |

## Rarity Tiers

| Rarity | Max Minting Supply |
|---|---|
| `unique` | 1 |
| `mythic` | 10 |
| `exotic` | 50 |
| `legendary` | 100 |
| `epic` | 1,000 |
| `uncommon` | 10,000 |
| `common` | 100,000 |

Higher rarity requires more MANA to publish. Rarity cannot be changed after minting.

## Slot Conflicts

### `data.replaces`
Physically replaces another category's geometry. When the wearable is equipped, the replaced category's model is removed entirely. Example: a full-body suit with `"replaces": ["lower_body", "feet"]`.

### `data.hides`
Visually hides another category without replacing it. The hidden item remains equipped but is not rendered. Example: a helmet with `"hides": ["hair", "facial_hair"]`.

### Per-Representation Overrides
Each representation can override the top-level replaces/hides:
- `overrideReplaces` — if non-empty, replaces the top-level `replaces` for that body shape
- `overrideHides` — if non-empty, replaces the top-level `hides` for that body shape

This allows different conflict behavior for male vs. female body shapes.

## Wearable Constraints

| Resource | Limit |
|---|---|
| Total uncompressed size | 3 MB |
| Triangle count | 10,000 |
| Max entities | 200 |
| Texture dimensions | Power-of-two, 512x512 recommended |
| Materials | PBR only, max 2 per mesh |
| Bones (skinned meshes) | Max 4 per vertex |

**Disallowed features in smart wearables:**
- `VideoPlayer` component (no video streaming)
- `AudioStream` component (no audio streaming)
- Use `AudioSource` for sound playback instead

**Scene code sandbox:**
- Runs in a single-parcel equivalent sandbox
- Has access to the player entity at all times
- Positions are relative to the player, not world origin
- Can use `ReactEcsRenderer` for UI overlays
- Uses the same SDK7 APIs as regular scenes (ECS, components, systems)

## Publishing Workflow

1. **Develop and test locally:**
   ```bash
   npm run start
   ```
   Preview runs in the browser with hot reload.

2. **Build the wearable package:**
   ```bash
   npm run pack
   ```
   Generates `smart-wearable.zip` containing the compiled code and assets.

3. **Upload to Decentraland Builder:**
   - Go to the Decentraland Builder (builder.decentraland.org)
   - Create or select a collection
   - Upload the zip file
   - Set price, rarity, and metadata

4. **Requirements for publishing:**
   - MANA tokens for minting (amount varies by rarity tier)
   - Ethereum address or ENS name for the collection
   - Collection must be approved by the Decentraland curation committee
   - Each item needs at least one representation (BaseMale or BaseFemale)

5. **ENS names for collections:**
   - Collections can use a `.dcl.eth` ENS subdomain
   - The ENS name identifies the collection on-chain
   - Required for spawning portable experiences by ENS

## Portable Experience APIs

### Imports

```typescript
import {
  spawn,
  kill,
  getPortableExperiencesLoaded
} from '~system/PortableExperiences'
```

### Spawning

```typescript
// Spawn by ENS name
const result = await spawn({ ens: 'my-tool.dcl.eth' })

// Spawn by URN / pid
const result = await spawn({ pid: 'urn:decentraland:off-chain:...' })
```

The `result` contains a `pid` field identifying the running instance.

### Killing

```typescript
await kill({ pid: 'urn:decentraland:off-chain:...' })
```

### Listing Active Portable Experiences

```typescript
const loaded = await getPortableExperiencesLoaded()
// Returns { loaded: Array<{ pid: string, name: string, ens?: string }> }
```

## Feature Toggles

Scenes can control whether portable experiences run within their parcels:

```json
// scene.json
{
  "featureToggles": {
    "portableExperiences": "disabled"
  }
}
```

Valid values:
- `"enabled"` (default) — all portable experiences allowed
- `"disabled"` — no portable experiences run in this scene
- `"hideUi"` — portable experiences run but their UI is hidden

Smart wearables can also hide their own UI contextually using the `ReactEcsRenderer` visibility controls.

## Common Patterns

### Equip-Triggered Effect
A smart wearable that plays a particle effect when the player equips it:
```typescript
import { engine, Transform, GltfContainer } from '@dcl/sdk/ecs'

// The wearable code runs as soon as the item is equipped.
// Create an entity attached near the player.
const effectEntity = engine.addEntity()
Transform.create(effectEntity, { position: { x: 0, y: 1, z: 0 } })
GltfContainer.create(effectEntity, { src: 'models/particle_effect.glb' })
```

### Companion Pet
A smart wearable that spawns a following entity:
```typescript
import { engine, Transform, GltfContainer } from '@dcl/sdk/ecs'
import { getPlayer } from '@dcl/sdk/src/players'

const pet = engine.addEntity()
GltfContainer.create(pet, { src: 'models/pet.glb' })
Transform.create(pet, { position: { x: 0, y: 0, z: -1.5 } })

// System to make pet follow (positions are relative to player)
engine.addSystem((dt) => {
  const transform = Transform.getMutable(pet)
  // Smoothly follow behind the player
  transform.position.z = -1.5
})
```

### HUD Overlay (Portable Experience)
A portable experience showing persistent UI across scenes:
```typescript
import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'

ReactEcsRenderer.setUiRenderer(() => (
  <UiEntity
    uiTransform={{ width: 200, height: 50, positionType: 'absolute', position: { top: 10, right: 10 } }}
    uiBackground={{ color: { r: 0, g: 0, b: 0, a: 0.7 } }}
  >
    <Label value="Portable HUD Active" fontSize={14} />
  </UiEntity>
))
```

### Cross-Scene Tool (Portable Experience)
A portable experience providing utility functions that persist across scene boundaries:
```typescript
import { engine, InputAction, inputSystem, PointerEventType } from '@dcl/sdk/ecs'
import { getPlayer } from '@dcl/sdk/src/players'
import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'

// Persistent coordinate display tool
engine.addSystem(() => {
  const player = getPlayer()
  if (player) {
    // Update UI with current coordinates
    updateCoordinateDisplay(player.position)
  }
})
```

## Smart Wearable Scene Code Notes

Smart wearable code uses the same SDK7 APIs as regular scenes with these key differences:

1. **Coordinate space** — All positions are relative to the player, not world coordinates. `{ x: 0, y: 0, z: 0 }` is the player's position.
2. **Always has player access** — The player entity is always available since the wearable is equipped.
3. **UI support** — Full `ReactEcsRenderer` support for HUD elements.
4. **No parcel boundaries** — The wearable follows the player everywhere, no scene boundaries apply to the logic.
5. **Lifecycle** — Code starts when the wearable is equipped and stops when unequipped. No `onEnterScene`/`onLeaveScene` events.
6. **Single-parcel budget** — Despite following the player everywhere, resource limits match a single parcel.
