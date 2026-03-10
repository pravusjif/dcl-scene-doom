# React ECS UI Reference — Decentraland SDK7

## Basic UI Setup

### Rendering UI
```typescript
// ui.tsx
import { UiEntity, ReactEcs } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

export const uiMenu = () => (
  <UiEntity
    uiTransform={{
      width: 400,
      height: 300,
      position: { top: '10%', left: '10%' }
    }}
    uiBackground={{ color: Color4.create(0, 0, 0, 0.8) }}
  >
    <UiEntity
      uiTransform={{
        width: '100%',
        height: 50,
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiText={{ value: 'Hello World!', fontSize: 24 }}
    />
  </UiEntity>
)

// index.ts
import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'
import { uiMenu } from './ui'

export function main() {
  ReactEcsRenderer.setUiRenderer(uiMenu)
}
```

### Full Setup with Label and Button
```typescript
// ui.tsx
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(uiComponent)
}

const uiComponent = () => (
  <UiEntity
    uiTransform={{
      width: 400,
      height: 230,
      margin: '16px 0 8px 270px',
      padding: 4
    }}
    uiBackground={{ color: Color4.create(0.5, 0.8, 0.1, 0.6) }}
  >
    <Label
      value="Hello Decentraland"
      color={Color4.White()}
      fontSize={24}
    />
    <Button
      value="Click Me"
      variant="primary"
      fontSize={14}
      onMouseDown={() => {
        console.log('Button clicked')
      }}
    />
  </UiEntity>
)
```

---

## UI Transform

### Positioning
```typescript
// Absolute positioning
uiTransform={{
  positionType: 'absolute',
  position: { top: '10px', left: '20px' },
  width: 200,
  height: 100
}}

// Relative positioning
uiTransform={{
  positionType: 'relative',
  margin: { top: '10px', left: '20px' },
  width: '50%',
  height: '30%'
}}

// Flexbox layout
uiTransform={{
  flexDirection: 'column',          // 'row' or 'column'
  alignItems: 'center',            // 'flex-start', 'center', 'flex-end', 'stretch'
  justifyContent: 'space-between', // 'flex-start', 'center', 'flex-end', 'space-between', 'space-around'
  flexWrap: 'wrap'                 // 'nowrap', 'wrap'
}}
```

### Size and Spacing
```typescript
uiTransform={{
  width: 300,          // Fixed width in pixels
  height: '50%',       // Percentage height
  minWidth: 100,       // Minimum width
  maxWidth: 500,       // Maximum width
  padding: { top: 10, bottom: 10, left: 15, right: 15 },
  margin: { top: '5px', bottom: '5px' }
}}
```

---

## UI Background

### Colors and Images
```typescript
// Solid color background
uiBackground={{ color: Color4.create(1, 0, 0, 0.8) }}

// Texture background
uiBackground={{
  texture: { src: 'assets/ui/background.png' },
  textureMode: 'stretch'  // 'stretch', 'center', 'repeat'
}}

// Nine-slice background
uiBackground={{
  texture: { src: 'assets/ui/panel.png' },
  textureSlices: {
    top: 10,
    bottom: 10,
    left: 10,
    right: 10
  }
}}

// Avatar texture
uiBackground={{
  avatarTexture: { userId: 'user-id' }
}}
```

---

## UI Text

### Text Properties
```typescript
uiText={{
  value: 'Hello World!',
  fontSize: 18,
  color: Color4.White(),
  textAlign: 'middle-center',  // 'top-left', 'top-center', 'top-right', 'middle-left', 'middle-center', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right'
  font: 'serif',               // 'sans-serif', 'serif', 'monospace'
  fontWeight: 'bold'           // 'normal', 'bold'
}}

// Rich text with line breaks
uiText={{
  value: 'Line 1\nLine 2\nLine 3',
  fontSize: 16,
  textAlign: 'top-left'
}}
```

---

## Core Components

