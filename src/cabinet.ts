// The arcade cabinet DOOM lives in.
//
// The parcel holds one cabinet (assets/cabinet, from the hackathon scene). Pressing E on it enters the arcade:
// the avatar is frozen and hidden, the pointer is locked, a VirtualCamera is parked in front of the cabinet's
// screen so the DOOM panel drawn by the presenters sits over it, and once the camera has finished its transition
// the engine starts ticking and the game appears. Leaving reverses every step; the engine keeps its state, so the
// game resumes where it was.
import {
  AvatarModifierArea,
  AvatarModifierType,
  ColliderLayer,
  engine,
  Entity,
  GltfContainer,
  InputAction,
  InputModifier,
  MainCamera,
  Material,
  MeshRenderer,
  PointerLock,
  pointerEventsSystem,
  TextAlignMode,
  TextShape,
  Transform,
  VirtualCamera
} from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'

/** Cabinet base position in the 16x16 m parcel; the model's front (controls, screen) faces -z at yaw 0. */
export const CABINET_POSITION = Vector3.create(8, 0, 10)
export const CABINET_YAW_DEG = 0
/** Centre of the screen glass in model space (from the GLB: scanline planes y 1.46..2.35, z -0.19..0.12). */
const SCREEN_CENTER = Vector3.create(0, 1.88, -0.08)
/** The screen leans back by this much from vertical. */
const SCREEN_TILT_DEG = 15
/** Black boxes (model space) over the branded parts of the model: the marquee sign at the top front (a plane at
 *  z -0.274, y 2.60..2.74) and the whole back face (body back at z 0.578, side panels reaching z 0.648). */
const MARQUEE_COVER = { position: Vector3.create(0, 2.67, -0.285), scale: Vector3.create(0.92, 0.24, 0.02) }
const BACK_COVER = { position: Vector3.create(0, 1.23, 0.62), scale: Vector3.create(1.12, 2.848, 0.064) }
const MARQUEE_TEXT = 'DECENTRADOOM'
/** Camera distance from the screen along its normal (the glass then spans the DOOM panel's height), and where it
 *  aims: the DOOM panel sits 40 px below the centre of the 1080 px canvas, so the camera aims that much above the
 *  glass centre to land the panel on the glass (verified in-world). */
const CAMERA_DISTANCE = 1.0
const CAMERA_AIM_RISE = 0.033
const INTERACTION_DISTANCE = 6
/** Camera transition into the cabinet; the game appears when the client camera reaches the virtual camera (within
 *  CAMERA_SETTLED_M) or, failing that, after the transition time plus a margin. */
const TRANSITION_S = 0.6
const CAMERA_SETTLED_M = 0.02
const TRANSITION_TIMEOUT_S = TRANSITION_S + 1
/** The avatar-hiding volume covers the parcel while playing and sits far below it otherwise. */
const HIDE_ZONE_ACTIVE = Vector3.create(8, 4, 8)
const HIDE_ZONE_PARKED = Vector3.create(8, -100, 8)

export const arcade = {
  /** True once the camera has settled on the cabinet: the engine ticks and the presenters draw. */
  active: false,
  /** True once the screen has finished growing out of the cabinet: the settings panel and controls show. */
  screenOn: false
}

/** Between the E press and the camera settling: the avatar is already frozen, nothing is drawn yet. */
let entering = false
let enteringFor = 0
let cabinet: Entity
let camera: Entity
let hideZone: Entity
let onEnter: () => void = () => {}
let onLeave: () => void = () => {}

