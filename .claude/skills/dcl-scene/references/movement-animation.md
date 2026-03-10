# Movement & Animation

## Native Tween System

Prefer native Tween/TweenSequence/TweenLoop from `@dcl/sdk/ecs` over @dcl-sdk/utils tween helpers.

```typescript
import { Tween, TweenSequence, TweenLoop, EasingFunction } from '@dcl/sdk/ecs'
```

### Concise Helper Methods

```typescript
// Move between two points (duration in milliseconds)
Tween.setMove(entity,
  Vector3.create(4, 1, 4),   // start
  Vector3.create(8, 1, 8),   // end
  2000,                       // duration ms
  { faceDirection: false, easingFunction: EasingFunction.EF_LINEAR }
)

// Rotate between two rotations
Tween.setRotate(entity,
  Quaternion.fromEulerDegrees(0, 0, 0),
  Quaternion.fromEulerDegrees(0, 180, 0),
  700,
  EasingFunction.EF_EASEOUTBOUNCE
)

// Scale between sizes
Tween.setScale(entity,
  Vector3.create(1, 1, 1),
  Vector3.create(4, 4, 4),
  2000,
  EasingFunction.EF_LINEAR
)

// Animate texture offset (UV scrolling)
Tween.setTextureMove(entity,
  Vector2.create(0, 0),
  Vector2.create(1, 0),
  2000
)

// Continuous movement (meters/second)
Tween.setMoveContinuous(entity, Vector3.create(0, 0, 1), 0.7)

// Continuous rotation (degrees/second)
Tween.setRotateContinuous(entity, Quaternion.fromEulerDegrees(0, -1, 0), 700)

// Continuous texture scroll
Tween.setTextureMoveContinuous(entity, Vector2.create(0, 1), 2000)
```

### Verbose Tween.create Approach

```typescript
// Move
Tween.create(entity, {
  mode: Tween.Mode.Move({
    start: Vector3.create(4, 1, 4),
    end: Vector3.create(8, 1, 8)
  }),
  duration: 2000,
  easingFunction: EasingFunction.EF_LINEAR
})

// Rotate
Tween.create(entity, {
  mode: Tween.Mode.Rotate({
    start: Quaternion.fromEulerDegrees(0, 0, 0),
    end: Quaternion.fromEulerDegrees(0, 180, 0)
  }),
  duration: 1000,
  easingFunction: EasingFunction.EF_EASEOUTBOUNCE
})

// Scale
Tween.create(entity, {
  mode: Tween.Mode.Scale({
    start: Vector3.create(1, 1, 1),
    end: Vector3.create(2, 2, 2)
  }),
  duration: 1500,
  easingFunction: EasingFunction.EF_EASEINEXPO
})
```

### TweenSequence

Chain multiple tweens that play in order:

```typescript
// First, create the initial tween on the entity
Tween.create(entity, {
  mode: Tween.Mode.Move({
    start: Vector3.create(4, 1, 4),
    end: Vector3.create(8, 1, 8)
  }),
  duration: 2000,
  easingFunction: EasingFunction.EF_LINEAR
})

// Then create the sequence with subsequent tweens
TweenSequence.create(entity, {
  sequence: [
    {
      mode: Tween.Mode.Move({
        start: Vector3.create(8, 1, 8),
        end: Vector3.create(8, 3, 8)
      }),
      duration: 1000,
      easingFunction: EasingFunction.EF_LINEAR
    },
    {
      mode: Tween.Mode.Rotate({
        start: Quaternion.fromEulerDegrees(0, 0, 0),
        end: Quaternion.fromEulerDegrees(0, 360, 0)
      }),
      duration: 1000,
      easingFunction: EasingFunction.EF_LINEAR
    }
  ],
  loop: TweenLoop.TL_RESTART  // or TL_YOYO, or omit for no loop
})
```

### TweenLoop Values
- `TweenLoop.TL_RESTART` -- plays forward, resets, repeats
- `TweenLoop.TL_YOYO` -- plays forward then backward

### Yoyo (back-and-forth)

```typescript
Tween.create(entity, {
  mode: Tween.Mode.Move({
    start: Vector3.create(4, 1, 4),
    end: Vector3.create(8, 1, 8)
  }),
  duration: 2000,
  easingFunction: EasingFunction.EF_LINEAR
})

TweenSequence.create(entity, {
  sequence: [],
  loop: TweenLoop.TL_YOYO
})
```

