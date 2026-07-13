import { useState } from 'react'
import { api } from '../utils/api.js'

const STAR_OPTIONS = [1, 5, 10, 50]

export default function GiftButton({ post }) {
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleGift(amount) {
    setSending(true)
    setError('')
    try {
      await api.sendGift(post.username, post.id, amount, message)
      setSent(true)
      setOpen(false)
      setMessage('')
      setTimeout(() => setSent(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={sent ? 'Stars sent!' : `Send stars to ${post.display_name || post.username}`}
        aria-expanded={open}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          color: sent ? 'var(--amber)' : 'var(--text-2)',
          fontSize: 11,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 20 }}>{sent ? '⭐' : '☆'}</span>
        <span>{sent ? 'Sent!' : 'Stars'}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`Send stars to ${post.display_name || post.username}`}
          style={{
            position: 'absolute', bottom: '110%', right: 0,
            background: 'var(--surface)', border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius)', padding: 16, minWidth: 220,
            zIndex: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text)' }}>
            ⭐ Send stars to {post.display_name || post.username}
          </div>

          <input
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Add a message (optional)"
            maxLength={80}
            style={{
              width: '100%', padding: '8px 10px', marginBottom: 10,
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 13,
            }}
            aria-label="Optional message with your stars"
          />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {STAR_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => handleGift(n)}
                disabled={sending}
                aria-label={`Send ${n} star${n !== 1 ? 's' : ''}`}
                style={{
                  flex: 1, minWidth: 44, padding: '10px 4px',
                  background: 'var(--blue-soft)', border: '1px solid var(--blue)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--blue-bright)',
                  fontWeight: 700, fontSize: 13, opacity: sending ? 0.6 : 1,
                }}
              >
                ⭐ {n}
              </button>
            ))}
          </div>

          {error && (
            <div role="alert" style={{ fontSize: 12, color: 'var(--coral)', marginBottom: 8 }}>
              {error}
            </div>
          )}

          <button
            onClick={() => setOpen(false)}
            style={{ fontSize: 12, color: 'var(--text-3)', width: '100%', textAlign: 'center' }}
            aria-label="Close gift panel"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
