import { useMemo, useState } from 'react'
import FaceTrackerPanel from './components/FaceTrackerPanel.jsx'
import RobotScene from './components/RobotScene.jsx'
import { useFaceTracker } from './hooks/useFaceTracker.js'
import { useMovementPlayer } from './hooks/useMovementPlayer.js'
import { useRobotSocket } from './hooks/useRobotSocket.js'
import {
  MOVEMENT_CATEGORIES,
  MOVEMENTS,
  getMovementById,
} from './movements.js'

const RAD_TO_DEG = 180 / Math.PI
const DEG_TO_RAD = Math.PI / 180

const SCREEN_ANIMATIONS = [
  { id: 'blinking', label: 'Blink' },
  { id: 'winking', label: 'Wink' },
  { id: 'giggling', label: 'Giggle' },
  { id: 'drinking', label: 'Drink' },
  { id: 'afraiding', label: 'Afraid' },
  { id: 'tireding', label: 'Tired' },
  { id: 'loving', label: 'Love' },
  { id: 'heart-eying', label: 'Heart eyes' },
]

function format(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
}

function deg(radians) {
  return radians * RAD_TO_DEG
}

function TelemetryRow({ label, value, unit = '' }) {
  return (
    <div className="telemetry-row">
      <span>{label}</span>
      <strong>
        {value}
        {unit && <small>{unit}</small>}
      </strong>
    </div>
  )
}

function JointSlider({
  name,
  label,
  actual,
  target,
  minDegrees,
  maxDegrees,
  send,
  beforeChange,
}) {
  const actualDegrees = deg(actual)
  const targetDegrees = deg(target)

  return (
    <label className="joint-control">
      <div className="joint-heading">
        <span>{label}</span>
        <strong>
          {format(actualDegrees)}°
          <small> target {format(targetDegrees)}°</small>
        </strong>
      </div>

      <input
        type="range"
        min={minDegrees}
        max={maxDegrees}
        step="0.5"
        value={targetDegrees}
        onChange={(event) => {
          beforeChange?.()
          send({
            type: 'joint_target',
            joint: name,
            target: Number(event.target.value) * DEG_TO_RAD,
          })
        }}
      />

      <div className="range-labels">
        <span>{minDegrees}°</span>
        <span>{maxDegrees}°</span>
      </div>
    </label>
  )
}

