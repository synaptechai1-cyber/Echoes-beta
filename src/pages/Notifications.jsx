import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api.js'

const TYPE_ICONS = {
  like: '♥',
  comment: '💬',
  follow: '◎',
  mention: '@',
  gift: '⭐',
  message: '✉️',
}

const TYPE_TEXT = {
  like: 'liked your post',
  comment: 'commented on your post',
  follow: 'started following you',
  mention: 'mentioned you',
  gift: 'sent you stars',
  message: 'sent you a message',
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr + 'Z').getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getNotifications()
        setNotifications(data.notifications)
        // Mark all as read when page opens
        await api.markNotificationsRead()
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [])

  function handleTap(notif) {
    if (notif.type === 'message') {
      navigate('/messages')
    } else if (notif.post_id) {
      navigate(`/post/${notif.post_id}`)
    } else if (notif.actor_username) {
      navigate(`/profile/${notif.actor_username}`)
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px' }}>
      <header style={{ padding: '24px 0 20px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>Notifications</h1>
      </header>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div className="spinner" role="status" aria-label="Loading notifications">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-2)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">🔔</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 8, color: 'var(--text)' }}>
            No notifications yet
          </h2>
          <p style={{ fontSize: 15 }}>When someone likes, comments, or follows you, it'll show here.</p>
        </div>
      )}

      <div role="feed" aria-label="Your notifications">
        {notifications.map(n => (
          <button
            key={n.id}
            onClick={() => handleTap(n)}
            aria-label={`${n.actor_display_name || n.actor_username} ${TYPE_TEXT[n.type]}${n.message_preview ? ': ' + n.message_preview : ''}. ${timeAgo(n.created_at)}`}
            style={{
              width: '100%', display: 'flex', alignItems: 'flex-start', gap: 14,
              padding: '14px 0', borderBottom: '1px solid var(--border)',
              background: n.read ? 'transparent' : 'var(--blue-soft)',
              borderRadius: n.read ? 0 : 'var(--radius-sm)',
              paddingLeft: n.read ? 0 : 12, paddingRight: n.read ? 0 : 12,
              textAlign: 'left',
            }}
          >
            {/* Icon */}
            <div style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: 'var(--surface)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }} aria-hidden="true">
              {TYPE_ICONS[n.type]}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--blue-bright)' }}>
                  {n.actor_display_name || n.actor_username}
                </strong>
                {' '}{TYPE_TEXT[n.type]}
              </div>
              {n.message_preview && (
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  "{n.message_preview}"
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                {timeAgo(n.created_at)}
              </div>
            </div>

            {!n.read && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0, marginTop: 6 }} aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
