import { useEffect, useMemo, useState } from 'react'

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

export default function InstallPwa() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installed, setInstalled] = useState(() => isStandalone())
  const [showIosHelp, setShowIosHelp] = useState(false)

  const isIos = useMemo(
    () => /iphone|ipad|ipod/i.test(window.navigator.userAgent),
    [],
  )

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }

    const onInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
      setShowIosHelp(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) {
    return <span className="pwa-installed-badge">APP</span>
  }

  if (!installPrompt && !isIos) {
    return null
  }

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt()
      const result = await installPrompt.userChoice

      if (result.outcome === 'accepted') {
        setInstallPrompt(null)
      }
      return
    }

    setShowIosHelp((current) => !current)
  }

  return (
    <div className="pwa-install-wrap">
      <button className="pwa-install-button" type="button" onClick={install}>
        Install
      </button>

      {showIosHelp && (
        <div className="pwa-ios-help" role="status">
          <strong>Install Nova</strong>
          <span>
            In Safari, tap Share, then choose <b>Add to Home Screen</b>.
          </span>
          <button type="button" onClick={() => setShowIosHelp(false)}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}
