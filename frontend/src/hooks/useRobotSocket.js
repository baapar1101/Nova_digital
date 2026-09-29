import { useCallback, useEffect, useRef, useState } from 'react'

const LIMITS = {
  head_pan: { min: -Math.PI / 2, max: Math.PI / 2 },
  head_tilt: { min: 0, max: Math.PI / 4 },
}

const MOTION = {
  head_pan: {
    maxVelocity: 105 * Math.PI / 180,
    maxAcceleration: 300 * Math.PI / 180,
  },
  head_tilt: {
    maxVelocity: 75 * Math.PI / 180,
    maxAcceleration: 220 * Math.PI / 180,
  },
}

const initialState = {
  type: 'state',
  mode: 'demo',
  seq: 0,
  timestamp: 0,
  joints: {
    head_pan: 0,
    head_tilt: 0,
  },
  joint_targets: {
    head_pan: 0,
    head_tilt: 0,
  },
  joint_velocity: {
    head_pan: 0,
    head_tilt: 0,
  },
  joint_limits: LIMITS,
  battery: 100,
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

function moveTowards(current, target, maxDelta) {
  const delta = target - current
  if (Math.abs(delta) <= maxDelta) return target
  return current + Math.sign(delta) * maxDelta
}

function defaultWebSocketUrl() {
  if (import.meta.env.VITE_ROBOT_WS_URL) {
    return import.meta.env.VITE_ROBOT_WS_URL
  }

  // Local development automatically finds the Python backend.
  // Public/Vercel deployments use browser demo mode until a public WSS backend
  // is explicitly configured with VITE_ROBOT_WS_URL.
  const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'

  if (!isLocal) return null

  return 'ws://' + window.location.hostname + ':8000/ws/robot'
}

export function useRobotSocket() {
  const socketRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const stateRef = useRef(initialState)
  const targetRef = useRef({ ...initialState.joint_targets })
  const velocityRef = useRef({ ...initialState.joint_velocity })

  const backendUrlRef = useRef(defaultWebSocketUrl())
  const [connected, setConnected] = useState(false)
  const [transport, setTransport] = useState(
    backendUrlRef.current ? 'connecting' : 'demo',
  )
  const [state, setState] = useState(initialState)
  const [lastError, setLastError] = useState('')

  useEffect(() => {
    if (transport !== 'demo') return undefined

    let previous = performance.now()
    const startedAt = previous

    const timer = window.setInterval(() => {
      const now = performance.now()
      const dt = clamp((now - previous) / 1000, 0, 0.05)
      previous = now

      setState((prev) => {
        const joints = { ...prev.joints }
        const velocities = { ...velocityRef.current }

        for (const name of Object.keys(LIMITS)) {
          const current = joints[name]
          const target = targetRef.current[name]
          const error = target - current
          const { maxVelocity, maxAcceleration } = MOTION[name]

          if (Math.abs(error) < 1e-5 && Math.abs(velocities[name]) < 1e-4) {
            joints[name] = target
            velocities[name] = 0
            continue
          }

          const brakingSpeed = Math.sqrt(
            Math.max(0, 2 * maxAcceleration * Math.abs(error)),
          )
          const desiredVelocity =
            Math.sign(error || 1) * Math.min(maxVelocity, brakingSpeed)

          velocities[name] = moveTowards(
            velocities[name],
            desiredVelocity,
            maxAcceleration * dt,
          )

          const nextPosition = current + velocities[name] * dt

          if ((target - current) * (target - nextPosition) <= 0) {
            joints[name] = target
            velocities[name] = 0
          } else {
            joints[name] = clamp(
              nextPosition,
              LIMITS[name].min,
              LIMITS[name].max,
            )
          }
        }

        velocityRef.current = velocities

        const nextState = {
          ...prev,
          mode: 'demo',
          seq: prev.seq + 1,
          timestamp: (now - startedAt) / 1000,
          joints,
          joint_targets: { ...targetRef.current },
          joint_velocity: velocities,
          joint_limits: LIMITS,
        }

        stateRef.current = nextState
        return nextState
      })
    }, 1000 / 30)

    return () => window.clearInterval(timer)
  }, [transport])

  useEffect(() => {
    const url = backendUrlRef.current
    if (!url) {
      setTransport('demo')
      return undefined
    }

    let stopped = false

    const connect = () => {
      if (stopped) return

      setTransport((current) => (current === 'python' ? current : 'connecting'))
      const socket = new WebSocket(url)
      socketRef.current = socket

      socket.onopen = () => {
        setConnected(true)
        setTransport('python')
        setLastError('')
      }

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)

          if (message.type === 'state') {
            targetRef.current = {
              ...targetRef.current,
              ...(message.joint_targets || message.joints),
            }
            velocityRef.current = {
              ...velocityRef.current,
              ...(message.joint_velocity || {}),
            }
            stateRef.current = message
            setState(message)
          } else if (message.type === 'error') {
            setLastError(message.message || 'Backend error')
          }
        } catch {
          setLastError('Received invalid JSON from backend')
        }
      }

      socket.onerror = () => {
        // onclose will switch to demo mode and schedule reconnect.
      }

      socket.onclose = () => {
        setConnected(false)
        setTransport('demo')

        if (!stopped) {
          reconnectTimerRef.current = window.setTimeout(connect, 2500)
        }
      }
    }

    connect()

    return () => {
      stopped = true

      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
      }

      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [])

  const send = useCallback((message) => {
    const socket = socketRef.current

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message))
      return true
    }

    if (message.type === 'joint_target') {
      const limits = LIMITS[message.joint]
      if (!limits) return false

      targetRef.current = {
        ...targetRef.current,
        [message.joint]: clamp(
          Number(message.target),
          limits.min,
          limits.max,
        ),
      }
      return true
    }

    if (message.type === 'home') {
      targetRef.current = {
        head_pan: 0,
        head_tilt: 0,
      }
      return true
    }

    if (message.type === 'estop') {
      targetRef.current = { ...stateRef.current.joints }
      velocityRef.current = {
        head_pan: 0,
        head_tilt: 0,
      }
      return true
    }

    return false
  }, [])

  return {
    connected,
    transport,
    state,
    lastError,
    send,
  }
}