export default function App() {
  const { connected, transport, state, lastError, send } = useRobotSocket()

  const [screenAnimation, setScreenAnimation] = useState('blinking')
  const [movementCategory, setMovementCategory] = useState('social')
  const [selectedMovementId, setSelectedMovementId] = useState('hello')
  const [playMode, setPlayMode] = useState('once')

  const movementPlayer = useMovementPlayer({
    send,
    onFaceChange: setScreenAnimation,
  })

  const faceTracker = useFaceTracker({
    send,
    state,
    onBeforeStart: movementPlayer.cancel,
  })

  const selectedMovement = getMovementById(selectedMovementId)
  const categoryMovements = useMemo(
    () => MOVEMENTS.filter((movement) => movement.category === movementCategory),
    [movementCategory],
  )

  const pan = state.joints.head_pan ?? 0
  const tilt = state.joints.head_tilt ?? 0
  const panTarget = state.joint_targets.head_pan ?? pan
  const tiltTarget = state.joint_targets.head_tilt ?? tilt
  const panVelocity = state.joint_velocity.head_pan ?? 0
  const tiltVelocity = state.joint_velocity.head_tilt ?? 0

  const stopAutomaticControl = () => {
    movementPlayer.cancel()
    faceTracker.stop()
  }

  const setJointDegrees = (joint, degrees) => {
    stopAutomaticControl()
    send({
      type: 'joint_target',
      joint,
      target: degrees * DEG_TO_RAD,
    })
  }

  const connectionLabel =
    transport === 'python'
      ? 'PYTHON ONLINE'
      : transport === 'demo'
        ? 'WEB DEMO'
        : 'CONNECTING'

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">NOVA ROBOTICS</p>
          <h1>Digital Twin</h1>
        </div>

        <div
          className={
            'connection ' +
            (connected ? 'online' : transport === 'demo' ? 'demo' : 'offline')
          }
        >
          <span />
          {connectionLabel}
        </div>
      </header>

      <section className="workspace">
        <div className="viewport">
          <RobotScene state={state} screenAnimation={screenAnimation} />

          <div className="viewport-hint">
            Drag to orbit · Scroll to zoom · Use Movement library for choreographed motion
          </div>

          <div className="pose-badge">
            <div>
              <span>PAN</span>
              <strong>{format(deg(pan))}°</strong>
            </div>
            <i />
            <div>
              <span>TILT</span>
              <strong>{format(deg(tilt))}°</strong>
            </div>
          </div>

          {movementPlayer.playing && (
            <div className="movement-live-badge">
              <span>PLAYING</span>
              <strong>{selectedMovement.label}</strong>
            </div>
          )}
        </div>

        <aside className="panel">
          <FaceTrackerPanel tracker={faceTracker} />

          <section className="panel-section movement-section">
            <div className="section-title">
              <span>Movement library</span>
              <small>{MOVEMENTS.length} motions</small>
            </div>

            <div className="category-tabs">
              {MOVEMENT_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  className={movementCategory === category.id ? 'active' : ''}
                  onClick={() => {
                    movementPlayer.cancel()
                    faceTracker.stop()
                    setMovementCategory(category.id)
                    const first = MOVEMENTS.find(
                      (movement) => movement.category === category.id,
                    )
                    if (first) setSelectedMovementId(first.id)
                  }}
                >
                  {category.label}
                </button>
              ))}
            </div>

            <div className="movement-grid">
              {categoryMovements.map((movement) => (
                <button
                  key={movement.id}
                  className={
                    'movement-card ' +
                    (selectedMovementId === movement.id ? 'active' : '')
                  }
                  onClick={() => {
                    movementPlayer.cancel()
                    faceTracker.stop()
                    setSelectedMovementId(movement.id)
                  }}
                >
                  <strong>{movement.label}</strong>
                  <span>{movement.description}</span>
                </button>
              ))}
            </div>

            <div className="movement-player">
              <div className="movement-selected">
                <div>
                  <small>SELECTED</small>
                  <strong>{selectedMovement.label}</strong>
                </div>
                <span>{(selectedMovement.duration / 1000).toFixed(1)}s</span>
              </div>

              <div className="play-mode-row">
                <span>Playback</span>
                <div className="segmented-control">
                  <button
                    className={playMode === 'once' ? 'active' : ''}
                    onClick={() => setPlayMode('once')}
                  >
                    Once
                  </button>
                  <button
                    className={playMode === 'loop' ? 'active' : ''}
                    onClick={() => setPlayMode('loop')}
                  >
                    Loop
                  </button>
                </div>
              </div>

              <div className="movement-actions">
                <button
                  className="play-button"
                  onClick={() => {
                    faceTracker.stop()
                    movementPlayer.play(selectedMovement, playMode)
                  }}
                >
                  {movementPlayer.playing ? 'Restart movement' : 'Play movement'}
                </button>
                <button
                  className="stop-button"
                  disabled={!movementPlayer.playing}
                  onClick={movementPlayer.stop}
                >
                  Stop
                </button>
              </div>

              <div className="movement-progress" aria-hidden="true">
                <span
                  style={{
                    width: `${Math.round(movementPlayer.progress * 100)}%`,
                  }}
                />
              </div>
              <p className="playback-note">Once is selected by default.</p>
            </div>
          </section>

          <section className="panel-section">
            <div className="section-title">
              <span>Screen animation</span>
              <small>{screenAnimation}</small>
            </div>

            <div className="animation-grid">
              {SCREEN_ANIMATIONS.map((animation) => (
                <button
                  key={animation.id}
                  className={
                    'animation-button ' +
                    (screenAnimation === animation.id ? 'active' : '')
                  }
                  onClick={() => setScreenAnimation(animation.id)}
                >
                  {animation.label}
                </button>
              ))}
            </div>
          </section>

          <section className="panel-section">
            <div className="section-title">
              <span>Head control</span>
              <small>{transport === 'python' ? 'Python targets' : 'demo targets'}</small>
            </div>

            <JointSlider
              name="head_pan"
              label="Pan"
              actual={pan}
              target={panTarget}
              minDegrees={-90}
              maxDegrees={90}
              send={send}
              beforeChange={stopAutomaticControl}
            />

            <JointSlider
              name="head_tilt"
              label="Tilt"
              actual={tilt}
              target={tiltTarget}
              minDegrees={0}
              maxDegrees={45}
              send={send}
              beforeChange={stopAutomaticControl}
            />
          </section>

          <section className="panel-section">
            <div className="section-title">
              <span>Position presets</span>
              <small>degrees</small>
            </div>

            <div className="preset-grid">
              <button onClick={() => setJointDegrees('head_pan', -90)}>
                Left −90°
              </button>
              <button
                onClick={() => {
                  stopAutomaticControl()
                  send({ type: 'home' })
                }}
              >
                Center
              </button>
              <button onClick={() => setJointDegrees('head_pan', 90)}>
                Right +90°
              </button>
              <button onClick={() => setJointDegrees('head_tilt', 45)}>
                Tilt 45°
              </button>
            </div>
          </section>

          <section className="panel-section">
            <div className="section-title">
              <span>Head telemetry</span>
              <small>#{state.seq}</small>
            </div>

            <TelemetryRow label="Pan" value={format(deg(pan))} unit="°" />
            <TelemetryRow label="Tilt" value={format(deg(tilt))} unit="°" />
            <TelemetryRow
              label="Pan rate"
              value={format(deg(panVelocity))}
              unit="°/s"
            />
            <TelemetryRow
              label="Tilt rate"
              value={format(deg(tiltVelocity))}
              unit="°/s"
            />
          </section>

          <section className="panel-section controls">
            <button
              className="secondary-button"
              onClick={() => {
                stopAutomaticControl()
                send({ type: 'home' })
              }}
            >
              Return to home
            </button>
            <button
              className="estop-button"
              onClick={() => {
                stopAutomaticControl()
                send({ type: 'estop' })
              }}
            >
              STOP MOTION
            </button>
          </section>

          <p className="engineering-note">
            Choreographies stay inside Nova's configured pan and tilt limits.
            When Python is connected, the same movement player streams joint
            targets over the existing WebSocket interface.
          </p>

          {lastError && <p className="error-message">{lastError}</p>}
        </aside>
      </section>
    </main>
  )
}
