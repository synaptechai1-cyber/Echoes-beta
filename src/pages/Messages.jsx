import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api.js'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr + 'Z').getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export default function Messages() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [newUsername, setNewUsername] = useState('')
  const [starting, setStarting] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    api.getConversations()
      .then(d => setConversations(d.conversations))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function startConversation(e) {
    e.preventDefault()
    if (!newUsername.trim()) return
    setStarting(true)
    setError('')
    try {
      const data = await api.startConversation(newUsername.trim())
      navigate(`/messages/${data.conversation_id}`)
    } catch (err) {
      setError(err.message)
      setStarting(false)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px' }}>
      <header style={{ padding: '24px 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>Messages</h1>
        <button
          onClick={() => setShowNew(s => !s)}
          aria-label="Start a new conversation"
          aria-expanded={showNew}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--blue)', color: '#fff', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          +
        </button>
      </header>

      {/* New conversation form */}
      {showNew && (
        <form onSubmit={startConversation} style={{ marginBottom: 20, padding: '16px', background: 'var(--surface)', border: '1px solid var(--blue)', borderRadius: 'var(--radius)' }}>
          <label htmlFor="new_dm_username" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
            Start a conversation — enter username
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              id="new_dm_username"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              placeholder="username"
              autoFocus
              autoCapitalize="none"
              style={{ flex: 1, padding: '12px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 15 }}
            />
            <button type="submit" disabled={starting || !newUsername.trim()}
              style={{ padding: '12px 20px', background: 'var(--blue)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 700, opacity: (starting || !newUsername.trim()) ? 0.6 : 1 }}>
              {starting ? '…' : 'Go'}
            </button>
          </div>
          {error && <div role="alert" style={{ color: 'var(--coral)', fontSize: 13, marginTop: 8 }}>{error}</div>}
        </form>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div className="spinner" role="status" aria-label="Loading messages">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
      )}

      {!loading && conversations.length === 0 && !showNew && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-2)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">✉️</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 8, color: 'var(--text)' }}>
            No messages yet
          </h2>
          <p style={{ fontSize: 15, marginBottom: 20 }}>Tap the + button to start a conversation.</p>
        </div>
      )}

      <div role="list" aria-label="Your conversations">
        {conversations.map(conv => (
          <button
            key={conv.id}
            onClick={() => navigate(`/messages/${conv.id}`)}
            role="listitem"
            aria-label={`Conversation with ${conv.other_user.display_name || conv.other_user.username}. ${conv.last_message ? 'Last message: ' + conv.last_message : 'No messages yet'}. ${conv.unread > 0 ? conv.unread + ' unread' : ''}`}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 0', borderBottom: '1px solid var(--border)', textAlign: 'left',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              background: 'var(--blue-soft)', border: '2px solid var(--blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--blue-bright)',
            }} aria-hidden="true">
              {(conv.other_user.display_name || conv.other_user.username)?.[0]?.toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                  {conv.other_user.display_name || conv.other_user.username}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {timeAgo(conv.last_message_at)}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {conv.last_message || 'No messages yet'}
              </div>
            </div>

            {conv.unread > 0 && (
              <div style={{
                minWidth: 20, height: 20, borderRadius: 'var(--radius-full)',
                background: 'var(--blue)', color: '#fff',
                fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 5px', flexShrink: 0,
              }} aria-hidden="true">
                {conv.unread}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
