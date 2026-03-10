import { engine, inputSystem, InputAction, PointerEventType, Transform } from '@dcl/sdk/ecs'
import { PlayerState } from './types'
import { setPlayerAngle } from './player'

export interface InputState {
  forward: number
  strafe: number
  shoot: boolean
  use: boolean
}

// Debounce flag for door use — fires once per press
let useWasPressed = false

export function readInput(): InputState {
  let forward = 0
  let strafe = 0

  if (inputSystem.isPressed(InputAction.IA_FORWARD)) forward += 1
  if (inputSystem.isPressed(InputAction.IA_BACKWARD)) forward -= 1
  if (inputSystem.isPressed(InputAction.IA_LEFT)) strafe -= 1
  if (inputSystem.isPressed(InputAction.IA_RIGHT)) strafe += 1

  const shoot =
    inputSystem.isPressed(InputAction.IA_PRIMARY) ||
    inputSystem.isPressed(InputAction.IA_POINTER)

  // Use door: IA_SECONDARY (F key), debounced to fire once per press
  const useDown = inputSystem.isPressed(InputAction.IA_SECONDARY)
  const use = useDown && !useWasPressed
  useWasPressed = useDown

  return { forward, strafe, shoot, use }
}

export function syncPlayerAngleFromCamera(player: PlayerState): void {
  const cameraTransform = Transform.getOrNull(engine.CameraEntity)
  if (!cameraTransform) return

  const rot = cameraTransform.rotation
  // Extract yaw from quaternion
  // yaw = atan2(2(qw*qy + qx*qz), 1 - 2(qy^2 + qz^2))
  const qw = rot.w
  const qx = rot.x
  const qy = rot.y
  const qz = rot.z

  const yaw = Math.atan2(2 * (qw * qy + qx * qz), 1 - 2 * (qy * qy + qz * qz))

  // Pass yaw directly to raycaster direction
  setPlayerAngle(player, yaw)
}

export function checkToggle(): boolean {
  // IA_ACTION_6 = key 4 to toggle DOOM mode
  return inputSystem.isTriggered(InputAction.IA_ACTION_6, PointerEventType.PET_DOWN)
}