### UiEntity (Full Props)
```typescript
<UiEntity
  uiTransform={{
    width: 400,                  // Pixels or percentage (e.g. '100%')
    height: 300,
    position: { top: 10, left: 10 }, // For absolute positioning
    positionType: 'absolute',    // 'absolute' or 'relative'
    display: 'flex',             // 'flex' or 'none'
    flexDirection: 'column',     // 'column' or 'row'
    alignItems: 'center',        // 'center', 'flex-start', 'flex-end'
    justifyContent: 'center',    // 'center', 'flex-start', 'flex-end', 'space-between'
    margin: 5,                   // Or { top: 5, right: 10, bottom: 5, left: 10 }
    padding: 5                   // Same as margin
  }}
  uiBackground={{
    color: Color4.White(),
    texture: { src: 'images/image.png' },
    textureMode: 'stretch',      // 'stretch', 'nine-slices', 'center'
    avatarTexture: { userId: 'user-id' } // For rendering avatar
  }}
/>
```

### Label
```typescript
<Label
  value="Text content"
  color={Color4.Black()}
  fontSize={18}
  textAlign="middle-center" // 'top-left', 'middle-right', etc.
  font="serif"              // 'serif', 'monospace', or default sans-serif
  uiTransform={{ width: 200, height: 50 }}
/>
```

### Button
```typescript
<Button
  value="Click Me"
  variant="primary"        // 'primary', 'secondary', etc.
  fontSize={14}
  color={Color4.White()}   // Text color
  uiTransform={{ width: 100, height: 40 }}
  onMouseDown={() => { /* action */ }}
  uiBackground={{ color: Color4.Blue() }} // Override default button style
/>
```

### Input
```typescript
<Input
  placeholder="Enter text..."
  placeholderColor={Color4.Gray()}
  color={Color4.Black()}    // Text color
  fontSize={16}
  onChange={(value) => { console.log('Value changing: ' + value) }}
  onSubmit={(value) => { console.log('Submitted: ' + value) }}
  uiTransform={{ width: 200, height: 40 }}
/>
```

### Dropdown
```typescript
<Dropdown
  options={['Option 1', 'Option 2', 'Option 3']}
  onChange={(index) => { console.log('Selected option: ' + index) }}
  fontSize={16}
  color={Color4.Black()}
  uiTransform={{ width: 200, height: 40 }}
  acceptEmpty={true}
  emptyLabel="-- Select an option --"
/>
```

---

## UI Button Events

### Click Events
```typescript
<UiEntity
  uiTransform={{
    width: 150,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center'
  }}
  uiBackground={{ color: Color4.Blue() }}
  uiText={{ value: 'Click Me!', fontSize: 18 }}
  onMouseDown={() => {
    console.log('Button clicked!')
  }}
/>
```

### Hover Effects
```typescript
let isHovered = false

<UiEntity
  uiTransform={{
    width: 150,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center'
  }}
  uiBackground={{
    color: isHovered ? Color4.Green() : Color4.Blue()
  }}
  uiText={{ value: 'Hover Me!', fontSize: 18 }}
  onMouseEnter={() => { isHovered = true }}
  onMouseLeave={() => { isHovered = false }}
  onMouseDown={() => {
    console.log('Button clicked!')
  }}
/>
```

---

## Dynamic UI / State Management

```typescript
let count = 0
let isVisible = true

const DynamicUI = () => (
  <UiEntity
    uiTransform={{
      width: 300,
      height: 200,
      position: { top: '10%', left: '10%' },
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}
    uiBackground={{ color: Color4.create(0, 0, 0, 0.8) }}
  >
    {isVisible && (
      <UiEntity
        uiTransform={{ width: '100%', height: 50 }}
        uiText={{
          value: `Count: ${count}`,
          fontSize: 20,
          textAlign: 'middle-center'
        }}
      />
    )}

    <UiEntity
      uiTransform={{
        width: 100,
        height: 40,
        margin: { top: 10 }
      }}
      uiBackground={{ color: Color4.Green() }}
      uiText={{ value: '+', fontSize: 24, textAlign: 'middle-center' }}
      onMouseDown={() => { count++ }}
    />

    <UiEntity
      uiTransform={{
        width: 100,
        height: 40,
        margin: { top: 10 }
      }}
      uiBackground={{ color: Color4.Red() }}
      uiText={{ value: 'Toggle', fontSize: 16, textAlign: 'middle-center' }}
      onMouseDown={() => { isVisible = !isVisible }}
    />
  </UiEntity>
)
```

