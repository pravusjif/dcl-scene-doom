# Wearables & Portable Experiences Reference

## Complete wearable.json Schema

```json
{
  "id": "string (URN identifier, e.g. urn:decentraland:off-chain:base-avatars:item_name)",
  "name": "string (display name, max 50 characters)",
  "description": "string (item description, max 200 characters)",
  "rarity": "unique | mythic | exotic | legendary | epic | uncommon | common",
  "i18n": [
    { "code": "en", "text": "English Name" },
    { "code": "es", "text": "Nombre en Espanol" }
  ],
  "thumbnail": "thumbnail.png (256x256 recommended)",
  "image": "image.png (optional, larger preview)",
  "collectionAddress": "0x... (Ethereum address of the collection contract)",
  "data": {
    "category": "string (one of the valid wearable categories)",
    "replaces": ["string (categories this item physically replaces)"],
    "hides": ["string (categories this item visually hides)"],
    "tags": ["string (searchable tags)"],
    "representations": [
      {
        "bodyShapes": ["string (URN of supported body shape)"],
        "mainFile": "string (primary 3D model filename)",
        "contents": ["string (all files needed for this representation)"],
        "overrideReplaces": ["string (per-shape replaces override, empty = use top-level)"],
        "overrideHides": ["string (per-shape hides override, empty = use top-level)"]
      }
    ]
  }
}
```

### Field Details

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique URN identifier for the wearable |
| `name` | Yes | Display name shown in the marketplace and inventory |
| `description` | Yes | Short description of the wearable |
| `rarity` | Yes | Determines max supply and minting cost |
| `i18n` | No | Internationalized names |
| `thumbnail` | No | 256x256 PNG thumbnail for marketplace display |
| `image` | No | Larger preview image |
| `collectionAddress` | No | Set after collection deployment |
| `data` | Yes | Contains category, conflicts, and representations |
| `data.category` | Yes | Which avatar slot the wearable occupies |
| `data.replaces` | Yes | Array of categories to physically replace (can be empty) |
| `data.hides` | Yes | Array of categories to visually hide (can be empty) |
| `data.tags` | Yes | Searchable tags for marketplace (can be empty) |
| `data.representations` | Yes | At least one representation required |

## All Wearable Categories

| Category | Description | Common Conflicts |
|---|---|---|
| `eyebrows` | Eyebrow style/shape | Rarely conflicts |
| `eyes` | Eye style/color | Rarely conflicts |
| `facial_hair` | Beard, mustache, etc. | Often hidden by `mask`, `helmet` |
| `hair` | Hair style | Often hidden by `helmet`, `hat` |
| `mouth` | Mouth/lip style | Often hidden by `mask` |
| `upper_body` | Shirt, jacket, torso clothing | May replace `lower_body` for full suits |
| `lower_body` | Pants, skirt, leg clothing | May be replaced by `upper_body` full suits |
| `feet` | Shoes, boots, footwear | May be replaced by `lower_body` full outfits |
| `earring` | Ear accessories | Often hidden by `helmet` |
| `eyewear` | Glasses, goggles | May conflict with `mask`, `helmet` |
| `hat` | Hats, caps | Conflicts with `helmet`, `tiara`, `top_head` |
| `helmet` | Full helmets | Typically hides `hair`, `facial_hair`, `earring` |
| `mask` | Face masks | Typically hides `facial_hair`, `mouth` |
| `tiara` | Tiaras, crowns | Conflicts with `hat`, `helmet` |
| `top_head` | Top-of-head accessories | Conflicts with `hat`, `helmet` |
| `skin` | Full body skin replacement | Replaces all visible body categories |
| `hands_wear` | Gloves, hand accessories | Rarely conflicts |

## Rarity Tiers — Minting Limits

| Rarity | Max Supply | Typical Use Case |
|---|---|---|
| `unique` | 1 | One-of-a-kind collectibles, auction items |
| `mythic` | 10 | Extremely rare collector pieces |
| `exotic` | 50 | Limited edition drops |
| `legendary` | 100 | Premium items |
| `epic` | 1,000 | Standard premium items |
| `uncommon` | 10,000 | Widely available paid items |
| `common` | 100,000 | Mass-market free or cheap items |

Minting cost in MANA increases with rarity. Once a rarity is set and the collection is published, it cannot be changed.

## Body Shapes

Two body shapes are supported. A wearable must have at least one representation, ideally both:

| Body Shape | URN |
|---|---|
| Male | `urn:decentraland:off-chain:base-avatars:BaseMale` |
| Female | `urn:decentraland:off-chain:base-avatars:BaseFemale` |

### Representation Format

Each representation defines how the wearable looks on a specific body shape:

```json
{
  "bodyShapes": ["urn:decentraland:off-chain:base-avatars:BaseMale"],
  "mainFile": "male_model.glb",
  "contents": ["male_model.glb", "texture_diffuse.png", "texture_normal.png"],
  "overrideReplaces": [],
  "overrideHides": []
}
```

