# Decentraland Scene Limitations & Optimization Reference

## Full Scene Limits Table

All limits are based on parcel count `n`. Each parcel is 16m x 16m.

### Linear Scaling (n x multiplier)

| Parcels | Triangles (n x 10,000) | Entities (n x 200) | Physics Bodies (n x 300) | Draw Calls (n x 300) |
|---|---|---|---|---|
| 1 | 10,000 | 200 | 300 | 300 |
| 2 | 20,000 | 400 | 600 | 600 |
| 3 | 30,000 | 600 | 900 | 900 |
| 4 | 40,000 | 800 | 1,200 | 1,200 |
| 5 | 50,000 | 1,000 | 1,500 | 1,500 |
| 6 | 60,000 | 1,200 | 1,800 | 1,800 |
| 8 | 80,000 | 1,600 | 2,400 | 2,400 |
| 9 | 90,000 | 1,800 | 2,700 | 2,700 |
| 10 | 100,000 | 2,000 | 3,000 | 3,000 |
| 12 | 120,000 | 2,400 | 3,600 | 3,600 |
| 16 | 160,000 | 3,200 | 4,800 | 4,800 |
| 20 | 200,000 | 4,000 | 6,000 | 6,000 |

### Logarithmic Scaling (log2(n+1) x multiplier)

| Parcels | log2(n+1) | Materials (x 20) | Textures (x 10) | Height Limit (x 20m) |
|---|---|---|---|---|
| 1 | 1.00 | 20 | 10 | 20m |
| 2 | 1.58 | 31 | 15 | 31m |
| 3 | 2.00 | 40 | 20 | 40m |
| 4 | 2.32 | 46 | 23 | 46m |
| 5 | 2.58 | 51 | 25 | 51m |
| 6 | 2.81 | 56 | 28 | 56m |
| 8 | 3.17 | 63 | 31 | 63m |
| 9 | 3.32 | 66 | 33 | 66m |
| 10 | 3.46 | 69 | 34 | 69m |
| 12 | 3.70 | 74 | 37 | 74m |
| 16 | 4.09 | 81 | 40 | 81m |
| 20 | 4.39 | 87 | 43 | 87m |

### File Limits

| Constraint | Limit |
|---|---|
| File size per parcel | 15 MB |
| Maximum total file size | 300 MB |
| Files per parcel | 200 |
| Maximum individual file size | 50 MB |

## Texture Specifications

### Dimension Requirements
- All texture dimensions **must be powers of two**: 64, 128, 256, 512, 1024, 2048.
- Non-power-of-two textures are resized at runtime, wasting memory and causing artifacts.
- Textures do not need to be square (512x1024 is valid).

### Recommended Sizes
| Use Case | Recommended Size | Maximum |
|---|---|---|
| Scene objects (walls, floors) | 1024x1024 | 2048x2048 |
| Props and furniture | 512x512 | 1024x1024 |
| Wearables | 512x512 | 1024x1024 |
| UI elements / icons | 256x256 | 512x512 |
| Skybox / environment | 1024x1024 | 2048x2048 |

### Texture Optimization Tips
- Prefer WebP format over PNG for smaller file size.
- Use texture atlases: combine multiple small textures into one larger texture and adjust UVs. This reduces both texture count and material count.
- Avoid alpha transparency when possible. Transparent textures require additional draw calls.
- Reuse texture references across materials to avoid duplicate downloads.

## Model Optimization Guidelines

### Triangle Budget Planning
Reserve your triangle budget across categories:

| Category | Suggested Budget Share |
|---|---|
| Environment (terrain, walls, floors) | 40% |
| Props and decorations | 25% |
| Interactive objects | 20% |
| Characters / NPCs | 10% |
| Particle effects / UI meshes | 5% |

### Mesh Optimization
- **Merge static meshes** in Blender before export. 10 merged objects with 1 material are far cheaper than 10 separate objects with 10 materials.
- **Remove hidden faces**: Delete faces players will never see (bottoms of objects sitting on floors, backs against walls).
- **Use Blender's Decimate modifier** to reduce triangle count on detailed models. Target 30-50% reduction for background props.
- **Avoid n-gons**: Ensure all faces are triangulated or quad-based before export.

### Export Settings (Blender to glTF)
- Export as `.glb` (binary glTF) for smaller files.
- Enable Draco compression when available.
- Apply all transforms before export (Ctrl+A in Blender).
- Ensure scale is correct (1 Blender unit = 1 meter in DCL).

## Draw Call Budget and Reduction

### What Counts as a Draw Call
Each unique combination of (mesh + material) rendered in a frame is one draw call. An object with 3 materials = 3 draw calls.

### Reduction Techniques

1. **Merge meshes sharing the same material** in Blender. This is the single most effective optimization.
2. **Use texture atlases**: One atlas material for many objects instead of unique materials per object.
3. **Limit unique materials**: Target under 20 unique materials for a 1-parcel scene.
4. **Minimize transparency**: Transparent materials require separate rendering passes.
5. **Use instancing**: Multiple copies of the same GLB with the same material share instanced draw calls (the engine handles this automatically for identical GltfContainer references).
6. **Reduce light sources**: Each additional light increases draw calls. Use baked lighting where possible.

