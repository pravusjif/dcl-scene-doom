---
name: dcl-ui
description: "Assists with Decentraland SDK7 UI development when the user mentions DCL UI, UiEntity, ReactEcsRenderer, Labels, Buttons, Input fields, Dropdowns, dcl-ui-toolkit, HUDs, prompts, counters, progress bars, announcements, or UI layout."
---

# Decentraland SDK7 UI Development

## Two UI Approaches

### React ECS (Built-in)
- **Import**: `@dcl/sdk/react-ecs`
- **Best for**: Custom layouts, full control, complex interactive panels
- **Style**: JSX in `.tsx` files, flexbox layout. No extra dependencies.

### dcl-ui-toolkit (Pre-built Widgets)
- **Install**: `npm install dcl-ui-toolkit`
- **Import**: `import * as ui from 'dcl-ui-toolkit'`
- **Best for**: Quick HUDs, prompts, counters, bars, announcements
- **Style**: Imperative API. Can combine with React ECS.

**Decision guide:**
- Prompt/dialog? dcl-ui-toolkit (`displayOkPrompt`, `displayOptionPrompt`, `CustomPrompt`)
- Health bar or score? dcl-ui-toolkit (`createBar`, `createCounter`)
- Custom panel, inventory grid, complex layout? React ECS directly
- Both? Combine — render `ui.render()` alongside custom JSX

---

## React ECS Quick Start

```typescript
// ui.tsx
import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(uiComponent)
}

const uiComponent = () => (
  <UiEntity
    uiTransform={{ width: 400, height: 230, margin: '16px 0 8px 270px', padding: 4 }}
    uiBackground={{ color: Color4.create(0.5, 0.8, 0.1, 0.6) }}
  >
    <Label value="Hello Decentraland" color={Color4.White()} fontSize={24} />
    <Button value="Click Me" variant="primary" fontSize={14}
      onMouseDown={() => { console.log('Button clicked') }} />
  </UiEntity>
)

// index.ts — call setupUi() in main()
```

---

## Layout System

Flexbox model via `uiTransform`:

```typescript
uiTransform={{
  flexDirection: 'column',          // 'row' | 'column'
  alignItems: 'center',            // 'flex-start' | 'center' | 'flex-end' | 'stretch'
  justifyContent: 'space-between', // 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around'
  flexWrap: 'wrap',                // 'nowrap' | 'wrap'
  positionType: 'absolute',        // 'absolute' | 'relative'
  position: { top: '10px', left: '20px' },
  width: 300,          // pixels or '50%'
  height: '50%',
  minWidth: 100, maxWidth: 500,
  padding: { top: 10, bottom: 10, left: 15, right: 15 },
  margin: { top: '5px', bottom: '5px' },
  display: 'flex'      // 'flex' | 'none'
}}
```

---

## Core Components

### UiEntity
Base container. Accepts `uiTransform`, `uiBackground`, `uiText`, plus event handlers (`onMouseDown`, `onMouseEnter`, `onMouseLeave`).

### Label
```typescript
<Label value="Text" color={Color4.Black()} fontSize={18}
  textAlign="middle-center" font="serif" uiTransform={{ width: 200, height: 50 }} />
```
Fonts: `'sans-serif'` (default), `'serif'`, `'monospace'`. Align: `'top-left'`, `'middle-center'`, `'bottom-right'`, etc.

### Button
```typescript
<Button value="Click Me" variant="primary" fontSize={14} color={Color4.White()}
  uiTransform={{ width: 100, height: 40 }}
  onMouseDown={() => { /* action */ }}
  uiBackground={{ color: Color4.Blue() }} />
```

### Input
```typescript
<Input placeholder="Enter text..." placeholderColor={Color4.Gray()} color={Color4.Black()}
  fontSize={16}
  onChange={(value) => { console.log('Changing: ' + value) }}
  onSubmit={(value) => { console.log('Submitted: ' + value) }}
  uiTransform={{ width: 200, height: 40 }} />
```

### Dropdown
```typescript
<Dropdown options={['Option 1', 'Option 2', 'Option 3']}
  onChange={(index) => { console.log('Selected: ' + index) }}
  fontSize={16} uiTransform={{ width: 200, height: 40 }}
  acceptEmpty={true} emptyLabel="-- Select --" />
```

---

## UiBackground

```typescript
// Solid color
uiBackground={{ color: Color4.create(1, 0, 0, 0.8) }}

// Texture
uiBackground={{ texture: { src: 'assets/ui/bg.png' }, textureMode: 'stretch' }}
// textureMode: 'stretch' | 'center' | 'repeat'

// Nine-slice
uiBackground={{ texture: { src: 'assets/ui/panel.png' },
  textureSlices: { top: 10, bottom: 10, left: 10, right: 10 } }}

// Avatar
uiBackground={{ avatarTexture: { userId: 'user-id' } }}
```

---

## State Management

Use module-level variables. The UI function runs every frame, so it reads current values automatically.

