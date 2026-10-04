function statusLabel(status) {
  switch (status) {
    case 'connecting':
      return 'CONNECTING'
    case 'listening':
      return 'LISTENING'
    case 'speaking':
      return 'SPEAKING'
    case 'closing':
      return 'ENDING'
    case 'error':
      return 'ERROR'
    default:
      return 'OFF'
  }
}

export default function GptLivePanel({ live }) {
  const active = live.connected || ['connecting', 'closing'].includes(live.status)

  return (
    <section className="panel-section gpt-live-section">
      <div className="section-title">
        <span>GPT Live</span>
        <small>gpt-live-1</small>
      </div>

      <div className={'gpt-live-card ' + (live.connected ? 'active' : '')}>
        <div className="gpt-live-orb" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>

        <div className="gpt-live-state">
          <small>NOVA VOICE</small>
          <strong>{statusLabel(live.status)}</strong>
          <span>
            {live.connected
              ? live.muted
                ? 'Microphone muted'
                : 'Full-duplex voice is active'
              : 'Natural voice conversation with Nova'}
          </span>
        </div>

        <span className={'gpt-live-dot ' + live.status} aria-hidden="true" />
      </div>

      <audio ref={live.audioRef} autoPlay playsInline className="gpt-live-audio" />

      {(live.userTranscript || live.assistantTranscript) && (
        <div className="gpt-live-transcript">
          {live.userTranscript && (
            <div>
              <small>YOU</small>
              <p>{live.userTranscript}</p>
            </div>
          )}

          {live.assistantTranscript && (
            <div className="nova">
              <small>NOVA</small>
              <p>{live.assistantTranscript}</p>
            </div>
          )}
        </div>
      )}

      <div className="gpt-live-actions">
        {!active ? (
          <button className="gpt-live-start" type="button" onClick={live.start}>
            Start voice
          </button>
        ) : (
          <>
            <button
              className={'gpt-live-mute ' + (live.muted ? 'active' : '')}
              type="button"
              onClick={live.toggleMute}
              disabled={!live.connected}
            >
              {live.muted ? 'Unmute' : 'Mute'}
            </button>
            <button
              className="gpt-live-end"
              type="button"
              onClick={live.stop}
              disabled={live.status === 'closing'}
            >
              End
            </button>
          </>
        )}
      </div>

      <div className="gpt-live-meta">
        <span>Interruptible</span>
        <span>
          {live.usageSeconds > 0
            ? Math.round(live.usageSeconds) + 's session'
            : live.sessionId
              ? live.sessionId
              : 'WebRTC'}
        </span>
      </div>

      {live.error && <p className="gpt-live-error">{live.error}</p>}
    </section>
  )
}