## AssetLoad API Reference

### Purpose
Pre-download assets before they are rendered to prevent visible pop-in during gameplay.

### Import
```typescript
import { AssetLoad, LoadingState } from '@dcl/sdk/ecs'
```

### Creating a Preload Request
```typescript
const preloadEntity = engine.addEntity()
AssetLoad.create(preloadEntity, {
  src: 'models/my-model.glb'
})
```

### Loading States
| State | Meaning |
|---|---|
| `LoadingState.LOADING` | Asset is being downloaded |
| `LoadingState.FINISHED` | Asset is cached and ready |
| `LoadingState.FINISHED_WITH_ERROR` | Download failed |

### Tracking Pattern
```typescript
function assetLoadingSystem(dt: number) {
  for (const [entity] of engine.getEntitiesWith(AssetLoad)) {
    const state = AssetLoad.get(entity)
    switch (state.loadingState) {
      case LoadingState.FINISHED:
        // Safe to render — create GltfContainer, AudioSource, etc.
        GltfContainer.create(entity, { src: state.src })
        AssetLoad.deleteFrom(entity)
        break
      case LoadingState.FINISHED_WITH_ERROR:
        console.error(`Failed to load: ${state.src}`)
        AssetLoad.deleteFrom(entity)
        break
      // LoadingState.LOADING — still waiting, do nothing
    }
  }
}
engine.addSystem(assetLoadingSystem)
```

### When to Use AssetLoad
- Models over 1 MB
- Audio files used in gameplay (preload so they play without delay)
- Any asset needed at the start of a game phase (preload during the lobby/countdown)

## Entity Pooling Implementation

Entity creation and destruction are expensive. For objects that appear and disappear frequently (projectiles, collectibles, effects), use a pool.

```typescript
import { engine, Entity } from '@dcl/sdk/ecs'
import { Transform, MeshRenderer, VisibilityComponent } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

class EntityPool {
  private available: Entity[] = []
  private active: Set<Entity> = new Set()

  constructor(
    private size: number,
    private setup: (entity: Entity) => void
  ) {
    for (let i = 0; i < size; i++) {
      const entity = engine.addEntity()
      setup(entity)
      this.hide(entity)
      this.available.push(entity)
    }
  }

  acquire(): Entity | undefined {
    const entity = this.available.pop()
    if (!entity) return undefined // Pool exhausted
    this.active.add(entity)
    VisibilityComponent.createOrReplace(entity, { visible: true })
    return entity
  }

  release(entity: Entity): void {
    if (!this.active.has(entity)) return
    this.active.delete(entity)
    this.hide(entity)
    this.available.push(entity)
  }

  private hide(entity: Entity): void {
    Transform.getMutable(entity).position = Vector3.create(0, -100, 0)
    VisibilityComponent.createOrReplace(entity, { visible: false })
  }

  get activeCount(): number { return this.active.size }
  get availableCount(): number { return this.available.length }
}

// Usage
const bulletPool = new EntityPool(20, (entity) => {
  MeshRenderer.setSphere(entity)
  Transform.create(entity, { position: Vector3.create(0, -100, 0) })
})

// Acquire when firing
const bullet = bulletPool.acquire()
if (bullet) {
  Transform.getMutable(bullet).position = playerPosition
}

// Release when bullet hits or expires
bulletPool.release(bullet)
```

## LOD Implementation Pattern

Swap model detail levels based on player distance to save triangles and draw calls.

```typescript
import { engine, Entity } from '@dcl/sdk/ecs'
import { Transform, GltfContainer, VisibilityComponent } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

// Define LOD thresholds
const LOD_NEAR = 10    // Full detail within 10m
const LOD_MID = 25     // Medium detail 10-25m
const LOD_FAR = 50     // Low detail 25-50m — beyond 50m, hide

// Custom component to track LOD state
const LodObject = engine.defineComponent('LodObject', {
  modelHigh: Schemas.String,
  modelMid: Schemas.String,
  modelLow: Schemas.String,
  currentLod: Schemas.Number  // 0=high, 1=mid, 2=low, 3=hidden
})

function lodSystem(dt: number) {
  const playerPos = Transform.get(engine.PlayerEntity).position

  for (const [entity] of engine.getEntitiesWith(LodObject, Transform)) {
    const lod = LodObject.getMutable(entity)
    const pos = Transform.get(entity).position
    const distance = Vector3.distance(playerPos, pos)

    let targetLod: number
    if (distance < LOD_NEAR) targetLod = 0
    else if (distance < LOD_MID) targetLod = 1
    else if (distance < LOD_FAR) targetLod = 2
    else targetLod = 3

    if (targetLod !== lod.currentLod) {
      lod.currentLod = targetLod
      switch (targetLod) {
        case 0:
          GltfContainer.createOrReplace(entity, { src: lod.modelHigh })
          VisibilityComponent.createOrReplace(entity, { visible: true })
          break
        case 1:
          GltfContainer.createOrReplace(entity, { src: lod.modelMid })
          VisibilityComponent.createOrReplace(entity, { visible: true })
          break
        case 2:
          GltfContainer.createOrReplace(entity, { src: lod.modelLow })
          VisibilityComponent.createOrReplace(entity, { visible: true })
          break
        case 3:
          VisibilityComponent.createOrReplace(entity, { visible: false })
          break
      }
    }
  }
}
engine.addSystem(lodSystem)
```

