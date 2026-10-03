import { useProgress } from '@react-three/drei'
import { useEffect, useMemo, useState } from 'react'

const MIN_VISIBLE_MS = 1300
const EXIT_MS = 520

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export default function LoadingOverlay() {
  const { active, progress, loaded, total, item } = useProgress()
  const [phase, setPhase] = useState('visible')
  const [startedAt] = useState(() => performance.now())

  const normalizedProgress = useMemo(() => {
    if (total > 0) return clamp(progress, 0, 100)
    return active ? 18 : 100
  }, [active, progress, total])

  useEffect(() => {
    if (phase !== 'visible') return undefined
    if (active) return undefined
    if (total > 0 && loaded < total) return undefined

    const elapsed = performance.now() - startedAt
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed)

    const timer = window.setTimeout(() => {
      setPhase('leaving')
      window.setTimeout(() => setPhase('hidden'), EXIT_MS)
    }, wait)

    return () => window.clearTimeout(timer)
  }, [active, loaded, phase, startedAt, total])

  if (phase === 'hidden') return null

  const status =
    normalizedProgress < 30
      ? 'Waking Nova'
      : normalizedProgress < 70
        ? 'Preparing digital twin'
        : normalizedProgress < 96
          ? 'Loading robot systems'
          : 'Ready'

  return (
    <div
      className={'loading-overlay ' + (phase === 'leaving' ? 'leaving' : '')}
      role="status"
      aria-live="polite"
      aria-label={'Loading Nova digital twin: ' + Math.round(normalizedProgress) + '%'}
    >
      <div className="loading-ambient loading-ambient-one" />
      <div className="loading-ambient loading-ambient-two" />

      <div className="loading-content">
        <div className="loading-brand">
          <span>NOVA ROBOTICS</span>
          <strong>Digital Twin</strong>
        </div>

        <div className="loading-face-shell">
          <div className="loading-face-ring">
            <video
              className="loading-face-video"
              src="/animations/blinking.mov"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            />
            <div className="loading-face-fallback" aria-hidden="true">
              <i />
              <i />
            </div>
          </div>
        </div>

        <div className="loading-copy">
          <strong>{status}</strong>
          <span>
            {item ? 'Loading ' + item.split('/').pop() : 'Initializing visual systems'}
          </span>
        </div>

        <div className="loading-progress">
          <div
            className="loading-progress-fill"
            style={{ width: normalizedProgress + '%' }}
          />
        </div>

        <div className="loading-meta">
          <span>{Math.round(normalizedProgress)}%</span>
          <span>{total > 0 ? loaded + ' / ' + total + ' assets' : 'Starting'}</span>
        </div>
      </div>
    </div>
  )
}
