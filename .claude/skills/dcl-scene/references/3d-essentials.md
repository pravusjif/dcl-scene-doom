# 3D Essentials

## Transform Component

```typescript
Transform.create(entity, {
  position: Vector3.create(8, 1, 8),    // World position in meters
  rotation: Quaternion.fromEulerDegrees(0, 90, 0),
  scale: Vector3.create(2, 2, 2),
  parent: parentEntity                   // Optional parent
})
```

- Measured in meters. Scene coordinates: (0,0,0) is south-west corner at ground level.
- Single parcel: 16m x 16m. Scene center: (8, 0, 8) for single parcel.

### Rotation

```typescript
// Euler angles (degrees)
Quaternion.fromEulerDegrees(0, 90, 0)

// Direct quaternion
Quaternion.create(0, 0.707, 0, 0.707)

// Get euler from quaternion
Quaternion.toEuler(rotation)

// Look at target
const direction = Vector3.subtract(target, transform.position)
transform.rotation = Quaternion.lookRotation(Vector3.normalize(direction))
```

## Primitive Shapes (MeshRenderer)

```typescript
MeshRenderer.setBox(entity)
MeshRenderer.setSphere(entity)
MeshRenderer.setPlane(entity)
MeshRenderer.setCylinder(entity)
MeshRenderer.setCylinder(entity, 0, 1)  // Cone (radiusTop=0)
```

### Custom UV Mapping

```typescript
MeshRenderer.setPlane(entity, [
  0, 0.75,    // Bottom-left
  0.25, 0.75, // Bottom-right
  0.25, 1,    // Top-right
  0, 1        // Top-left
])
```

## 3D Models (GltfContainer)

```typescript
GltfContainer.create(entity, {
  src: 'models/house.glb'
})

// With collision masks
GltfContainer.create(entity, {
  src: 'models/house.glb',
  visibleMeshesCollisionMask: ColliderLayer.CL_POINTER,
  invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
})

// Check loading state
const loadingState = GltfContainerLoadingState.getOrNull(entity)
if (loadingState?.currentState === LoadingState.FINISHED) {
  // Model loaded
}
```

## GLTF Node Modifiers (Advanced)

`GltfNodeModifiers` allows per-node material overrides on loaded GLTF models. Import from `@dcl/sdk/ecs`. Apply to an entity that has `GltfContainer`:

```typescript
import { GltfNodeModifiers, GltfContainer } from '@dcl/sdk/ecs'

const model = engine.addEntity()
GltfContainer.create(model, { src: 'models/myModel.glb' })
Transform.create(model, { position: Vector3.create(4, 0, 4) })

GltfNodeModifiers.create(model, {
  modifiers: [
    {
      path: '',  // empty string = whole model; use node name to target specific mesh
      material: {
        material: {
          $case: 'pbr',
          pbr: {
            albedoColor: Color4.Red()
          }
        }
      }
    }
  ]
})
```

Set `path` to a specific mesh node name to target only that part. Use `Material.Texture.Common({ src: '...' })` inside `pbr` to swap textures.

## Materials

### PBR Materials (Physically-Based)

```typescript
Material.setPbrMaterial(entity, {
  albedoColor: Color4.create(1, 0, 0, 1),
  metallic: 0.8,
  roughness: 0.2,
  emissiveColor: Color4.create(0, 1, 0, 1),
  transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND
})
```

### Basic Materials (Unlit)

```typescript
Material.setBasicMaterial(entity, {
  diffuseColor: Color4.Red()
})
```

### Textures

```typescript
Material.setPbrMaterial(entity, {
  texture: Material.Texture.Common({
    src: 'assets/textures/wood.png',
    filterMode: TextureFilterMode.TFM_BILINEAR,
    wrapMode: TextureWrapMode.TWM_REPEAT
  })
})

// Multi-layer textures
Material.setPbrMaterial(entity, {
  texture: Material.Texture.Common({ src: 'assets/diffuse.png' }),
  bumpTexture: Material.Texture.Common({ src: 'assets/normal.png' }),
  emissiveTexture: Material.Texture.Common({ src: 'assets/emissive.png' })
})

// Avatar portraits
Material.setPbrMaterial(entity, {
  texture: Material.Texture.Avatar({ userId: '0x123...abc' })
})
```