**Important**: Run the LOD system at a reduced frequency (every 0.5s) using a timer, not every frame.

## System Performance Best Practices

### Reduce System Frequency
```typescript
let elapsed = 0
function expensiveSystem(dt: number) {
  elapsed += dt
  if (elapsed < 0.25) return  // Run 4 times per second, not 30+
  elapsed = 0
  // ... do work
}
```

### Minimize Allocations
```typescript
// BAD: allocates a new Vector3 every frame
function moveSystem(dt: number) {
  const direction = Vector3.create(1, 0, 0)  // New object each frame
}

// GOOD: reuse a pre-allocated vector
const direction = Vector3.create(1, 0, 0)
function moveSystem(dt: number) {
  // Use 'direction' without reallocating
}
```

### Cache Entity Queries
```typescript
// BAD: queries all entities every frame
function systemBad(dt: number) {
  for (const [entity] of engine.getEntitiesWith(MyComponent, Transform)) {
    // ...
  }
}

// The engine already optimizes getEntitiesWith internally, but avoid
// adding unnecessary extra component filters that force wider scans.
```

### Limit Active Systems
- Remove systems when they are not needed: `engine.removeSystem(mySystem)`
- Add them back when needed: `engine.addSystem(mySystem)`
- Idle scenes should have minimal active systems.

## Common Performance Pitfalls and Fixes

| Pitfall | Symptom | Fix |
|---|---|---|
| Too many unique materials | High draw calls, low FPS | Merge into texture atlases, reuse materials |
| Non-power-of-two textures | Memory bloat, visual artifacts | Resize all textures to 256/512/1024/2048 |
| Creating/destroying entities rapidly | Frame stutters | Use entity pooling |
| Heavy computation every frame | Consistent low FPS | Add timer guards, reduce frequency |
| Unused colliders on decorations | Physics body limit exceeded | Remove MeshCollider from non-interactive objects |
| Large uncompressed textures | Slow loading, file size exceeded | Use WebP, reduce resolution, use atlases |
| Too many transparent materials | Extra draw calls, sorting issues | Minimize transparency, use alpha cutoff instead of blend |
| Unbounded entity queries | CPU spike | Filter with specific components, cache results |
| All detail loaded at all distances | Triangle budget blown | Implement LOD system |
| No asset preloading | Pop-in during gameplay | Use AssetLoad for large models and audio |

## Scene Statistics Monitoring

### In Preview Mode
When running the scene locally with `npm run start`, open the debug panel to view live stats:
- Press **P** to toggle the performance panel.
- Monitor: FPS, draw calls, triangles, entities, materials, textures, memory.
- Scene limits are shown alongside current usage with green/yellow/red indicators.

### Programmatic Checking
There is no runtime API to query scene stats from within scene code. Use the preview debug panel or the Creator Hub scene inspector for monitoring.

### What to Watch
- **FPS below 30**: Something is too expensive. Check draw calls and system execution time.
- **Triangle count approaching limit**: Enable LOD, reduce model detail, remove hidden faces.
- **Entity count climbing**: Likely a leak — entities being created but never destroyed. Implement pooling.
- **Draw calls above budget**: Too many materials. Merge, atlas, and reduce transparency.

## Recommended Tools for Asset Optimization

### Blender (3D Models)
- **Decimate modifier**: Reduce triangle count on imported models. Use "Collapse" mode for best results.
- **Limited Dissolve**: Remove unnecessary vertices from flat surfaces (Edit Mode > Mesh > Clean Up > Limited Dissolve).
- **Material consolidation**: Merge materials that use the same texture. Reduces draw calls.
- **UV packing**: Combine UVs from multiple objects onto one atlas texture.
- Export as `.glb` with Draco compression enabled.

### Texture Compression Tools
- **Squoosh** (squoosh.app): Browser-based tool for converting images to WebP and resizing to power-of-two dimensions.
- **TexturePacker**: Creates texture atlases from multiple source images. Outputs atlas image + UV coordinate mappings.
- **GIMP / Photoshop**: Manual resizing and format conversion. Use "Image > Canvas Size" to pad to power-of-two if needed.

### glTF Tools
- **gltf-transform** (CLI): Optimize glTF/GLB files — compress textures, merge meshes, strip unused data.
  ```bash
  npx @gltf-transform/cli optimize input.glb output.glb --compress draco
  ```
- **glTF Validator** (github.khronos.org/glTF-Validator): Check for spec compliance issues before importing into DCL.

### In-Engine Tools
- **Creator Hub Scene Inspector**: Visual tool for checking entity counts, triangle counts, and placement within parcel boundaries.
- **Preview Debug Panel**: Press P during `npm run start` to see live performance metrics.
