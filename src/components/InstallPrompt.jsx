import { useState, useEffect } from 'react'

// Chrome/Edge/Android fire a `beforeinstallprompt` event when the PWA
// criteria are met (manifest + service worker + served over https).
// By default the browser does nothing visible with this event unless the
// user finds the install option buried in the 3-dot menu. Capturing the
// event lets us show our own clear "Install Echoes" button instead.
//
// iOS Safari does not support this event at all — there is no
// programmatic install prompt on iOS, only the manual Share → Add to
// Home Screen flow. We detect iOS separately and show instructions
// instead of a button, since there's no other way to trigger it there.

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('echoes_install_dismissed') === 'true')
  const [showIosInstructions, setShowIosInstructions] = useState(false)

  useEffect(() => {
    if (isInStandaloneMode()) return // already installed, nothing to show

    function handler(e) {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (isInStandaloneMode() || dismissed) return null

  const onIos = isIos()
  if (!deferredPrompt && !onIos) return null // nothing to offer yet

  function dismiss() {
    setDismissed(true)
    sessionStorage.setItem('echoes_install_dismissed', 'true')
  }

  async function handleInstall() {
    if (onIos) {
      setShowIosInstructions(true)
      return
    }
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    dismiss()
  }

  return (
    <div
      role="region"
      aria-label="Install Echoes app"
      style={{
        marginBottom: 20, padding: '14px 16px',
        background: 'var(--blue-soft)', border: '1px solid var(--blue)',
        borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <img src="/icon-192.png" alt="" aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 9, flexShrink: 0 }} />

      {!showIosInstructions ? (
        <>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Install Echoes</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>Add it to your home screen for quick access</div>
          </div>
          <button
            onClick={handleInstall}
            aria-label="Install Echoes to your home screen"
            style={{ padding: '8px 16px', background: 'var(--blue)', color: '#fff', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 700, flexShrink: 0 }}
          >
            Install
          </button>
          <button onClick={dismiss} aria-label="Dismiss install prompt" style={{ color: 'var(--text-3)', fontSize: 18, flexShrink: 0 }}>✕</button>
        </>
      ) : (
        <div style={{ flex: 1, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>To install:</strong> tap the Share button in Safari, then "Add to Home Screen."
          <button onClick={dismiss} aria-label="Dismiss instructions" style={{ display: 'block', marginTop: 6, color: 'var(--blue-bright)', fontWeight: 600 }}>
            Got it
          </button>
        </div>
      )}
    </div>
  )
}
