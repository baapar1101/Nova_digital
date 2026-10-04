import { useCallback, useEffect, useRef, useState } from 'react'

const ICE_TIMEOUT_MS = 10_000
const CLOSE_TIMEOUT_MS = 4_000

function waitForIceGathering(connection) {
  if (connection.iceGatheringState === 'complete') {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      connection.removeEventListener('icegatheringstatechange', onState)
      reject(new Error('Timed out while preparing the voice connection.'))
    }, ICE_TIMEOUT_MS)

    function onState() {
      if (connection.iceGatheringState !== 'complete') return
      window.clearTimeout(timeout)
      connection.removeEventListener('icegatheringstatechange', onState)
      resolve()
    }

    connection.addEventListener('icegatheringstatechange', onState)
    onState()
  })
}

function trimTranscript(value) {
  const limit = 1600
  return value.length > limit ? value.slice(value.length - limit) : value
}

export function useGptLive() {
  const peerRef = useRef(null)
  const eventsRef = useRef(null)
  const microphoneRef = useRef(null)
  const audioRef = useRef(null)
  const closeTimerRef = useRef(null)
  const speakingTimerRef = useRef(null)
  const finalizedRef = useRef(false)

  const [status, setStatus] = useState('off')
  const [connected, setConnected] = useState(false)
  const [muted, setMuted] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [userTranscript, setUserTranscript] = useState('')
  const [assistantTranscript, setAssistantTranscript] = useState('')
  const [usageSeconds, setUsageSeconds] = useState(0)
  const [error, setError] = useState('')

  const cleanup = useCallback(() => {
    window.clearTimeout(closeTimerRef.current)
    window.clearTimeout(speakingTimerRef.current)
    closeTimerRef.current = null
    speakingTimerRef.current = null

    microphoneRef.current?.getTracks().forEach((track) => track.stop())
    microphoneRef.current = null

    try {
      eventsRef.current?.close()
    } catch {
      // Connection may already be closed.
    }
    eventsRef.current = null

    try {
      peerRef.current?.close()
    } catch {
      // Peer may already be closed.
    }
    peerRef.current = null

    if (audioRef.current) {
      audioRef.current.srcObject = null
    }

    setConnected(false)
    setMuted(false)
    setStatus('off')
  }, [])

  const markSpeaking = useCallback(() => {
    setStatus('speaking')
    window.clearTimeout(speakingTimerRef.current)
    speakingTimerRef.current = window.setTimeout(() => {
      setStatus((current) => (current === 'speaking' ? 'listening' : current))
    }, 850)
  }, [])

  const handleServerEvent = useCallback(
    (event) => {
      switch (event.type) {
        case 'session.started':
          setConnected(true)
          setSessionId(event.session?.id || '')
          setStatus('listening')
          setError('')
          break

        case 'session.input_transcript.delta':
          setUserTranscript((current) =>
            trimTranscript(current + (event.delta || '')),
          )
          setStatus((current) =>
            current === 'speaking' ? current : 'listening',
          )
          break

        case 'session.output_transcript.delta':
          setAssistantTranscript((current) =>
            trimTranscript(current + (event.delta || '')),
          )
          markSpeaking()
          break

        case 'session.usage.updated':
          if (Number.isFinite(event.usage?.seconds)) {
            setUsageSeconds(event.usage.seconds)
          }
          break

        case 'session.closed':
          finalizedRef.current = true
          if (Number.isFinite(event.usage?.seconds)) {
            setUsageSeconds(event.usage.seconds)
          }
          cleanup()
          break

        case 'error':
          setError(
            event.error?.message ||
              event.message ||
              'GPT-Live reported a session error.',
          )
          break

        default:
          break
      }
    },
    [cleanup, markSpeaking],
  )

  const start = useCallback(async () => {
    if (status !== 'off' && status !== 'error') return

    setError('')
    setStatus('connecting')
    setUserTranscript('')
    setAssistantTranscript('')
    setUsageSeconds(0)
    setSessionId('')
    finalizedRef.current = false

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setError('Microphone access is not supported in this browser.')
      return
    }

    try {
      const connection = new RTCPeerConnection()
      peerRef.current = connection

      connection.addEventListener('track', (event) => {
        const stream =
          event.streams?.[0] || new MediaStream(event.track ? [event.track] : [])

        if (!audioRef.current) return
        audioRef.current.srcObject = stream
        audioRef.current.play().catch(() => {
          setError('Tap the screen once to allow Nova voice playback.')
        })
      })

      connection.addEventListener('connectionstatechange', () => {
        if (
          ['failed', 'disconnected'].includes(connection.connectionState) &&
          !finalizedRef.current
        ) {
          setError('GPT-Live voice connection was interrupted.')
          cleanup()
          setStatus('error')
        }
      })

      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
      microphoneRef.current = microphone

      for (const track of microphone.getAudioTracks()) {
        connection.addTrack(track, microphone)
      }

      const events = connection.createDataChannel('oai-events')
      eventsRef.current = events

      events.addEventListener('message', ({ data }) => {
        try {
          handleServerEvent(JSON.parse(data))
        } catch {
          setError('Received an invalid GPT-Live event.')
        }
      })

      events.addEventListener('close', () => {
        if (finalizedRef.current) return
        cleanup()
      })

      const offer = await connection.createOffer()
      await connection.setLocalDescription(offer)
      await waitForIceGathering(connection)

      const sdp = connection.localDescription?.sdp
      if (!sdp) throw new Error('Could not create the WebRTC offer.')

      const response = await fetch('/api/live-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sdp }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          result.error ||
            result.message ||
            'The GPT-Live session could not be created.',
        )
      }

      const answer = result.transport?.sdp
      if (!answer) {
        throw new Error('GPT-Live did not return a WebRTC answer.')
      }

      setSessionId(result.session?.id || '')
      await connection.setRemoteDescription({
        type: 'answer',
        sdp: answer,
      })
    } catch (startError) {
      cleanup()
      setStatus('error')

      if (
        startError?.name === 'NotAllowedError' ||
        startError?.name === 'PermissionDeniedError'
      ) {
        setError('Microphone permission was denied. Allow microphone access and try again.')
      } else {
        setError(startError?.message || 'Unable to start GPT-Live.')
      }
    }
  }, [cleanup, handleServerEvent, status])

  const stop = useCallback(() => {
    const events = eventsRef.current

    if (events?.readyState === 'open' && connected) {
      setStatus('closing')
      events.send(JSON.stringify({ type: 'session.close' }))
      closeTimerRef.current = window.setTimeout(() => {
        cleanup()
      }, CLOSE_TIMEOUT_MS)
      return
    }

    cleanup()
  }, [cleanup, connected])

  const toggleMute = useCallback(() => {
    const tracks = microphoneRef.current?.getAudioTracks() || []
    if (!tracks.length) return

    const nextMuted = !muted
    for (const track of tracks) {
      track.enabled = !nextMuted
    }
    setMuted(nextMuted)
  }, [muted])

  useEffect(
    () => () => {
      finalizedRef.current = true
      cleanup()
    },
    [cleanup],
  )

  return {
    audioRef,
    status,
    connected,
    muted,
    sessionId,
    userTranscript,
    assistantTranscript,
    usageSeconds,
    error,
    start,
    stop,
    toggleMute,
  }
}
