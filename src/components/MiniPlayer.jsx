import { usePlayer } from '../utils/PlayerContext.jsx'

export default function MiniPlayer() {
  const { currentPost, playing, progress, duration, pause, resume, stop, seek } = usePlayer()

  if (!currentPost) return null

  const pct = duration > 0 ? (progress / duration) * 100 : 0

  function togglePlay() {
    if (playing) pause()
    else resume()
  }

  return (
    <div
      role="region"
      aria-label="Now playing"
      style={{
        position: 'fixed',
        bottom: 'var(--nav-height)',
        left: 0, right: 0,
        height: 'var(--player-height)',
        background: 'var(--bg3)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 16,
        zIndex: 100,
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--bg4)' }} aria-hidden="true">
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--blue-bright)', transition: 'width 0.5s linear' }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-display)', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          aria-live="polite"
          aria-label={`Now playing: ${currentPost.title} by ${currentPost.display_name || currentPost.username}`}
        >
          {currentPost.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{currentPost.display_name || currentPost.username}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => seek(Math.max(0, progress - 10))} aria-label="Rewind 10 seconds" style={{ color: 'var(--text-2)', fontSize: 20 }}>↺</button>
        <button
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--blue)', color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <button onClick={() => seek(Math.min(duration, progress + 10))} aria-label="Skip forward 10 seconds" style={{ color: 'var(--text-2)', fontSize: 20 }}>↻</button>
        <button onClick={stop} aria-label="Stop and close player" style={{ color: 'var(--text-3)', fontSize: 18 }}>✕</button>
      </div>
    </div>
  )
}
