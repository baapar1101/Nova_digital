import { useCallback, useEffect, useRef, useState } from 'react'

const DEG_TO_RAD = Math.PI / 180
const PAN_RANGE_DEGREES = 58
const TILT_RANGE_DEGREES = 38
const COMMAND_INTERVAL_MS = 55

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function useMouseTracker({ send }) {
  const [enabled, setEnabled] = useState(false)
  const enabledRef = useRef(false)
  const latestPoseRef = useRef({ pan: 0, tilt: 0 })
  const frameRef = useRef(null)
  const lastCommandAtRef = useRef(-Infinity)

  const flushPose = useCallback(
    (now) => {
      if (!enabledRef.current) {
        frameRef.current = null
        return
      }

      if (now - lastCommandAtRef.current < COMMAND_INTERVAL_MS) {
        frameRef.current = requestAnimationFrame(flushPose)
        return
      }

      const pose = latestPoseRef.current
      send({ type: 'joint_target', joint: 'head_pan', target: pose.pan })
      send({ type: 'joint_target', joint: 'head_tilt', target: pose.tilt })
      lastCommandAtRef.current = now
      frameRef.current = null
    },
    [send],
  )

  const onPointerMove = useCallback(
    (event) => {
      if (!enabledRef.current) return

      const bounds = event.currentTarget.getBoundingClientRect()
      const x = clamp((event.clientX - bounds.left) / bounds.width, 0, 1)
      const y = clamp((event.clientY - bounds.top) / bounds.height, 0, 1)

      event.currentTarget.style.setProperty('--mouse-x', `${x * 100}%`)
      event.currentTarget.style.setProperty('--mouse-y', `${y * 100}%`)

      latestPoseRef.current = {
        pan: (x * 2 - 1) * PAN_RANGE_DEGREES * DEG_TO_RAD,
        tilt: (1 - y) * TILT_RANGE_DEGREES * DEG_TO_RAD,
      }

      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(flushPose)
      }
    },
    [flushPose],
  )

  const start = useCallback(() => {
    enabledRef.current = true
    lastCommandAtRef.current = -Infinity
    setEnabled(true)
  }, [])

  const stop = useCallback(() => {
    const wasEnabled = enabledRef.current
    enabledRef.current = false

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    setEnabled(false)
    if (wasEnabled) {
      send({ type: 'estop' })
    }
  }, [send])

  useEffect(
    () => () => {
      enabledRef.current = false
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }
    },
    [],
  )

  return {
    enabled,
    onPointerMove,
    start,
    stop,
  }
}