---

## Layout Examples

### Game HUD
```typescript
let health = 100
let score = 0
let ammo = 30

const GameHUD = () => (
  <UiEntity
    uiTransform={{
      width: '100%',
      height: '100%',
      positionType: 'absolute'
    }}
  >
    {/* Health Bar */}
    <UiEntity
      uiTransform={{
        width: 200,
        height: 20,
        position: { top: '10px', left: '10px' }
      }}
      uiBackground={{ color: Color4.Red() }}
    >
      <UiEntity
        uiTransform={{
          width: `${health}%`,
          height: '100%'
        }}
        uiBackground={{ color: Color4.Green() }}
      />
    </UiEntity>

    {/* Score */}
    <UiEntity
      uiTransform={{
        width: 150,
        height: 30,
        position: { top: '10px', right: '10px' }
      }}
      uiText={{
        value: `Score: ${score}`,
        fontSize: 18,
        textAlign: 'middle-right'
      }}
    />

    {/* Ammo */}
    <UiEntity
      uiTransform={{
        width: 100,
        height: 30,
        position: { bottom: '10px', right: '10px' }
      }}
      uiText={{
        value: `Ammo: ${ammo}`,
        fontSize: 16,
        textAlign: 'middle-right'
      }}
    />
  </UiEntity>
)
```

### Modal Dialog
```typescript
let isModalOpen = false

const ModalDialog = () => {
  if (!isModalOpen) return null

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        positionType: 'absolute',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.5) }}
      onMouseDown={() => { isModalOpen = false }}
    >
      <UiEntity
        uiTransform={{
          width: 400,
          height: 300,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: { top: 20, bottom: 20, left: 20, right: 20 }
        }}
        uiBackground={{ color: Color4.create(0.2, 0.2, 0.2, 1) }}
      >
        <UiEntity
          uiText={{
            value: 'Dialog Title',
            fontSize: 24,
            textAlign: 'middle-center'
          }}
        />

        <UiEntity
          uiText={{
            value: 'This is the dialog content.',
            fontSize: 16,
            textAlign: 'middle-center'
          }}
        />

        <UiEntity
          uiTransform={{
            width: 100,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center'
          }}
          uiBackground={{ color: Color4.Blue() }}
          uiText={{ value: 'Close', fontSize: 16 }}
          onMouseDown={() => { isModalOpen = false }}
        />
      </UiEntity>
    </UiEntity>
  )
}
```

### Inventory Grid
```typescript
const items = Array.from({ length: 20 }, (_, i) => `Item ${i + 1}`)

const InventoryGrid = () => (
  <UiEntity
    uiTransform={{
      width: 400,
      height: 400,
      position: { top: '10%', left: '10%' },
      flexDirection: 'column',
      padding: { top: 10, bottom: 10, left: 10, right: 10 }
    }}
    uiBackground={{ color: Color4.create(0.1, 0.1, 0.1, 0.9) }}
  >
    <UiEntity
      uiTransform={{
        width: '100%',
        height: 40,
        alignItems: 'center',
        justifyContent: 'center'
      }}
      uiText={{ value: 'Inventory', fontSize: 20 }}
    />

    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'flex-start'
      }}
    >
      {items.map((item, index) => (
        <UiEntity
          key={index}
          uiTransform={{
            width: 70,
            height: 70,
            margin: { top: 5, bottom: 5, left: 5, right: 5 },
            alignItems: 'center',
            justifyContent: 'center'
          }}
          uiBackground={{ color: Color4.create(0.3, 0.3, 0.3, 1) }}
          uiText={{ value: item, fontSize: 10 }}
          onMouseDown={() => console.log(`Clicked ${item}`)}
        />
      ))}
    </UiEntity>
  </UiEntity>
)
```

