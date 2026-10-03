import { useCallback, useState } from 'react'
import FaceTrackerPanel from './components/FaceTrackerPanel.jsx'
import RobotScene from './components/RobotScene.jsx'
import { useFaceTracker } from './hooks/useFaceTracker.js'
import { useMovementPlayer } from './hooks/useMovementPlayer.js'
import { useRobotSocket } from './hooks/useRobotSocket.js'
import {
  ANIMATION_PERFORMANCES,
  MOVEMENTS,
  getMotionById,
  getMovementById,
} from './movements.js'

const RAD_TO_DEG = 180 / Math.PI
const DEG_TO_RAD = Math.PI / 180

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
  const [screenAnimationRun, setScreenAnimationRun] = useState(0)
  const [selectedMovementId, setSelectedMovementId] = useState('normal')
  const [playMode, setPlayMode] = useState('once')
  const [showInternals, setShowInternals] = useState(true)

  const handleFaceChange = useCallback((face) => {
    setScreenAnimation(face)
    setScreenAnimationRun((run) => run + 1)
  }, [])

  const movementPlayer = useMovementPlayer({
    send,
    onFaceChange: handleFaceChange,
  })

  const faceTracker = useFaceTracker({
    send,
    state,
    onBeforeStart: movementPlayer.cancel,
  })

  const selectedMovement = getMovementById(selectedMovementId)
  const activeMotion = getMotionById(movementPlayer.activeMovementId)
  const activePerformance = ANIMATION_PERFORMANCES.find(
    (performance) => performance.id === movementPlayer.activeMovementId,
  )
  const selectedMovementPlaying =
    movementPlayer.playing && movementPlayer.activeMovementId === selectedMovement.id
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
          <RobotScene
            state={state}
            screenAnimation={screenAnimation}
            screenAnimationRun={screenAnimationRun}
            showInternals={showInternals}
          />

          <div className="viewport-hint">
            Drag to orbit · Scroll to zoom · Choose Normal, Pan, or Tilt
          </div>

          <button
            className={`internals-toggle ${showInternals ? 'active' : ''}`}
            onClick={() => setShowInternals((visible) => !visible)}
          >
            <span />
            {showInternals ? 'INTERNALS ON' : 'SHOW INTERNALS'}
          </button>

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
              <span>FACE + MOTION</span>
              <strong>{activeMotion?.label || selectedMovement.label}</strong>
            </div>
          )}
        </div>

        <aside className="panel">
          <FaceTrackerPanel tracker={faceTracker} />

          <section className="panel-section movement-section">
            <div className="section-title">
              <span>Mechanical movement</span>
              <small>Rhino matched</small>
            </div>

            <div className="mechanical-movement-grid">
              {MOVEMENTS.map((movement) => (
                <button
                  key={movement.id}
                  className={
                    'mechanical-movement-card ' +
                    (selectedMovementId === movement.id ? 'active' : '')
                  }
                  onClick={() => {
                    movementPlayer.cancel()
                    faceTracker.stop()
                    setSelectedMovementId(movement.id)
                  }}
                >
                  <span
                    className={`movement-axis-icon ${movement.axis}`}
                    aria-hidden="true"
                  >
                    {movement.symbol}
                  </span>
                  <strong>{movement.label}</strong>
                  <small>{movement.range}</small>
                </button>
              ))}
            </div>

            <p className="mechanical-movement-description">
              {selectedMovement.description}
            </p>

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
                  {selectedMovementPlaying
                    ? `Restart ${selectedMovement.label}`
                    : selectedMovement.action}
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
                    width: `${Math.round(
                      selectedMovementPlaying ? movementPlayer.progress * 100 : 0,
                    )}%`,
                  }}
                />
              </div>
              <p className="playback-note">
                Pan and tilt drive the matching internal gears in real time.
              </p>
            </div>
          </section>

          <section className="panel-section">
            <div className="section-title">
              <span>Expression performances</span>
              <small>face + motion sync</small>
            </div>

            <p className="animation-intro">
              Select an expression to play its face and head choreography together.
            </p>

            <div className="animation-grid">
              {ANIMATION_PERFORMANCES.map((animation) => (
                <button
                  key={animation.id}
                  className={
                    'animation-button ' +
                    (screenAnimation === animation.face ? 'active ' : '') +
                    (movementPlayer.playing &&
                    movementPlayer.activeMovementId === animation.id
                      ? 'performing'
                      : '')
                  }
                  onClick={() => {
                    faceTracker.stop()
                    movementPlayer.play(animation, 'once')
                  }}
                  aria-label={`Play ${animation.label}: ${animation.motion}`}
                >
                  <span className="animation-symbol" aria-hidden="true">
                    {animation.symbol}
                  </span>
                  <span>
                    <strong>{animation.label}</strong>
                    <small>{animation.motion}</small>
                  </span>
                </button>
              ))}
            </div>

            <div
              className={
                'performance-status ' +
                (activePerformance && movementPlayer.playing ? 'active' : '')
              }
            >
              <div>
                <span>
                  {activePerformance && movementPlayer.playing
                    ? `Playing ${activePerformance.label}`
                    : 'Ready for performance'}
                </span>
                <small>
                  {activePerformance && movementPlayer.playing
                    ? activePerformance.motion
                    : 'Select any expression above'}
                </small>
              </div>
              <div className="performance-progress" aria-hidden="true">
                <span
                  style={{
                    width: `${Math.round(
                      activePerformance && movementPlayer.playing
                        ? movementPlayer.progress * 100
                        : 0,
                    )}%`,
                  }}
                />
              </div>
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
