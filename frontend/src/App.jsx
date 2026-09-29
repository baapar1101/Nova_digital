import { useCallback, useEffect, useRef } from 'react'
import RobotScene from './components/RobotScene.jsx'
import { useRobotSocket } from './hooks/useRobotSocket.js'

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

function format(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
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

function JointSlider({ name, label, value, min, max, send }) {
  const degrees = value * 180 / Math.PI

  return (
    <label className="joint-control">
      <div>
        <span>{label}</span>
        <strong>{format(degrees, 1)}°</strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step="0.01"
        value={value}
        onChange={(event) => {
          send({
            type: 'joint_target',
            joint: name,
            target: Number(event.target.value),
          })
        }}
      />
    </label>
  )
}

export default function App() {
  const { connected, state, lastError, send } = useRobotSocket()
  const pressed = useRef(new Set())

  const sendDriveFromKeys = useCallback(() => {
    const keys = pressed.current

    let throttle = 0
    let steering = 0

    if (keys.has('w') || keys.has('arrowup')) throttle += 1
    if (keys.has('s') || keys.has('arrowdown')) throttle -= 1
    if (keys.has('a') || keys.has('arrowleft')) steering -= 1
    if (keys.has('d') || keys.has('arrowright')) steering += 1

    const scale = 0.78
    const left = clamp((throttle + steering) * scale, -1, 1)
    const right = clamp((throttle - steering) * scale, -1, 1)

    send({ type: 'drive', left, right })
  }, [send])

  useEffect(() => {
    const relevant = new Set([
      'w', 'a', 's', 'd',
      'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
      ' ',
    ])

    const onKeyDown = (event) => {
      const key = event.key.toLowerCase()
      if (!relevant.has(key)) return

      event.preventDefault()

      if (key === ' ') {
        pressed.current.clear()
        send({ type: 'estop' })
        return
      }

      pressed.current.add(key)
      sendDriveFromKeys()
    }

    const onKeyUp = (event) => {
      const key = event.key.toLowerCase()
      if (!relevant.has(key)) return

      event.preventDefault()
      pressed.current.delete(key)
      sendDriveFromKeys()
    }

    const onBlur = () => {
      pressed.current.clear()
      send({ type: 'drive', left: 0, right: 0 })
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [send, sendDriveFromKeys])

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">NOVA ROBOTICS</p>
          <h1>Digital Twin</h1>
        </div>

        <div className={'connection ' + (connected ? 'online' : 'offline')}>
          <span />
          {connected ? 'SIM ONLINE' : 'DISCONNECTED'}
        </div>
      </header>

      <section className="workspace">
        <div className="viewport">
          <RobotScene state={state} />

          <div className="viewport-hint">
            Drag to orbit · Scroll to zoom · W/A/S/D to drive · Space to stop
          </div>

          <div className="speed-badge">
            <span>GROUND SPEED</span>
            <strong>{format(state.velocity.linear)} m/s</strong>
          </div>
        </div>

        <aside className="panel">
          <section className="panel-section">
            <div className="section-title">
              <span>Telemetry</span>
              <small>#{state.seq}</small>
            </div>

            <TelemetryRow label="X" value={format(state.pose.x)} unit="m" />
            <TelemetryRow label="Z" value={format(state.pose.z)} unit="m" />
            <TelemetryRow
              label="Heading"
              value={format(state.pose.yaw * 180 / Math.PI, 1)}
              unit="°"
            />
            <TelemetryRow
              label="Angular"
              value={format(state.velocity.angular)}
              unit="rad/s"
            />
            <TelemetryRow
              label="Left track"
              value={format(state.tracks.left)}
              unit="m/s"
            />
            <TelemetryRow
              label="Right track"
              value={format(state.tracks.right)}
              unit="m/s"
            />
            <TelemetryRow
              label="Battery"
              value={format(state.battery, 1)}
              unit="%"
            />
          </section>

          <section className="panel-section">
            <div className="section-title">
              <span>Arm joints</span>
              <small>rad targets</small>
            </div>

            <JointSlider
              name="arm_base"
              label="Base"
              value={state.joints.arm_base}
              min={-3.14}
              max={3.14}
              send={send}
            />
            <JointSlider
              name="shoulder"
              label="Shoulder"
              value={state.joints.shoulder}
              min={-0.5}
              max={1.45}
              send={send}
            />
            <JointSlider
              name="elbow"
              label="Elbow"
              value={state.joints.elbow}
              min={-2.2}
              max={0.2}
              send={send}
            />
            <JointSlider
              name="wrist"
              label="Wrist"
              value={state.joints.wrist}
              min={-1.6}
              max={1.6}
              send={send}
            />
          </section>

          <section className="panel-section controls">
            <button
              className="secondary-button"
              onClick={() => send({ type: 'reset_pose' })}
            >
              Reset pose
            </button>
            <button
              className="estop-button"
              onClick={() => {
                pressed.current.clear()
                send({ type: 'estop' })
              }}
            >
              EMERGENCY STOP
            </button>
          </section>

          {lastError && <p className="error-message">{lastError}</p>}
        </aside>
      </section>
    </main>
  )
}