### Vertical List
```typescript
const VerticalList = () => (
  <UiEntity
    uiTransform={{
      width: 250,
      height: 300,
      position: { top: '10%', right: '5%' },
      flexDirection: 'column',
      padding: 10
    }}
    uiBackground={{ color: Color4.create(0, 0, 0, 0.8) }}
  >
    <UiEntity
      uiTransform={{ width: '100%', height: 40 }}
      uiText={{ value: 'Leaderboard', fontSize: 20, textAlign: 'middle-center' }}
    />
    {['Alice: 500', 'Bob: 420', 'Charlie: 380'].map((entry, i) => (
      <UiEntity
        key={i}
        uiTransform={{ width: '100%', height: 30, margin: { top: 2 } }}
        uiText={{ value: entry, fontSize: 14, textAlign: 'middle-left' }}
      />
    ))}
  </UiEntity>
)
```

### Horizontal Bar
```typescript
const HorizontalBar = () => (
  <UiEntity
    uiTransform={{
      width: '80%',
      height: 60,
      position: { bottom: '5%', left: '10%' },
      positionType: 'absolute',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      padding: 5
    }}
    uiBackground={{ color: Color4.create(0.1, 0.1, 0.1, 0.9) }}
  >
    {['Slot 1', 'Slot 2', 'Slot 3', 'Slot 4'].map((slot, i) => (
      <UiEntity
        key={i}
        uiTransform={{ width: 50, height: 50, alignItems: 'center', justifyContent: 'center' }}
        uiBackground={{ color: Color4.create(0.3, 0.3, 0.3, 1) }}
        uiText={{ value: slot, fontSize: 10, textAlign: 'middle-center' }}
        onMouseDown={() => console.log(`Selected ${slot}`)}
      />
    ))}
  </UiEntity>
)
```

### Centered Overlay
```typescript
const CenteredOverlay = () => (
  <UiEntity
    uiTransform={{
      width: '100%',
      height: '100%',
      positionType: 'absolute',
      alignItems: 'center',
      justifyContent: 'center'
    }}
    uiBackground={{ color: Color4.create(0, 0, 0, 0.5) }}
  >
    <UiEntity
      uiTransform={{
        width: 400,
        height: 250,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
      uiBackground={{ color: Color4.create(0.2, 0.2, 0.2, 1) }}
    >
      <Label value="Centered Content" fontSize={22} color={Color4.White()} />
    </UiEntity>
  </UiEntity>
)
```

---

## Canvas Information

```typescript
import { UiCanvasInformation, engine } from '@dcl/sdk/ecs'

// Get screen info for responsive layouts
const canvasInfo = UiCanvasInformation.get(engine.RootEntity)
const screenWidth = canvasInfo.width
const screenHeight = canvasInfo.height
const pixelRatio = canvasInfo.devicePixelRatio
```

---

## Debug UI Example

```typescript
let debugInfo = { entities: 0, fps: 0, players: 0 }

const DebugPanel = () => (
  <UiEntity
    uiTransform={{
      width: 200,
      height: 100,
      position: { top: '10px', right: '10px' },
      flexDirection: 'column'
    }}
    uiBackground={{ color: Color4.create(0, 0, 0, 0.7) }}
  >
    <UiEntity uiText={{ value: `Entities: ${debugInfo.entities}`, fontSize: 12 }} />
    <UiEntity uiText={{ value: `FPS: ${debugInfo.fps}`, fontSize: 12 }} />
    <UiEntity uiText={{ value: `Players: ${debugInfo.players}`, fontSize: 12 }} />
  </UiEntity>
)
```

