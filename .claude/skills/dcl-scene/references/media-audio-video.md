# Media: Audio & Video

## AudioSource

```typescript
import { AudioSource } from '@dcl/sdk/ecs'

AudioSource.create(entity, {
  audioClipUrl: 'sounds/effect.mp3',
  playing: true,
  loop: false,
  volume: 0.8,
  pitch: 1.0
})

// Control playback
const audio = AudioSource.getMutable(entity)
audio.playing = true
audio.volume = 0.5
```

## AudioStream

Stream audio from a URL:

```typescript
import { AudioStream } from '@dcl/sdk/ecs'

AudioStream.create(entity, {
  url: 'https://example.com/stream.mp3',
  playing: true,
  volume: 0.7
})

// Control
const stream = AudioStream.getMutable(entity)
stream.playing = false
stream.volume = 0.3
```

## Audio Analysis (Advanced)

`AudioAnalysis` component enables real-time frequency and amplitude data from audio sources. `AudioAnalysisView` provides a read-only view of the analysis data in systems. Used for music visualizers, reactive environments, beat-synced animations.

## VideoPlayer

### Basic Setup

```typescript
// Step 1: Create screen entity
const screen = engine.addEntity()
MeshRenderer.setPlane(screen)
Transform.create(screen, { position: Vector3.create(4, 1, 4) })

// Step 2: Create video player
VideoPlayer.create(screen, {
  src: 'videos/myVideo.mp4',  // Local file
  playing: true,
  loop: false,
  volume: 1.0,
  playbackRate: 1.0,
  position: 0  // Start time in seconds
})

// Step 3: Create video texture
const videoTexture = Material.Texture.Video({ videoPlayerEntity: screen })

// Step 4: Apply to material (Basic material recommended for performance)
Material.setBasicMaterial(screen, {
  texture: videoTexture
})
```

### External Video Streaming

```typescript
VideoPlayer.create(screen, {
  src: 'https://player.vimeo.com/external/552481870.m3u8?s=...',
  playing: true
})

// Supported formats: .mp4, .ogg, .webm, .m3u8
```

### Live Streaming

```typescript
VideoPlayer.create(screen, {
  src: 'livekit-video://current-stream',
  playing: true
})
```

### Video Controls

```typescript
// Toggle play/pause
pointerEventsSystem.onPointerDown(
  { entity: screen, opts: { button: InputAction.IA_POINTER, hoverText: 'Play/Pause' } },
  () => {
    const video = VideoPlayer.getMutable(screen)
    video.playing = !video.playing
  }
)

// Stop and rewind
const video = VideoPlayer.getMutable(screen)
video.playing = false
video.position = 0
```

### Video Events

```typescript
import { videoEventsSystem, VideoState } from '@dcl/sdk/ecs'

videoEventsSystem.registerVideoEventsEntity(screen, (videoEvent) => {
  console.log('Video state:', videoEvent.state)
  console.log('Current time:', videoEvent.currentOffset)
  console.log('Video length:', videoEvent.videoLength)

  switch (videoEvent.state) {
    case VideoState.VS_PLAYING: break
    case VideoState.VS_PAUSED: break
    case VideoState.VS_READY: break
    case VideoState.VS_ERROR: break
  }
})

// Get latest video state
const latestEvent = videoEventsSystem.getVideoState(screen)
```

### Enhanced Video Materials

```typescript
// PBR with emissive for self-lit screen
Material.setPbrMaterial(screen, {
  texture: videoTexture,
  roughness: 1.0,
  specularIntensity: 0,
  metallic: 0,
  emissiveTexture: videoTexture,
  emissiveIntensity: 0.6,
  emissiveColor: Color3.White()
})
```

### Multiple Screens Sharing One Video

```typescript
// Only one VideoPlayer component needed
VideoPlayer.create(screen1, { src: 'videos/shared.mp4', playing: true })

// Same texture applied to both screens
const sharedTexture = Material.Texture.Video({ videoPlayerEntity: screen1 })
Material.setBasicMaterial(screen1, { texture: sharedTexture })
Material.setBasicMaterial(screen2, { texture: sharedTexture })
```

### Circular Video Screen

```typescript
const videoTexture = Material.Texture.Video({ videoPlayerEntity: screen })
const alphaMask = Material.Texture.Common({
  src: 'assets/circle_mask.png',
  wrapMode: TextureWrapMode.TWM_MIRROR
})

Material.setBasicMaterial(screen, {
  texture: videoTexture,
  alphaTexture: alphaMask
})
```

### Performance Considerations

Video limits by quality setting:
- Low: 1 simultaneous video
- Medium: 5 simultaneous videos
- High: 10 simultaneous videos

Distance-based video management:

```typescript
function videoPerformanceSystem() {
  const playerPos = Transform.get(engine.PlayerEntity).position

  for (const [entity, video] of engine.getEntitiesWith(VideoPlayer)) {
    const distance = Vector3.distance(playerPos, Transform.get(entity).position)
    const videoMutable = VideoPlayer.getMutable(entity)

    if (distance < 10 && !videoMutable.playing) {
      videoMutable.playing = true
    } else if (distance > 15 && videoMutable.playing) {
      videoMutable.playing = false
    }
  }
}

engine.addSystem(videoPerformanceSystem)
```
