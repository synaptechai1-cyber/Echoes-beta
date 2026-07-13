import { useNavigate, useLocation } from 'react-router-dom'
import { useEchoUser } from '../utils/EchoUserSync.jsx'

const TABS = [
  { path: '/',        label: 'Feed',    icon: '⊞', aria: 'Feed — discover audio posts' },
  { path: '/saved',   label: 'Saved',   icon: '★', aria: 'Your saved posts' },
  { path: '/create',  label: 'Post',    icon: '＋', aria: 'Create a new post', highlight: true },
  { path: '/vision',  label: 'Vision',  icon: '👁', aria: 'Echoes Vision — AI scene description' },
  { path: '/profile/me', label: 'Me',   icon: '◎', aria: 'Your profile' },
]

export default function NavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { echoUser } = useEchoUser() || {}

  function goTo(path) {
    if (path === '/profile/me') navigate(`/profile/${echoUser?.username}`)
    else navigate(path)
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
            onClick={() => goTo(tab.path)}
            aria-label={tab.aria}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 3,
              color: active ? 'var(--blue-bright)' : 'var(--text-3)',
              fontSize: tab.highlight ? 24 : 18,
              background: tab.highlight ? 'var(--blue-soft)' : 'transparent',
              borderTop: tab.highlight ? '1px solid var(--blue)' : 'none',
            }}
          >
            <span aria-hidden="true">{tab.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 500, letterSpacing: '0.04em' }}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
