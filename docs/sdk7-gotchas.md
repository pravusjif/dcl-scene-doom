# SDK7 Gotchas Discovered

## Color4 is Readonly
`Color4` properties (r, g, b, a) are readonly. Cannot mutate in place.
**Fix:** Replace the entire Color4 object: `col.color = Color4.create(r, g, b, a)`

## Teleporting Player
`Transform.createOrReplace(engine.PlayerEntity)` does NOT teleport the avatar.
**Fix:** Use `movePlayerTo` from `~system/RestrictedActions`:
```typescript
import { movePlayerTo } from '~system/RestrictedActions'
movePlayerTo({ newRelativePosition: { x: 8, y: 0, z: 8 }, cameraTarget: { x: 12, y: 1, z: 8 } })
```

## InputModifier Syntax
Use the `InputModifier.Mode.Standard()` helper, not raw `$case` objects:
```typescript
InputModifier.createOrReplace(engine.PlayerEntity, {
  mode: InputModifier.Mode.Standard({ disableAll: true })
})
```
Available flags: `disableAll`, `disableWalk`, `disableJog`, `disableRun`, `disableJump`, `disableEmote`

## InputModifier Timing
Applying InputModifier in `main()` may fail — `engine.PlayerEntity` might not be ready.
**Fix:** Defer to the first system tick.

## InputModifier Blocks isTriggered
`InputModifier({ disableAll: true })` blocks `inputSystem.isTriggered()` for actions like IA_SECONDARY.
**Fix:** Use `inputSystem.isPressed()` with a manual debounce flag instead:
```typescript
let wasPressed = false
const down = inputSystem.isPressed(InputAction.IA_SECONDARY)
const triggered = down && !wasPressed
wasPressed = down
```
`isPressed()` is a raw input check that works regardless of InputModifier.

## inputSystem.isTriggered Signature
Takes 2 args: `(InputAction, PointerEventType)` — NOT 3 args.
```typescript
inputSystem.isTriggered(InputAction.IA_ACTION_6, PointerEventType.PET_DOWN)
```

## Camera Quaternion Yaw
The yaw extracted from `Transform.get(engine.CameraEntity).rotation` can be passed directly to `setPlayerAngle()` — do NOT negate it. Negating inverts the rotation direction.

## UI Z-Ordering
Absolute-positioned `UiEntity` siblings do NOT have guaranteed z-order by DOM order in DCL React-ECS.
**Fix:** Use the `zIndex` property on `uiTransform` for explicit z-ordering:
```typescript
uiTransform={{ positionType: 'absolute', zIndex: 2 }}
```
Higher zIndex renders on top. This is essential for depth-sorted rendering (walls vs sprites).

## UI Centering
Negative margins (e.g., `margin: { left: -480 }`) are NOT supported for centering.
**Fix:** Use a full-screen flexbox container with `alignItems: 'center'` and `justifyContent: 'center'`.

## IA_SECONDARY is F Key (Not Right-Click)
In DCL SDK7: `IA_PRIMARY` = E key, `IA_SECONDARY` = F key, `IA_POINTER` = left mouse click.
Right-click is used by the Explorer to free the camera — do NOT rely on it for gameplay.
