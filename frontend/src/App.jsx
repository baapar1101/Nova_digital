import RobotScene from './components/RobotScene.jsx'
import { useRobotSocket } from './hooks/useRobotSocket.js'

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
  const { connected, state, lastError, send } = useRobotSocket()

  const pan = state.joints.head_pan ?? 0
  const tilt = state.joints.head_tilt ?? 0
  const panTarget = state.joint_targets.head_pan ?? pan
  const tiltTarget = state.joint_targets.head_tilt ?? tilt
  const panVelocity = state.joint_velocity.head_pan ?? 0
  const tiltVelocity = state.joint_velocity.head_tilt ?? 0

  const setJointDegrees = (joint, degrees) => {
    send({
      type: 'joint_target',
      joint,
      target: degrees * DEG_TO_RAD,
    })
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">NOVA ROBOTICS</p>
          <h1>Digital Twin</h1>
        </div>

        <div className={'connection ' + (connected ? 'online' : 'offline')}>
          <span />
          {connected ? 'PYTHON ONLINE' : 'DISCONNECTED'}
        </div>
      </header>

      <section className="workspace">
        <div className="viewport">
          <RobotScene state={state} />

          <div className="viewport-hint">
            Drag to orbit · Scroll to zoom · Head motion is driven by Python
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
        </div>

        <aside className="panel">
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
            <TelemetryRow
              label="Battery model"
              value={format(state.battery, 1)}
              unit="%"
            />
          </section>

          <section className="panel-section">
            <div className="section-title">
              <span>Head control</span>
              <small>servo targets</small>
            </div>

            <JointSlider
              name="head_pan"
              label="Pan"
              actual={pan}
              target={panTarget}
              minDegrees={-90}
              maxDegrees={90}
              send={send}
            />

            <JointSlider
              name="head_tilt"
              label="Tilt"
              actual={tilt}
              target={tiltTarget}
              minDegrees={0}
              maxDegrees={45}
              send={send}
            />
          </section>

          <section className="panel-section">
            <div className="section-title">
              <span>Presets</span>
              <small>degrees</small>
            </div>

            <div className="preset-grid">
              <button onClick={() => setJointDegrees('head_pan', -90)}>
                Left −90°
              </button>
              <button onClick={() => send({ type: 'home' })}>Center</button>
              <button onClick={() => setJointDegrees('head_pan', 90)}>
                Right +90°
              </button>
              <button onClick={() => setJointDegrees('head_tilt', 45)}>
                Tilt 45°
              </button>
            </div>
          </section>

          <section className="panel-section controls">
            <button
              className="secondary-button"
              onClick={() => send({ type: 'home' })}
            >
              Return to home
            </button>
            <button
              className="estop-button"
              onClick={() => send({ type: 'estop' })}
            >
              STOP MOTION
            </button>
          </section>

          <p className="engineering-note">
            Mechanical range: pan 180° total (−90° to +90°), tilt 0° to 45°.
            The current 3D neck pivot is an initial CAD-based estimate and can
            be calibrated to the exact bearing center later.
          </p>

          {lastError && <p className="error-message">{lastError}</p>}
        </aside>
      </section>
    </main>
  )
}