```typescript
let isPanelVisible = false
let playerHealth = 100

const uiComponent = () => (
  <UiEntity uiTransform={{ width: '100%', height: '100%', positionType: 'absolute' }}>
    {isPanelVisible && (
      <UiEntity uiTransform={{ width: 200, height: 60, position: { top: '10px', left: '10px' } }}
        uiBackground={{ color: Color4.create(0, 0, 0, 0.8) }}>
        <Label value={`HP: ${playerHealth}`} fontSize={18} color={Color4.Green()} />
      </UiEntity>
    )}
  </UiEntity>
)

// Game logic updates state; UI reflects changes next frame
export function takeDamage(amount: number) { playerHealth = Math.max(0, playerHealth - amount) }
export function togglePanel() { isPanelVisible = !isPanelVisible }
```

---

## dcl-ui-toolkit Quick Start

```typescript
import * as ui from 'dcl-ui-toolkit'
import { ReactEcsRenderer } from '@dcl/sdk/react-ecs'

// Register in main()
ReactEcsRenderer.setUiRenderer(ui.render)

// Or combine: ReactEcsRenderer.setUiRenderer(() => [ui.render(), MyCustomUI()])
```

---

## dcl-ui-toolkit Components

### Prompts
```typescript
ui.displayOkPrompt({ title: 'Welcome!', text: 'Message.', onAccept: () => {} })
ui.displayOptionPrompt({ title: 'Confirm', text: 'Sure?', onAccept: () => {}, onReject: () => {} })
ui.displayFillInPrompt({ title: 'Name', placeholder: 'Type here', onAccept: (v) => {}, onReject: () => {} })
```

### Custom Prompt
```typescript
const prompt = ui.createComponent(ui.CustomPrompt, { style: ui.PromptStyles.DARKSLANTED })
// Styles: DARKSLANTED, LIGHTROUND, DARKROUND, LIGHTSLANTED
prompt.addText({ value: 'Title', color: Color4.Yellow(), size: 30 })
prompt.addButton({ style: ui.ButtonStyles.E, text: 'Accept', onMouseDown: () => {} })
// ButtonStyles: E, F, CLOSE, ROUNDGREEN, ROUNDWHITE, ROUNDRED, SQUAREGREEN, SQUAREWHITE, SQUARERED
prompt.addCheckbox({ text: 'Remember', onCheck: () => {}, onUncheck: () => {} })
prompt.addSwitch({ text: 'Enable', onCheck: () => {}, onUncheck: () => {}, style: ui.PromptSwitchStyles.ROUNDGREEN })
prompt.addTextBox({ placeholder: 'Enter text', onChange: (v) => {} })
prompt.addIcon({ image: 'images/icon.png', width: 64, height: 64 })
prompt.show()  // prompt.hide()
```

### Announcements
```typescript
ui.displayAnnouncement('Welcome!', 5, { color: Color4.Red(), fontSize: 24 })
```

### Counter, Label, Bar, Icon, Loading
```typescript
const counter = ui.createCounter({ value: 0, xOffset: 10, yOffset: 10 })
counter.setValue(5); counter.increment(); counter.decrement(); counter.hide(); counter.show()

const label = ui.createCornerLabel({ value: 'Score: 0', xOffset: 10, yOffset: 50 })
label.setValue('Score: 150'); label.hide(); label.show()

const bar = ui.createBar({ value: 50, xOffset: 10, yOffset: 120, width: 200, height: 20,
  color: Color4.Green(), backgroundColor: Color4.Gray() })
bar.setValue(75); bar.hide(); bar.show()

const icon = ui.createCornerIcon({ image: 'images/icon.png', xOffset: 10, yOffset: 200, width: 64, height: 64 })
const loading = ui.createLoadingIcon({ xOffset: 10, yOffset: 280 })
loading.start(); loading.stop()

const img = ui.createLargeImage({ image: 'images/bg.jpg', xOffset: 0, yOffset: 0, width: 800, height: 600 })
```

---

## Common Patterns

### Toggle Panel
```typescript
let showPanel = false
// In JSX: onMouseDown={() => { showPanel = !showPanel }}
// Conditionally render: {showPanel && (<UiEntity .../>)}
```

### Health Bar (React ECS)
```typescript
<UiEntity uiTransform={{ width: 200, height: 20 }} uiBackground={{ color: Color4.Red() }}>
  <UiEntity uiTransform={{ width: `${health}%`, height: '100%' }} uiBackground={{ color: Color4.Green() }} />
</UiEntity>
```

### Inventory Grid
Use `flexDirection: 'row'`, `flexWrap: 'wrap'` on a container, then `.map()` items into fixed-size `UiEntity` slots.

### Settings with Dropdown
```typescript
let selected = 0
<Dropdown options={['Easy', 'Normal', 'Hard']} onChange={(i) => { selected = i }} fontSize={14}
  uiTransform={{ width: '100%', height: 40 }} />
```

### Canvas Info (responsive layouts)
```typescript
import { UiCanvasInformation, engine } from '@dcl/sdk/ecs'
const canvasInfo = UiCanvasInformation.get(engine.RootEntity)
// canvasInfo.width, canvasInfo.height, canvasInfo.devicePixelRatio
```

---

## Reference Files

- `references/react-ecs-ui.md` — Full React ECS UI reference (UiEntity, Label, Button, Input, Dropdown, layout, backgrounds, events, layout examples)
- `references/ui-toolkit.md` — Full dcl-ui-toolkit reference (prompts, counters, bars, icons, announcements, custom prompts, patterns)