- `bodyShapes` — Array with one body shape URN per representation
- `mainFile` — The primary GLB file rendered on the avatar
- `contents` — All files this representation needs (models, textures)
- `overrideReplaces` — If non-empty, overrides `data.replaces` for this body shape only
- `overrideHides` — If non-empty, overrides `data.hides` for this body shape only

## Portable Experience API Reference

### Module: `~system/PortableExperiences`

#### `spawn(options)`

Spawns a portable experience.

```typescript
import { spawn } from '~system/PortableExperiences'

// By ENS name
const result = await spawn({ ens: 'my-portable.dcl.eth' })
// result: { pid: string }

// By URN
const result = await spawn({ pid: 'urn:decentraland:off-chain:portable-experience:my-portable' })
// result: { pid: string }
```

**Parameters:**
- `ens` (string, optional) — ENS name of the portable experience
- `pid` (string, optional) — URN identifier of the portable experience

One of `ens` or `pid` must be provided. Returns an object with `pid` identifying the running instance.

#### `kill(options)`

Terminates a running portable experience.

```typescript
import { kill } from '~system/PortableExperiences'

await kill({ pid: 'urn:decentraland:off-chain:portable-experience:my-portable' })
```

**Parameters:**
- `pid` (string, required) — The PID of the portable experience to kill

#### `getPortableExperiencesLoaded()`

Returns all currently running portable experiences.

```typescript
import { getPortableExperiencesLoaded } from '~system/PortableExperiences'

const result = await getPortableExperiencesLoaded()
// result: { loaded: Array<{ pid: string, name: string, ens?: string }> }

for (const pe of result.loaded) {
  console.log(`Running: ${pe.name} (${pe.pid})`)
}
```

**Returns:** Object with `loaded` array containing objects with:
- `pid` (string) — Unique identifier
- `name` (string) — Display name
- `ens` (string, optional) — ENS name if applicable

## scene.json vs wearable.json Comparison

| Aspect | scene.json | wearable.json |
|---|---|---|
| Project type | Scene | Smart Wearable |
| Deploy target | LAND parcels | Avatar inventory |
| Coordinate space | World coordinates | Player-relative |
| Manifest file | `scene.json` | `wearable.json` |
| Parcel budget | Based on parcel count | Single parcel equivalent |
| VideoPlayer | Allowed | Not allowed |
| AudioStream | Allowed | Not allowed |
| AudioSource | Allowed | Allowed |
| UI (ReactEcsRenderer) | Allowed | Allowed |
| Player access | Via `getPlayer()` | Always available |
| Lifecycle | Enter/leave scene | Equip/unequip wearable |
| Feature toggles | Can disable portables | N/A |
| Publishing | Deploy to coordinates | Upload to Builder, mint |

### scene.json Feature Toggles for Portable Experiences

```json
{
  "display": { "title": "My Scene" },
  "scene": { "parcels": ["0,0"], "base": "0,0" },
  "featureToggles": {
    "portableExperiences": "enabled"
  }
}
```

Values:
- `"enabled"` — (default) All portable experiences can run
- `"disabled"` — No portable experiences run in this scene's parcels
- `"hideUi"` — Portable experiences run but their UI is suppressed

## Publishing Checklist

Before publishing a smart wearable:

- [ ] `wearable.json` has valid `name`, `description`, `rarity`, and `category`
- [ ] At least one representation with a valid body shape
- [ ] All files referenced in `contents` arrays exist in the project
- [ ] Total uncompressed size is under 3 MB
- [ ] Triangle count is under 10,000
- [ ] Entity count is under 200
- [ ] Textures are power-of-two dimensions (512x512 recommended)
- [ ] No `VideoPlayer` or `AudioStream` usage in code
- [ ] `npm run pack` succeeds and produces `smart-wearable.zip`
- [ ] Tested locally with `npm run start`
- [ ] MANA available for minting (amount depends on rarity)
- [ ] Ethereum wallet connected with sufficient funds
- [ ] Collection created in Decentraland Builder (or ENS name registered)

## Size and Resource Limits

| Resource | Scene (per parcel) | Smart Wearable | Portable Experience |
|---|---|---|---|
| File size (uncompressed) | 15 MB per parcel | 3 MB total | 3 MB total |
| Triangles | 10,000 per parcel | 10,000 | 10,000 |
| Entities | 200 per parcel | 200 | 200 |
| Textures | 512x512 per texture rec. | 512x512 recommended | 512x512 recommended |
| Materials | PBR, max 2/mesh | PBR, max 2/mesh | PBR, max 2/mesh |
| Bodies (physics) | Supported | Limited | Limited |
| VideoPlayer | Yes | No | No |
| AudioStream | Yes | No | No |
| AudioSource | Yes | Yes | Yes |

## Example wearable.json Files

### Upper Body (Jacket)