export function setupCabinet(hooks: { onEnter: () => void; onLeave: () => void }) {
  onEnter = hooks.onEnter
  onLeave = hooks.onLeave

  const rotation = Quaternion.fromEulerDegrees(0, CABINET_YAW_DEG, 0)
  cabinet = engine.addEntity()
  Transform.create(cabinet, { position: CABINET_POSITION, rotation })
  GltfContainer.create(cabinet, {
    src: 'assets/cabinet/arcadeCabinetDecentraland.glb',
    visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
    invisibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER
  })

  const marquee = addCover(MARQUEE_COVER)
  addCover(BACK_COVER)

  // The sign: a child of the marquee cover, so it inherits the cover's placement; the cover's non-uniform scale is
  // cancelled so the glyphs keep their proportions. Sits just in front of the cover's front face (local z -0.5).
  const sign = engine.addEntity()
  Transform.create(sign, {
    parent: marquee,
    position: Vector3.create(0, 0, -0.6),
    scale: Vector3.create(1 / MARQUEE_COVER.scale.x, 1 / MARQUEE_COVER.scale.y, 1 / MARQUEE_COVER.scale.z)
  })
  TextShape.create(sign, {
    text: MARQUEE_TEXT,
    fontSize: 1.05,
    textColor: Color4.create(1, 0.15, 0.1, 1),
    textAlign: TextAlignMode.TAM_MIDDLE_CENTER,
    textWrapping: false
  })

  // Camera on the screen normal, looking at a point on the glass. Both are children of the cabinet so moving or
  // turning it keeps the framing.
  const tilt = (SCREEN_TILT_DEG * Math.PI) / 180
  const normal = Vector3.create(0, Math.sin(tilt), -Math.cos(tilt))
  const aim = engine.addEntity()
  Transform.create(aim, { parent: cabinet, position: Vector3.add(SCREEN_CENTER, Vector3.create(0, CAMERA_AIM_RISE, 0)) })
  camera = engine.addEntity()
  Transform.create(camera, {
    parent: cabinet,
    position: Vector3.add(SCREEN_CENTER, Vector3.scale(normal, CAMERA_DISTANCE))
  })
  VirtualCamera.create(camera, {
    lookAtEntity: aim,
    defaultTransition: { transitionMode: VirtualCamera.Transition.Time(TRANSITION_S) }
  })

  // Avatars (the player's own included) would stand between the camera and the cabinet: hide them while playing.
  // The area is created once and parked out of reach while idle: the Explorer keeps avatars hidden when the
  // component is deleted from under them, but lets them out when the volume moves away (verified in-world).
  hideZone = engine.addEntity()
  Transform.create(hideZone, { position: HIDE_ZONE_PARKED })
  AvatarModifierArea.create(hideZone, {
    area: Vector3.create(16, 8, 16),
    modifiers: [AvatarModifierType.AMT_HIDE_AVATARS],
    excludeIds: []
  })

  armCabinet()
  engine.addSystem(transitionSystem)
}

function transitionSystem(dt: number) {
  if (!entering) return
  enteringFor += dt
  const settled = cameraSettled()
  if (enteringFor < TRANSITION_TIMEOUT_S && !settled) return
  console.log(`[doom] cabinet camera ${settled ? 'settled' : 'timed out'} after ${enteringFor.toFixed(2)} s`)
  entering = false
  arcade.active = true
  onEnter()
}

/** Is the client camera at the virtual camera's world position? */
function cameraSettled(): boolean {
  const cam = Transform.getOrNull(engine.CameraEntity)
  if (!cam) return false
  const base = Transform.get(cabinet)
  const target = Vector3.add(base.position, Vector3.rotate(Transform.get(camera).position, base.rotation))
  return Vector3.distance(cam.position, target) < CAMERA_SETTLED_M
}

function addCover(cover: { position: Vector3; scale: Vector3 }): Entity {
  const e = engine.addEntity()
  Transform.create(e, { parent: cabinet, position: cover.position, scale: cover.scale })
  MeshRenderer.setBox(e)
  Material.setPbrMaterial(e, { albedoColor: Color4.Black(), roughness: 1, metallic: 0, specularIntensity: 0 })
  return e
}

function armCabinet() {
  pointerEventsSystem.onPointerDown(
    {
      entity: cabinet,
      opts: { button: InputAction.IA_PRIMARY, hoverText: 'Play DOOM', maxDistance: INTERACTION_DISTANCE }
    },
    enterCabinet
  )
}

export function enterCabinet() {
  if (arcade.active || entering) return
  entering = true
  enteringFor = 0
  pointerEventsSystem.removeOnPointerDown(cabinet)

  InputModifier.createOrReplace(engine.PlayerEntity, { mode: InputModifier.Mode.Standard({ disableAll: true }) })
  const lock = PointerLock.getMutableOrNull(engine.CameraEntity) ?? PointerLock.create(engine.CameraEntity)
  lock.isPointerLocked = true
  Transform.getMutable(hideZone).position = HIDE_ZONE_ACTIVE
  MainCamera.createOrReplace(engine.CameraEntity, { virtualCameraEntity: camera })
}

export function leaveCabinet() {
  if (!arcade.active && !entering) return
  if (arcade.active) onLeave()
  arcade.active = false
  arcade.screenOn = false
  entering = false

  const main = MainCamera.getMutableOrNull(engine.CameraEntity)
  if (main) main.virtualCameraEntity = undefined
  Transform.getMutable(hideZone).position = HIDE_ZONE_PARKED
  const lock = PointerLock.getMutableOrNull(engine.CameraEntity)
  if (lock) lock.isPointerLocked = false
  InputModifier.createOrReplace(engine.PlayerEntity, { mode: InputModifier.Mode.Standard({ disableAll: false }) })

  armCabinet()
}