### Tween Control

```typescript
// Pause/resume
const tweenData = Tween.getMutable(entity)
tweenData.playing = false  // Pause
tweenData.playing = true   // Resume
tweenData.currentTime = 0  // Reset

// Remove tween
Tween.deleteFrom(entity)
TweenSequence.deleteFrom(entity)

// Detect completion in system
engine.addSystem(() => {
  if (tweenSystem.tweenCompleted(entity)) {
    console.log('Tween finished!')
  }
})
```

### EasingFunction Values

`EF_LINEAR`, `EF_EASEINQUAD`, `EF_EASEOUTQUAD`, `EF_EASEINOUTQUAD`, `EF_EASEINSINE`, `EF_EASEOUTSINE`, `EF_EASEINOUTSINE`, `EF_EASEINEXPO`, `EF_EASEOUTEXPO`, `EF_EASEINOUTEXPO`, `EF_EASEINELASTIC`, `EF_EASEOUTELASTIC`, `EF_EASEINOUTELASTIC`, `EF_EASEINBOUNCE`, `EF_EASEOUTBOUNCE`, `EF_EASEINOUTBOUNCE`.

## Animator (GLTF Animations)

```typescript
import { Animator } from '@dcl/sdk/ecs'

// Create with animation states
Animator.create(entity, {
  states: [
    {
      clip: 'swim',
      playing: true,
      loop: true,
      speed: 1.0,
      weight: 1.0
    },
    {
      clip: 'bite',
      playing: false,
      loop: false,
      speed: 1.0,
      weight: 0.0,
      shouldReset: true  // Return to first frame when done
    }
  ]
})

// Play a single animation (stops others)
Animator.playSingleAnimation(entity, 'swim')

// Stop all animations
Animator.stopAllAnimations(entity)

// Get and modify a clip
const clip = Animator.getClip(entity, 'swim')
if (clip) {
  clip.speed = 0.5
  clip.weight = 0.8
}
```

## LightSource

```typescript
import { LightSource, PBLightSource_ShadowType } from '@dcl/sdk/ecs'
import { Color3 } from '@dcl/sdk/math'

// Point light
const point = engine.addEntity()
Transform.create(point, { position: Vector3.create(10, 3, 10) })
LightSource.create(point, {
  type: LightSource.Type.Point({}),
  color: Color3.White(),
  intensity: 300  // candela
})

// Spot light with shadows
const spot = engine.addEntity()
Transform.create(spot, {
  position: Vector3.create(8, 4, 8),
  rotation: Quaternion.fromEulerDegrees(-90, 0, 0)
})
LightSource.create(spot, {
  type: LightSource.Type.Spot({
    innerAngle: 25,
    outerAngle: 45,
    shadow: PBLightSource_ShadowType.ST_HARD,  // ST_HARD, ST_SOFT, ST_NONE
    shadowMaskTexture: Material.Texture.Common({ src: 'assets/lightmask.png' })
  }),
  shadow: true,
  intensity: 800
})

// Toggle light
const lightData = LightSource.getMutable(point)
lightData.active = !lightData.active

// Set range
LightSource.getMutable(point).range = 20
```

Notes:
- One active light per parcel maximum; lights/shadows are auto-culled based on quality and proximity (up to ~3 shadowed lights visible at once).
- Intensity is in candela; visible distance roughly grows with sqrt(intensity).

## Manual Movement via Systems

```typescript
// Custom component for movement data
const MoveComponent = engine.defineComponent('MoveComponent', {
  start: Schemas.Vector3,
  end: Schemas.Vector3,
  speed: Schemas.Number,
  fraction: Schemas.Number
})

function moveSystem(dt: number) {
  for (const [entity, moveData] of engine.getEntitiesWith(MoveComponent)) {
    const transform = Transform.getMutable(entity)
    const data = MoveComponent.getMutable(entity)

    if (data.fraction < 1) {
      data.fraction += dt * data.speed
      transform.position = Vector3.lerp(data.start, data.end, data.fraction)
    }
  }
}

engine.addSystem(moveSystem)
```