```json
{
  "id": "urn:decentraland:off-chain:base-avatars:cyber_jacket",
  "name": "Cyber Jacket",
  "description": "A glowing cyberpunk jacket with animated lights",
  "rarity": "epic",
  "data": {
    "category": "upper_body",
    "replaces": [],
    "hides": [],
    "tags": ["cyberpunk", "jacket", "glowing"],
    "representations": [
      {
        "bodyShapes": ["urn:decentraland:off-chain:base-avatars:BaseMale"],
        "mainFile": "jacket_male.glb",
        "contents": ["jacket_male.glb", "jacket_texture.png", "jacket_emissive.png"],
        "overrideReplaces": [],
        "overrideHides": []
      },
      {
        "bodyShapes": ["urn:decentraland:off-chain:base-avatars:BaseFemale"],
        "mainFile": "jacket_female.glb",
        "contents": ["jacket_female.glb", "jacket_texture.png", "jacket_emissive.png"],
        "overrideReplaces": [],
        "overrideHides": []
      }
    ]
  }
}
```

### Helmet (with hides)

```json
{
  "id": "urn:decentraland:off-chain:base-avatars:space_helmet",
  "name": "Space Helmet",
  "description": "Full-coverage space helmet with visor",
  "rarity": "legendary",
  "data": {
    "category": "helmet",
    "replaces": [],
    "hides": ["hair", "facial_hair", "earring", "eyewear", "hat", "tiara", "top_head"],
    "tags": ["space", "helmet", "sci-fi"],
    "representations": [
      {
        "bodyShapes": ["urn:decentraland:off-chain:base-avatars:BaseMale"],
        "mainFile": "helmet.glb",
        "contents": ["helmet.glb", "helmet_texture.png"],
        "overrideReplaces": [],
        "overrideHides": []
      },
      {
        "bodyShapes": ["urn:decentraland:off-chain:base-avatars:BaseFemale"],
        "mainFile": "helmet.glb",
        "contents": ["helmet.glb", "helmet_texture.png"],
        "overrideReplaces": [],
        "overrideHides": []
      }
    ]
  }
}
```

### Skin (full body replacement)

```json
{
  "id": "urn:decentraland:off-chain:base-avatars:robot_skin",
  "name": "Robot Skin",
  "description": "Full robot body replacement",
  "rarity": "mythic",
  "data": {
    "category": "skin",
    "replaces": [],
    "hides": [
      "upper_body", "lower_body", "feet", "hands_wear",
      "hair", "facial_hair", "eyebrows", "eyes", "mouth",
      "earring", "eyewear", "hat", "helmet", "mask", "tiara", "top_head"
    ],
    "tags": ["robot", "skin", "full-body"],
    "representations": [
      {
        "bodyShapes": ["urn:decentraland:off-chain:base-avatars:BaseMale"],
        "mainFile": "robot_male.glb",
        "contents": ["robot_male.glb", "robot_texture.png", "robot_normal.png"],
        "overrideReplaces": [],
        "overrideHides": []
      },
      {
        "bodyShapes": ["urn:decentraland:off-chain:base-avatars:BaseFemale"],
        "mainFile": "robot_female.glb",
        "contents": ["robot_female.glb", "robot_texture.png", "robot_normal.png"],
        "overrideReplaces": [],
        "overrideHides": []
      }
    ]
  }
}
```

### Eyewear (simple accessory)

```json
{
  "id": "urn:decentraland:off-chain:base-avatars:holo_glasses",
  "name": "Holo Glasses",
  "description": "Holographic display glasses",
  "rarity": "uncommon",
  "data": {
    "category": "eyewear",
    "replaces": [],
    "hides": [],
    "tags": ["glasses", "holographic", "tech"],
    "representations": [
      {
        "bodyShapes": ["urn:decentraland:off-chain:base-avatars:BaseMale"],
        "mainFile": "glasses.glb",
        "contents": ["glasses.glb", "lens_texture.png"],
        "overrideReplaces": [],
        "overrideHides": []
      },
      {
        "bodyShapes": ["urn:decentraland:off-chain:base-avatars:BaseFemale"],
        "mainFile": "glasses.glb",
        "contents": ["glasses.glb", "lens_texture.png"],
        "overrideReplaces": [],
        "overrideHides": []
      }
    ]
  }
}
```

### Hands Wear (with per-shape override)

```json
{
  "id": "urn:decentraland:off-chain:base-avatars:power_gauntlets",
  "name": "Power Gauntlets",
  "description": "Armored gauntlets that extend up the forearm",
  "rarity": "epic",
  "data": {
    "category": "hands_wear",
    "replaces": [],
    "hides": [],
    "tags": ["gauntlets", "armor", "hands"],
    "representations": [
      {
        "bodyShapes": ["urn:decentraland:off-chain:base-avatars:BaseMale"],
        "mainFile": "gauntlets_male.glb",
        "contents": ["gauntlets_male.glb", "metal_texture.png"],
        "overrideReplaces": [],
        "overrideHides": ["upper_body"]
      },
      {
        "bodyShapes": ["urn:decentraland:off-chain:base-avatars:BaseFemale"],
        "mainFile": "gauntlets_female.glb",
        "contents": ["gauntlets_female.glb", "metal_texture.png"],
        "overrideReplaces": [],
        "overrideHides": []
      }
    ]
  }
}
```
