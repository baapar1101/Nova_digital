import { useCallback, useEffect, useRef, useState } from 'react'
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'

const WASM_ROOT =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

const DEG_TO_RAD = Math.PI / 180
const PAN_MIN = -90 * DEG_TO_RAD
const PAN_MAX = 90 * DEG_TO_RAD
const TILT_MIN = 0
const TILT_MAX = 45 * DEG_TO_RAD

const DETECTION_INTERVAL_MS = 72
const CONTROL_INTERVAL_MS = 90
const DEADZONE = 0.055

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

function strongestDetection(detections = []) {
  if (!detections.length) return null

  return detections.reduce((best, detection) => {
    const box = detection.boundingBox
    const area = box ? box.width * box.height : 0
    const bestBox = best?.boundingBox
    const bestArea = bestBox ? bestBox.width * bestBox.height : 0
    return area > bestArea ? detection : best
  }, detections[0])
}

function normalizeBox(detection, video) {
  const box = detection?.boundingBox
  if (!box || !video.videoWidth || !video.videoHeight) return null

  const x = box.originX / video.videoWidth
  const y = box.originY / video.videoHeight
  const width = box.width / video.videoWidth
  const height = box.height / video.videoHeight
  const centerX = x + width / 2
  const centerY = y + height / 2

  return {
    x,
    y,
    width,
    height,
    centerX,
    centerY,
    confidence: detection.categories?.[0]?.score ?? 0,
  }
}

async function createDetector() {
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT)

  for (const delegate of ['GPU', 'CPU']) {
    try {
      return await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate,
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.55,
        minSuppressionThreshold: 0.3,
      })
    } catch (error) {
      if (delegate === 'CPU') throw error
    }
  }

  throw new Error('Unable to initialize face detector')
}

