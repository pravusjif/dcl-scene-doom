# Setup, Debugging & Optimization

## Project Setup

### CLI Installation

```bash
npm install -g @dcl/sdk-commands
```

### Creating a New Scene

```bash
npx @dcl/sdk-commands init
```

### Basic Imports

```typescript
import { engine } from '@dcl/sdk/ecs'
import { Transform, GltfContainer, MeshRenderer, Material } from '@dcl/sdk/ecs'
import { Vector3, Quaternion, Color4 } from '@dcl/sdk/math'
import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'
```

### Development Workflow

```bash
# Preview scene
npm run start

# Preview options
npm run start -- --web3          # Connect to browser wallet
npm run start -- --no-debug      # Disable debug panel
npm run start -- --explorer-alpha # Use Decentraland Desktop client
npm run start -- --port 8080     # Specific port

# Build scene
npm run build

# Deploy
npm run deploy

# Deploy to test server
npm run deploy -- --target-content https://peer-testing.decentraland.org/content

# Deploy to custom world
npm run deploy -- --target worlds-content-server.decentraland.org/world/your-world-name
```

### Update SDK

```bash
npm install @dcl/sdk@latest
```

## scene.json Configuration

```json
{
  "display": {
    "title": "My Scene",
    "description": "A Decentraland experience",
    "author": "Your Name",
    "navmapThumbnail": "images/scene-thumbnail.png"
  },
  "main": "bin/game.js",
  "tags": ["game", "interactive"],
  "scene": {
    "parcels": ["0,0"],
    "base": "0,0"
  },
  "spawningPoints": [
    {
      "name": "spawn1",
      "default": true,
      "position": { "x": 8, "y": 0, "z": 8 },
      "cameraTarget": { "x": 8, "y": 1, "z": 12 }
    }
  ],
  "requiredPermissions": [
    "ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE",
    "ALLOW_TO_TRIGGER_AVATAR_EMOTE"
  ]
}
```

### Multiple Parcels

```json
{
  "scene": {
    "parcels": ["0,0", "1,0", "0,1", "1,1"],
    "base": "0,0"
  }
}
```

### Worlds (Single Player)

```json
{
  "worldConfiguration": {
    "name": "my-world.dcl.eth",
    "fixedAdapter": "offline:offline"
  }
}
```

## Debugging

### Console Logging

```typescript
console.log('Debug:', data)
console.log('Entity transform:', {
  entity: entity,
  position: Transform.get(entity).position,
  rotation: Transform.get(entity).rotation
})
```

### Common Issues

**Entity not visible:**
- Verify it has both `Transform` and a shape component (MeshRenderer or GltfContainer)
- Check position is within scene bounds
- Check `VisibilityComponent` is not set to false

**Click events not working:**
- Entity needs a collider: `MeshCollider.setBox(entity, ColliderLayer.CL_POINTER)`
- Or set `visibleMeshesCollisionMask: ColliderLayer.CL_POINTER` on `GltfContainer`
- Check `maxDistance` in pointer event options

**Scene bounds:**
- Single parcel: 0 to 16 on X and Z axes
- Entities outside bounds are not rendered

### Performance Monitoring

```typescript
function performanceSystem(dt: number) {
  if (dt > 0.033) {  // More than 30ms per frame
    console.log('Performance warning: Frame time:', dt * 1000, 'ms')
  }
}
engine.addSystem(performanceSystem)
```

## AssetLoad (Preloading)

Pre-download assets at scene startup to avoid loading hitches:

```typescript
AssetLoad.create(preloadEntity, { src: 'models/heavy.glb' })

// Track loading progress with assetLoadLoadingStateSystem and LoadingState
```

## Scene Limitation Formulas

For `n` parcels:

| Resource | Formula | 1 parcel | 4 parcels |
|----------|---------|----------|-----------|
| Triangles | n x 10,000 | 10,000 | 40,000 |
| Entities | n x 200 | 200 | 800 |
| Bodies | n x 300 | 300 | 1,200 |
| Materials | log2(n+1) x 20 | 20 | ~46 |
| Textures | log2(n+1) x 10 | 10 | ~23 |
| Height | log2(n+1) x 20 meters | 20m | ~46m |
| File size | 15 MB per parcel | 15 MB | 60 MB |
| Max file size | 300 MB total | - | - |
| Files | 200 per parcel | 200 | 800 |
| Max file | 50 MB per file | - | - |

## Optimization Techniques

### Object Pooling

```typescript
class EntityPool {
  private pool: Entity[] = []

  get(): Entity {
    if (this.pool.length > 0) return this.pool.pop()!
    return engine.addEntity()
  }

  release(entity: Entity) {
    Transform.getMutable(entity).position = Vector3.create(0, -100, 0)
    this.pool.push(entity)
  }
}
```

### Distance-Based Visibility Culling

```typescript
engine.addSystem(() => {
  const playerPos = Transform.get(engine.PlayerEntity).position

  for (const [entity, transform] of engine.getEntitiesWith(Transform, VisibilityComponent)) {
    const distance = Vector3.distance(playerPos, transform.position)
    VisibilityComponent.getMutable(entity).visible = distance <= 20
  }
})
```

### LOD (Level of Detail)

```typescript
function lodSystem() {
  const playerPos = Transform.get(engine.PlayerEntity).position

  for (const [entity, transform] of engine.getEntitiesWith(Transform, MeshRenderer)) {
    const distance = Vector3.distance(playerPos, transform.position)

    if (distance > 30) {
      VisibilityComponent.createOrReplace(entity, { visible: false })
    } else {
      VisibilityComponent.createOrReplace(entity, { visible: true })
    }
  }
}
engine.addSystem(lodSystem)
```

### Texture Optimization

```typescript
// Use compressed formats (WebP instead of PNG)
Material.setPbrMaterial(entity, {
  texture: Material.Texture.Common({
    src: 'assets/compressed_texture.webp',
    filterMode: TextureFilterMode.TFM_TRILINEAR
  })
})

// Share textures between materials
const sharedTex = Material.Texture.Common({ src: 'assets/shared.webp' })
Material.setPbrMaterial(entity1, { texture: sharedTex })
Material.setPbrMaterial(entity2, { texture: sharedTex })
```

### Performance Targets

- 30 FPS minimum
- Less than 100ms system execution per frame
- Reasonable memory usage
- Use 512x512 textures recommended, 1024x1024 maximum

## Publishing Requirements

- Own LAND tokens, Decentraland NAME, or ENS name (or have permissions from LAND owner)
- Scene must fit within parcel bounds
- All assets under size limits
- Title, description, and preview image required
- Spawn points defined in scene.json
