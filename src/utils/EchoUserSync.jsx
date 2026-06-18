import { createContext, useContext, useState, useEffect } from 'react'
import { useUser, useAuth as useClerkAuth } from '@clerk/clerk-react'
import { api } from './api.js'

// Provides the Echo-specific user record (username, follower_count, etc)
// once Clerk confirms the person is signed in. Creates the record on
// first sign-in if it doesn't exist yet.
const EchoUserContext = createContext(null)

export function EchoUserSync({ children }) {
  const { user: clerkUser } = useUser()
  const { getToken } = useClerkAuth()
  const [echoUser, setEchoUser] = useState(null)
  const [needsUsername, setNeedsUsername] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function sync() {
      try {
        const token = await getToken()
        api.setToken(token)
        const data = await api.me()
        setEchoUser(data.user)
      } catch (err) {
        // No Echo profile yet for this Clerk identity — needs to pick a username
        setNeedsUsername(true)
      } finally {
        setLoading(false)
      }
    }
    if (clerkUser) sync()
  }, [clerkUser])

  async function completeProfile(username) {
    const token = await getToken()
    api.setToken(token)
    const data = await api.register(username, clerkUser.fullName || clerkUser.username || username)
    setEchoUser(data.user)
    setNeedsUsername(false)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
        <div className="spinner" role="status" aria-label="Setting up your account">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
    )
  }

  if (needsUsername) {
    return <ChooseUsername onSubmit={completeProfile} />
  }

  return (
    <EchoUserContext.Provider value={{ echoUser, setEchoUser }}>
      {children}
    </EchoUserContext.Provider>
  )
}

export function useEchoUser() {
  return useContext(EchoUserContext)
}

function ChooseUsername({ onSubmit }) {
  const [username, setUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (username.length < 2) { setError('Username must be at least 2 characters.'); return }
    setSubmitting(true)
    setError('')
    try {
      await onSubmit(username)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)',
    }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '32px 28px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          Almost there
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 24 }}>
          Choose a username for Echoes. This is how people will find and follow you.
        </p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="new_username" className="sr-only">Choose a username</label>
          <input
            id="new_username"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="your_username"
            autoFocus
            autoCapitalize="none"
            spellCheck={false}
            style={{
              width: '100%', padding: '14px 16px', marginBottom: 16,
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 16,
            }}
          />
          {error && (
            <div role="alert" style={{ color: 'var(--coral)', fontSize: 13, marginBottom: 16 }}>{error}</div>
          )}
          <button
            type="submit"
            disabled={submitting || !username}
            style={{
              width: '100%', padding: '16px', background: 'var(--blue)', color: '#fff',
              borderRadius: 'var(--radius-sm)', fontSize: 16, fontWeight: 600,
              fontFamily: 'var(--font-display)', opacity: (submitting || !username) ? 0.6 : 1,
            }}
          >
            {submitting ? 'Setting up…' : 'Continue to Echoes'}
          </button>
        </form>
      </div>
    </div>
  )
}
