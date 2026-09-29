import { useCallback, useEffect, useRef, useState } from 'react'

const initialState = {
  type: 'state',
  mode: 'simulation',
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
  joint_limits: {
    head_pan: { min: -Math.PI / 2, max: Math.PI / 2 },
    head_tilt: { min: 0, max: Math.PI / 4 },
  },
  battery: 100,
}

function defaultWebSocketUrl() {
  if (import.meta.env.VITE_ROBOT_WS_URL) {
    return import.meta.env.VITE_ROBOT_WS_URL
  }

  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
  return protocol + window.location.hostname + ':8000/ws/robot'
}

export function useRobotSocket() {
  const socketRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [state, setState] = useState(initialState)
  const [lastError, setLastError] = useState('')

  useEffect(() => {
    let stopped = false

    const connect = () => {
      if (stopped) return

      const socket = new WebSocket(defaultWebSocketUrl())
      socketRef.current = socket

      socket.onopen = () => {
        setConnected(true)
        setLastError('')
      }

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'state') {
            setState(message)
          } else if (message.type === 'error') {
            setLastError(message.message || 'Backend error')
          }
        } catch {
          setLastError('Received invalid JSON from backend')
        }
      }

      socket.onerror = () => {
        setLastError('WebSocket connection error')
      }

      socket.onclose = () => {
        setConnected(false)
        if (!stopped) {
          reconnectTimerRef.current = window.setTimeout(connect, 1500)
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
    return false
  }, [])

  return { connected, state, lastError, send }
}