---

## Portable Experience UI

```typescript
function createPortableUI() {
  ReactEcsRenderer.setUiRenderer(() => (
    <UiEntity
      uiTransform={{
        position: { top: '10px', left: '10px' },
        width: 200,
        height: 50
      }}
      uiBackground={{ color: Color4.create(0, 0, 0, 0.8) }}
      uiText={{ value: 'Portable Experience Active', fontSize: 12 }}
    />
  ))
}
```

---

## Gotchas and Common Pitfalls

### Z-Ordering with Absolute Positioning
Absolute-positioned sibling `UiEntity` elements do NOT have guaranteed z-ordering by JSX/DOM order in DCL React-ECS. Use the `zIndex` property on `uiTransform` for explicit control — higher values render on top:

```typescript
// Explicit z-ordering with zIndex
<UiEntity uiBackground={{ color: floorColor }}> {/* container bg = always behind */}
  <UiEntity uiTransform={{ positionType: 'absolute', zIndex: 0 }}
    uiBackground={{ color: ceilingColor }} /> {/* background layer */}

  {sprites.map((s, i) => (
    <UiEntity key={`s${i}`} uiTransform={{ positionType: 'absolute', zIndex: 1 }}
      uiBackground={{ color: s.color }} /> {/* mid layer */}
  ))}

  {columns.map((col, i) => (
    <UiEntity key={i} uiTransform={{ positionType: 'absolute', zIndex: 2 }}
      uiBackground={{ color: col.color }} /> {/* top layer */}
  ))}

  <UiEntity uiTransform={{ positionType: 'absolute', zIndex: 9999 }}
    uiBackground={{ color: hudColor }} /> {/* overlay — always on top */}
</UiEntity>
```

`zIndex` is essential for layered rendering like game viewports, depth-sorted sprites, or any UI where multiple absolute-positioned elements overlap and need a guaranteed draw order.

**Tip:** For the bottommost background layer, you can also use the parent container's `uiBackground` — it's always behind all children without needing `zIndex`.

### Negative Margins Don't Work for Centering
Negative margin values (e.g., `margin: { left: -200 }`) are not supported. To center a fixed-width element, use a full-screen flexbox wrapper:

```typescript
<UiEntity uiTransform={{
  width: '100%', height: '100%',
  alignItems: 'center', justifyContent: 'center'
}}>
  <UiEntity uiTransform={{ width: 400, height: 300 }}>
    {/* centered content */}
  </UiEntity>
</UiEntity>
```

### Color4 is Readonly
`Color4` properties (`.r`, `.g`, `.b`, `.a`) are readonly and cannot be mutated in place. Always replace the entire object:

```typescript
// WRONG — will cause TypeScript error
myColor.r = 0.5

// CORRECT — create a new Color4
myColor = Color4.create(0.5, myColor.g, myColor.b, myColor.a)
```

### High Element Count Rendering
DCL React-ECS can handle 350+ UiEntity elements at interactive frame rates. Confirmed working: 80 wall columns + 160 sprite strips + 121 minimap cells + HUD overlays (~360 total) in a real-time raycaster game viewport.

Key patterns for high element counts:
- **Stable `key` props** on all `.map()` renders — prevents React from tearing down and recreating elements
- **Pre-allocate pools** — create fixed-size arrays at init (e.g., 160 sprite strip slots) and toggle `visible` via `display: 'none'` or conditional rendering, rather than growing/shrinking arrays
- **Mutate data in place** — update properties on existing objects each frame instead of creating new ones (avoids GC pressure)
- **Throttle expensive updates** — e.g., update a minimap every 5th frame instead of every frame

---

## Font Options

Available fonts for `font` property on Label or `uiText.font`:
- `'sans-serif'` (default)
- `'serif'`
- `'monospace'`

Font weight via `uiText.fontWeight`:
- `'normal'`
- `'bold'`
