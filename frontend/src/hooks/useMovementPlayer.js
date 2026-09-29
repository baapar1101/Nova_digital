import { useCallback, useEffect, useRef, useState } from 'react'
import { sampleMovement } from '../movements.js'

const DEG_TO_RAD = Math.PI / 180
const COMMAND_INTERVAL_MS = 40

export function useMovementPlayer({ send, onFaceChange }) {
  const rafRef = useRef(null)
  const runRef = useRef(null)
  const [activeMovementId, setActiveMovementId] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  const cancel = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    runRef.current = null
    setPlaying(false)
    setProgress(0)
  }, [])

  const stop = useCallback(() => {
    cancel()
    send({ type: 'estop' })
  }, [cancel, send])

  const play = useCallback(
    (movement, mode = 'once') => {
      if (!movement) return

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }

      const run = {
        movement,
        mode,
        startedAt: performance.now(),
        lastCommandAt: -Infinity,
      }

      runRef.current = run
      setActiveMovementId(movement.id)
      setPlaying(true)
      setProgress(0)
      onFaceChange?.(movement.face)

      const sendPose = (pose) => {
        send({
          type: 'joint_target',
          joint: 'head_pan',
          target: pose.pan * DEG_TO_RAD,
        })
        send({
          type: 'joint_target',
          joint: 'head_tilt',
          target: pose.tilt * DEG_TO_RAD,
        })
      }

      const tick = (now) => {
        if (runRef.current !== run) return

        const elapsed = now - run.startedAt
        const cycle = elapsed / movement.duration

        if (mode === 'once' && cycle >= 1) {
          sendPose(sampleMovement(movement, 1))
          setProgress(1)
          setPlaying(false)
          runRef.current = null
          rafRef.current = null
          return
        }

        const phase = mode === 'loop' ? cycle % 1 : Math.min(cycle, 1)
        const pose = sampleMovement(movement, phase)

        if (now - run.lastCommandAt >= COMMAND_INTERVAL_MS) {
          sendPose(pose)
          run.lastCommandAt = now
        }

        setProgress(phase)
        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
    },
    [onFaceChange, send],
  )

  useEffect(
    () => () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    },
    [],
  )

  return {
    activeMovementId,
    playing,
    progress,
    play,
    stop,
    cancel,
  }
}
