import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useEchoUser } from '../utils/EchoUserSync.jsx'
import { api } from '../utils/api.js'

const VISION_URL = 'https://vision.echoeslife.com?from=echoes'

export default function NavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { echoUser } = useEchoUser() || {}
  const [unread, setUnread] = useState({ notifications: 0, messages: 0 })

  // Poll unread counts every 30 seconds
  useEffect(() => {
    async function fetchCounts() {
      try {
        const data = await api.getUnreadCount()
        setUnread(data)
      } catch {}
    }
    fetchCounts()
    const interval = setInterval(fetchCounts, 30000)
    return () => clearInterval(interval)
  }, [])

  const TABS = [
    { path: '/',              label: 'Feed',    icon: '⊞',  aria: 'Feed — discover audio posts' },
    { path: '/notifications', label: 'Alerts',  icon: '🔔',  aria: `Notifications${unread.notifications > 0 ? ` — ${unread.notifications} unread` : ''}`, badge: unread.notifications },
    { path: '/create',        label: 'Post',    icon: '＋',  aria: 'Create a new post', highlight: true },
    { path: '/messages',      label: 'Messages',icon: '✉️',  aria: `Messages${unread.messages > 0 ? ` — ${unread.messages} unread` : ''}`, badge: unread.messages },
    { path: '/profile/me',    label: 'Me',      icon: '◎',  aria: 'Your profile' },
  ]

  function goTo(tab) {
    if (tab.external) { window.open(VISION_URL, '_blank', 'noopener'); return }
    if (tab.path === '/profile/me') navigate(`/profile/${echoUser?.username}`)
    else navigate(tab.path)
  }

  function isActive(path) {
    if (path === '/profile/me') return location.pathname.startsWith('/profile')
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 'var(--nav-height)', background: 'var(--bg2)',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'stretch', zIndex: 200,
      }}
    >
      {TABS.map(tab => {
        const active = isActive(tab.path)
        return (
          <button
            key={tab.path}
            onClick={() => goTo(tab)}
            aria-label={tab.aria}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 3,
              color: active ? 'var(--blue-bright)' : 'var(--text-3)',
              fontSize: tab.highlight ? 24 : 18,
              background: tab.highlight ? 'var(--blue-soft)' : 'transparent',
              borderTop: tab.highlight ? '1px solid var(--blue)' : 'none',
              position: 'relative',
            }}
          >
            <span aria-hidden="true" style={{ position: 'relative' }}>
              {tab.icon}
              {tab.badge > 0 && (
                <span aria-hidden="true" style={{
                  position: 'absolute', top: -4, right: -8,
                  minWidth: 16, height: 16, borderRadius: 8,
                  background: 'var(--coral)', color: '#fff',
                  fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px',
                }}>
                  {tab.badge > 9 ? '9+' : tab.badge}
                </span>
              )}
            </span>
            <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.04em' }}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