export function useFaceTracker({ send, state, onBeforeStart }) {
  const videoRef = useRef(null)
  const detectorRef = useRef(null)
  const detectorPromiseRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const runningRef = useRef(false)
  const stateRef = useRef(state)
  const lastDetectRef = useRef(0)
  const lastControlRef = useRef(0)
  const lastVideoTimeRef = useRef(-1)
  const smoothedErrorRef = useRef({ x: 0, y: 0 })

  const [tracking, setTracking] = useState(false)
  const [status, setStatus] = useState('off')
  const [error, setError] = useState('')
  const [face, setFace] = useState(null)
  const [sensitivity, setSensitivity] = useState(1)
  const [invertPan, setInvertPan] = useState(false)
  const [invertTilt, setInvertTilt] = useState(false)

  stateRef.current = state

  const ensureDetector = useCallback(async () => {
    if (detectorRef.current) return detectorRef.current

    if (!detectorPromiseRef.current) {
      detectorPromiseRef.current = createDetector()
        .then((detector) => {
          detectorRef.current = detector
          return detector
        })
        .finally(() => {
          detectorPromiseRef.current = null
        })
    }

    return detectorPromiseRef.current
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }

    const video = videoRef.current
    if (video) {
      video.srcObject = null
    }
  }, [])

  const stop = useCallback(() => {
    runningRef.current = false

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    stopCamera()
    setTracking(false)
    setFace(null)
    setStatus('off')
    smoothedErrorRef.current = { x: 0, y: 0 }
  }, [stopCamera])

  const applyTrackingControl = useCallback(
    (normalizedFace, now) => {
      if (now - lastControlRef.current < CONTROL_INTERVAL_MS) return

      const elapsed =
        lastControlRef.current > 0
          ? Math.min((now - lastControlRef.current) / 1000, 0.18)
          : CONTROL_INTERVAL_MS / 1000

      lastControlRef.current = now

      const rawX = normalizedFace.centerX - 0.5
      const rawY = normalizedFace.centerY - 0.5

      const previous = smoothedErrorRef.current
      const smoothing = 0.28
      const errorX = previous.x + (rawX - previous.x) * smoothing
      const errorY = previous.y + (rawY - previous.y) * smoothing
      smoothedErrorRef.current = { x: errorX, y: errorY }

      const current = stateRef.current
      const currentPan =
        current.joint_targets?.head_pan ?? current.joints?.head_pan ?? 0
      const currentTilt =
        current.joint_targets?.head_tilt ?? current.joints?.head_tilt ?? 0

      const panError = Math.abs(errorX) > DEADZONE ? errorX : 0
      const tiltError = Math.abs(errorY) > DEADZONE ? errorY : 0

      if (panError === 0 && tiltError === 0) {
        setStatus('locked')
        return
      }

      const panDirection = invertPan ? -1 : 1
      const tiltDirection = invertTilt ? -1 : 1

      // Convert image-space error into a bounded angular velocity. The camera
      // is fixed to the head, so repeated small corrections converge naturally.
      const panRate = 82 * DEG_TO_RAD * sensitivity
      const tiltRate = 58 * DEG_TO_RAD * sensitivity

      const nextPan = clamp(
        currentPan + panDirection * panError * panRate * elapsed,
        PAN_MIN,
        PAN_MAX,
      )

      // Image Y grows downward. A face above center therefore produces
      // positive/upward tilt with the default direction.
      const nextTilt = clamp(
        currentTilt - tiltDirection * tiltError * tiltRate * elapsed,
        TILT_MIN,
        TILT_MAX,
      )

      send({
        type: 'joint_target',
        joint: 'head_pan',
        target: nextPan,
      })
      send({
        type: 'joint_target',
        joint: 'head_tilt',
        target: nextTilt,
      })

      setStatus('tracking')
    },
    [invertPan, invertTilt, send, sensitivity],
  )

  const start = useCallback(async () => {
    if (runningRef.current) return

    setError('')
    setStatus('starting')
    onBeforeStart?.()

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setError('Camera access is not supported in this browser.')
      return
    }

    try {
      const detector = await ensureDetector()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })

      streamRef.current = stream

      const video = videoRef.current
      if (!video) {
        throw new Error('Camera preview is not ready.')
      }

      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      await video.play()

      runningRef.current = true
      setTracking(true)
      setStatus('searching')
      lastDetectRef.current = 0
      lastControlRef.current = 0
      lastVideoTimeRef.current = -1

      const detectLoop = (now) => {
        if (!runningRef.current) return

        const currentVideo = videoRef.current
        if (
          currentVideo &&
          currentVideo.readyState >= 2 &&
          currentVideo.videoWidth > 0 &&
          now - lastDetectRef.current >= DETECTION_INTERVAL_MS &&
          currentVideo.currentTime !== lastVideoTimeRef.current
        ) {
          lastDetectRef.current = now
          lastVideoTimeRef.current = currentVideo.currentTime

          try {
            const result = detector.detectForVideo(currentVideo, now)
            const detection = strongestDetection(result.detections)
            const normalized = normalizeBox(detection, currentVideo)

            if (normalized) {
              setFace(normalized)
              applyTrackingControl(normalized, now)
            } else {
              setFace(null)
              setStatus('searching')
              smoothedErrorRef.current = { x: 0, y: 0 }
            }
          } catch (detectionError) {
            setError('Face detection paused: ' + detectionError.message)
          }
        }

        rafRef.current = requestAnimationFrame(detectLoop)
      }

      rafRef.current = requestAnimationFrame(detectLoop)
    } catch (startError) {
      stopCamera()
      setTracking(false)
      setStatus('error')

      if (
        startError?.name === 'NotAllowedError' ||
        startError?.name === 'PermissionDeniedError'
      ) {
        setError('Camera permission was denied. Allow camera access and try again.')
      } else {
        setError(startError?.message || 'Unable to start face tracking.')
      }
    }
  }, [applyTrackingControl, ensureDetector, onBeforeStart, stopCamera])

  useEffect(
    () => () => {
      runningRef.current = false

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }

      stopCamera()
      detectorRef.current?.close?.()
      detectorRef.current = null
    },
    [stopCamera],
  )

  return {
    videoRef,
    tracking,
    status,
    error,
    face,
    sensitivity,
    setSensitivity,
    invertPan,
    setInvertPan,
    invertTilt,
    setInvertTilt,
    start,
    stop,
  }
}
