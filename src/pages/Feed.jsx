import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api.js'
import { usePlayer } from '../utils/PlayerContext.jsx'
import { useSwipeGesture } from '../utils/useSwipeGesture.js'
import ShareButton from '../components/ShareButton.jsx'

const TYPE_LABELS = {
  audio: 'Audio story',
  written: 'Written story',
  voice_note: 'Voice note',
  live: 'Live room',
}

function formatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return (n || 0).toString()
}

export default function Feed() {
  const [posts, setPosts] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [liked, setLiked] = useState({})
  const [saved, setSaved] = useState({})
  const [announcement, setAnnouncement] = useState('')

  const { play, playing, setFeedQueue, next: queueNext, previous: queuePrevious, queueIndex } = usePlayer()
  const navigate = useNavigate()
  const containerRef = useRef(null)

  const loadFeed = useCallback(async () => {
    try {
      const data = await api.feed()
      setPosts(data.posts)
      setCursor(data.nextCursor)
      if (data.posts.length > 0) setFeedQueue(data.posts, 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [setFeedQueue])

  useEffect(() => { loadFeed() }, [loadFeed])

  // Keep local activeIndex in sync with the player's queue position,
  // since swipe gestures move the queue directly.
  useEffect(() => { setActiveIndex(queueIndex) }, [queueIndex])

  // Load more posts as the listener approaches the end of what's loaded.
  useEffect(() => {
    if (cursor && activeIndex >= posts.length - 3) {
      api.feed(cursor).then(data => {
        setPosts(prev => [...prev, ...data.posts])
        setCursor(data.nextCursor)
      }).catch(() => {})
    }
  }, [activeIndex, cursor, posts.length])

  const current = posts[activeIndex]

  async function handleLike() {
    if (!current) return
    try {
      const res = await api.likePost(current.id)
      setLiked(prev => ({ ...prev, [current.id]: res.liked }))
      setAnnouncement(res.liked ? 'Liked' : 'Like removed')
    } catch {}
  }

  async function handleSave() {
    if (!current) return
    try {
      const res = await api.savePost(current.id)
      setSaved(prev => ({ ...prev, [current.id]: res.saved }))
      setAnnouncement(res.saved ? 'Saved to your library' : 'Removed from saved')
    } catch {}
  }

  function handleNext() {
    if (activeIndex < posts.length - 1) {
      queueNext()
      setAnnouncement(`Next post: ${posts[activeIndex + 1]?.title}`)
    }
  }

  function handlePrevious() {
    if (activeIndex > 0) {
      queuePrevious()
      setAnnouncement(`Previous post: ${posts[activeIndex - 1]?.title}`)
    }
  }

  // Swipe up = next, swipe down = previous, double-tap = like, hold = save.
  // Scoped entirely to this container — see useSwipeGesture.js for why.
  const swipeHandlers = useSwipeGesture({
    onNext: handleNext,
    onPrevious: handlePrevious,
    onLike: handleLike,
    onSave: handleSave,
  })

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <div className="spinner" role="status" aria-label="Loading your feed">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" style={{ padding: 32, textAlign: 'center', color: 'var(--coral)' }}>
        {error} — <button onClick={loadFeed} style={{ color: 'var(--blue-bright)', fontWeight: 600 }}>Try again</button>
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-2)' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 8, color: 'var(--text)' }}>No posts yet</h1>
        <p style={{ fontSize: 15 }}>Be the first to post something. Open the create tab to get started.</p>
      </div>
    )
  }

  const isLiked = current ? !!liked[current.id] : false
  const isSaved = current ? !!saved[current.id] : false
  const tags = Array.isArray(current?.tags) ? current.tags : []

  return (
    <div
      ref={containerRef}
      {...swipeHandlers}
      style={{
        minHeight: 'calc(100dvh - var(--nav-height) - var(--player-height))',
        display: 'flex', flexDirection: 'column',
        padding: '20px 20px 24px',
        touchAction: 'pan-y',
      }}
      aria-roledescription="Audio feed. Swipe up for next, swipe down for previous, double-tap to like, hold to save. All actions are also available as buttons below."
    >
      {/* Live region announces state changes for screen reader users,
          since swipe actions happen outside normal focus-based navigation */}
      <div aria-live="polite" className="sr-only">{announcement}</div>

      <header style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="/logo.png" alt="" aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 8 }} />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>Echoes</h1>
        <span style={{ fontSize: 13, color: 'var(--text-3)', marginLeft: 'auto' }}>
          {activeIndex + 1} of {posts.length}
        </span>
      </header>

      {current && (
        <article
          aria-label={`${current.title} by ${current.display_name || current.username}. ${TYPE_LABELS[current.type]}.`}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: 28,
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
              color: 'var(--blue-bright)', textTransform: 'uppercase',
            }}>
              {TYPE_LABELS[current.type]}
            </span>
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, marginBottom: 10, lineHeight: 1.25 }}>
            {current.title}
          </h2>

          <button
            onClick={() => navigate(`/profile/${current.username}`)}
            style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 500, marginBottom: 16, textAlign: 'left' }}
          >
            by {current.display_name || current.username}
          </button>

          {current.body && (
            <p style={{ fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 20, flex: 1 }}>
              {current.body.slice(0, 280)}{current.body.length > 280 ? '…' : ''}
            </p>
          )}

          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
              {tags.map(tag => (
                <span key={tag} style={{
                  fontSize: 11, padding: '3px 10px', background: 'var(--blue-soft)',
                  color: 'var(--blue-bright)', borderRadius: 'var(--radius-full)', fontWeight: 500,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Primary play control — large, central, the anchor of the view */}
          <button
            onClick={() => play(current)}
            aria-label={playing ? `Pause ${current.title}` : `Play ${current.title}`}
            style={{
              width: 64, height: 64, borderRadius: '50%', alignSelf: 'center',
              background: playing ? 'var(--blue)' : 'var(--bg4)', color: '#fff',
              fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20, border: '1px solid var(--border-strong)',
            }}
          >
            {playing ? '⏸' : '▶'}
          </button>

          {/* Standard, fully focusable controls — every swipe action has
              an identical button equivalent, never swipe-only */}
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button onClick={handlePrevious} disabled={activeIndex === 0}
              aria-label="Previous post" style={{ color: 'var(--text-2)', fontSize: 20, opacity: activeIndex === 0 ? 0.3 : 1 }}>
              ↑
            </button>
            <button onClick={handleLike} aria-pressed={isLiked}
              aria-label={isLiked ? 'Unlike this post' : 'Like this post'}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: isLiked ? 'var(--coral)' : 'var(--text-2)' }}>
              <span aria-hidden="true" style={{ fontSize: 20 }}>{isLiked ? '♥' : '♡'}</span>
              <span style={{ fontSize: 11 }}>{formatCount(current.like_count)}</span>
            </button>
            <button onClick={handleSave} aria-pressed={isSaved}
              aria-label={isSaved ? 'Remove from saved' : 'Save this post'}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: isSaved ? 'var(--amber)' : 'var(--text-2)' }}>
              <span aria-hidden="true" style={{ fontSize: 20 }}>{isSaved ? '★' : '☆'}</span>
              <span style={{ fontSize: 11 }}>{formatCount(current.save_count)}</span>
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <ShareButton post={current} layout="column" />
            </div>
            <button onClick={handleNext} disabled={activeIndex >= posts.length - 1}
              aria-label="Next post" style={{ color: 'var(--text-2)', fontSize: 20, opacity: activeIndex >= posts.length - 1 ? 0.3 : 1 }}>
              ↓
            </button>
          </div>
        </article>
      )}
    </div>
  )
}
