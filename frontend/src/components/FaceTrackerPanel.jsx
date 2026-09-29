function statusLabel(status) {
  switch (status) {
    case 'starting':
      return 'Loading detector'
    case 'searching':
      return 'Searching for face'
    case 'tracking':
      return 'Following face'
    case 'locked':
      return 'Face centered'
    case 'error':
      return 'Tracker error'
    default:
      return 'Camera off'
  }
}

export default function FaceTrackerPanel({ tracker }) {
  const {
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
  } = tracker

  const mirroredLeft = face ? 1 - face.x - face.width : 0

  return (
    <section className="panel-section face-tracker-section">
      <div className="section-title">
        <span>Face tracker</span>
        <small>{statusLabel(status)}</small>
      </div>

      <div className={'camera-preview ' + (tracking ? 'active' : '')}>
        <video ref={videoRef} autoPlay muted playsInline />

        <div className="camera-crosshair" aria-hidden="true">
          <i />
          <b />
        </div>

        {face && (
          <div
            className="face-box"
            style={{
              left: mirroredLeft * 100 + '%',
              top: face.y * 100 + '%',
              width: face.width * 100 + '%',
              height: face.height * 100 + '%',
            }}
          >
            <span>{Math.round(face.confidence * 100)}%</span>
          </div>
        )}

        {!tracking && (
          <div className="camera-placeholder">
            <strong>Camera preview</strong>
            <span>Face detection runs locally in your browser.</span>
          </div>
        )}
      </div>

      <div className="tracker-actions">
        {!tracking ? (
          <button
            className="tracker-start-button"
            onClick={start}
            disabled={status === 'starting'}
          >
            {status === 'starting' ? 'Starting…' : 'Turn camera on & follow'}
          </button>
        ) : (
          <button className="tracker-stop-button" onClick={stop}>
            Stop face tracking
          </button>
        )}
      </div>

      <label className="tracker-slider">
        <div>
          <span>Tracking strength</span>
          <strong>{sensitivity.toFixed(1)}×</strong>
        </div>
        <input
          type="range"
          min="0.5"
          max="1.8"
          step="0.1"
          value={sensitivity}
          onChange={(event) => setSensitivity(Number(event.target.value))}
        />
      </label>

      <div className="tracker-options">
        <label>
          <input
            type="checkbox"
            checked={invertPan}
            onChange={(event) => setInvertPan(event.target.checked)}
          />
          <span>Reverse pan</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={invertTilt}
            onChange={(event) => setInvertTilt(event.target.checked)}
          />
          <span>Reverse tilt</span>
        </label>
      </div>

      <p className="tracker-note">
        Keep your face near the center marker. If an axis moves the wrong way,
        enable its reverse option.
      </p>

      {error && <p className="error-message">{error}</p>}
    </section>
  )
}