### Transparency

```typescript
// Alpha blend
Material.setPbrMaterial(entity, {
  albedoColor: Color4.create(1, 0, 0, 0.5),
  transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND
})

// Alpha test (cutout)
Material.setPbrMaterial(entity, {
  texture: Material.Texture.Common({ src: 'assets/cutout.png' }),
  transparencyMode: MaterialTransparencyMode.MTM_ALPHA_TEST,
  alphaTest: 0.5
})
```

## Colliders

```typescript
MeshCollider.setBox(entity)
MeshCollider.setSphere(entity)
MeshCollider.setPlane(entity)
MeshCollider.setCylinder(entity)

// Specific collision layer
MeshCollider.setBox(entity, ColliderLayer.CL_PHYSICS)
MeshCollider.setBox(entity, ColliderLayer.CL_POINTER)

// Combine layers
const combined = ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER
```

### Collision Layers
- `CL_NONE` -- no collision
- `CL_POINTER` -- pointer/click events
- `CL_PHYSICS` -- player movement blocking
- `CL_PLAYER` -- player avatar body
- `CL_CUSTOM1` through `CL_CUSTOM8` -- custom layers

## Billboard

```typescript
Billboard.create(entity, {
  billboardMode: BillboardMode.BM_Y  // Only rotate on Y axis (most common)
})

// Modes: BM_ALL, BM_NONE, BM_X, BM_Y, BM_Z
```

## Visibility

```typescript
VisibilityComponent.create(entity, { visible: false })

// Toggle
const vis = VisibilityComponent.getMutable(entity)
vis.visible = !vis.visible
```

## TextShape

```typescript
TextShape.create(entity, {
  text: 'Hello World!',
  fontSize: 24,
  fontWeight: 'bold',
  color: Color4.White(),
  outlineColor: Color4.Black(),
  outlineWidth: 0.1,
  textAlign: TextAlignMode.TAM_MIDDLE_CENTER,
  width: 4,
  height: 2,
  textWrapping: true
})
```

Text alignment: `TAM_TOP_LEFT`, `TAM_TOP_CENTER`, `TAM_TOP_RIGHT`, `TAM_MIDDLE_LEFT`, `TAM_MIDDLE_CENTER`, `TAM_MIDDLE_RIGHT`, `TAM_BOTTOM_LEFT`, `TAM_BOTTOM_CENTER`, `TAM_BOTTOM_RIGHT`.

## NftShape

```typescript
NftShape.create(entity, {
  urn: 'urn:decentraland:ethereum:erc721:0x06012c8cf97bead5deae237070f9587f8e7a266d:558536',
  color: Color4.White(),
  style: NftFrameType.NFT_CLASSIC
})
```

Frame styles: `NFT_CLASSIC`, `NFT_BAROQUE_ORNAMENT`, `NFT_DIAMOND_ORNAMENT`, `NFT_MINIMAL_WIDE`, `NFT_MINIMAL_GREY`, `NFT_BLOCKY`, `NFT_GOLD_EDGES`, `NFT_GOLD_CARVED`, `NFT_GOLD_WIDE`, `NFT_GOLD_ROUNDED`, `NFT_METAL_MEDIUM`, `NFT_METAL_WIDE`, `NFT_METAL_SLIM`, `NFT_METAL_ROUNDED`, `NFT_PINS`, `NFT_MINIMAL_BLACK`, `NFT_MINIMAL_WHITE`, `NFT_TAPE`, `NFT_WOOD_SLIM`, `NFT_WOOD_WIDE`, `NFT_WOOD_TWIGS`, `NFT_CANVAS`, `NFT_NONE`.

## Avatar Attachment

```typescript
AvatarAttach.create(entity, {
  anchorPointId: AvatarAnchorPointType.AAPT_RIGHT_HAND
})

// Attach to specific player
AvatarAttach.create(entity, {
  avatarId: '0x123...abc',
  anchorPointId: AvatarAnchorPointType.AAPT_NAME_TAG
})
```

Anchor points: `AAPT_HEAD`, `AAPT_NECK`, `AAPT_LEFT_HAND`, `AAPT_RIGHT_HAND`, `AAPT_NAME_TAG`, and more.
