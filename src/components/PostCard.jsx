import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayer } from '../utils/PlayerContext.jsx'
import { api } from '../utils/api.js'
import ShareButton from './ShareButton.jsx'

const TYPE_LABELS = {
  audio: 'Audio story',
  written: 'Written story',
  voice_note: 'Voice note',
  live: 'Live room',
  moment: 'Moment',
  video: 'Video',
}

const TYPE_ICONS = {
  audio: '🎙️',
  written: '📖',
  voice_note: '🗣️',
  live: '🔴',
  moment: '💬',
  video: '🎬',
}

function formatDuration(seconds) {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return (n || 0).toString()
}

export default function PostCard({ post, showAuthor = true }) {
  const { play, currentPost, playing } = usePlayer()
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [likes, setLikes] = useState(post.like_count || 0)
  const navigate = useNavigate()

  const isThisPost = currentPost?.id === post.id
  const isPlaying = isThisPost && playing

  async function handleLike(e) {
    e.stopPropagation()
    try {
      const res = await api.likePost(post.id)
      setLiked(res.liked)
      setLikes(l => res.liked ? l + 1 : l - 1)
    } catch {}
  }

  async function handleSave(e) {
    e.stopPropagation()
    try {
      const res = await api.savePost(post.id)
      setSaved(res.saved)
    } catch {}
  }

  function handlePlay(e) {
    e.stopPropagation()
    play(post)
  }

  const tags = Array.isArray(post.tags) ? post.tags : []

  return (
    <article
      style={{
        background: 'var(--surface)',
        border: `1px solid ${isThisPost ? 'var(--blue)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)', padding: '20px', cursor: 'pointer', position: 'relative',
      }}
      onClick={() => navigate(`/post/${post.id}`)}
      aria-label={`${post.title} by ${post.display_name || post.username}. ${TYPE_LABELS[post.type] || ''}. ${post.duration_seconds ? formatDuration(post.duration_seconds) : ''}`}
    >
      {isThisPost && (
        <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--blue-bright)' }} />
      )}

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <button
          onClick={post.type === 'video' ? e => { e.stopPropagation(); navigate(`/post/${post.id}`) } : handlePlay}
          aria-label={post.type === 'video' ? `Open video: ${post.title}` : isPlaying ? `Pause ${post.title}` : `Play ${post.title}`}
          style={{
            width: 48, height: 48, borderRadius: post.type === 'video' ? 'var(--radius-sm)' : '50%',
            background: isThisPost ? 'var(--blue)' : 'var(--bg4)', color: '#fff', fontSize: 18, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)',
          }}
        >
          {post.type === 'video' ? '🎬' : isPlaying ? '⏸' : '▶'}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span aria-hidden="true" style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
              {TYPE_ICONS[post.type]} {TYPE_LABELS[post.type]}
            </span>
            {post.duration_seconds > 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>· {formatDuration(post.duration_seconds)}</span>
            )}
          </div>

          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 4, lineHeight: 1.3 }}>
            {post.title}
          </h3>

          {post.body && (
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 10 }} aria-label={`Preview: ${post.body.slice(0, 120)}`}>
              {post.body.slice(0, 120)}{post.body.length > 120 ? '…' : ''}
            </p>
          )}

          {post.link_url && (
            <div
              style={{ fontSize: 12, color: 'var(--blue-bright)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}
              aria-label={`Includes a link to ${post.link_title || post.link_site_name || 'an external site'}`}
            >
              <span aria-hidden="true">🔗</span> {post.link_site_name || 'Link attached'}
            </div>
          )}

          {showAuthor && (
            <button
              onClick={e => { e.stopPropagation(); navigate(`/profile/${post.username}`) }}
              style={{ fontSize: 13, color: 'var(--blue-bright)', fontWeight: 500, marginBottom: 10 }}
              aria-label={`Go to ${post.display_name || post.username}'s profile`}
            >
              {post.display_name || post.username}
            </button>
          )}

          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }} aria-label={`Tags: ${tags.join(', ')}`}>
              {tags.map(tag => (
                <span key={tag} style={{ fontSize: 11, padding: '3px 10px', background: 'var(--blue-soft)', color: 'var(--blue-bright)', borderRadius: 'var(--radius-full)', fontWeight: 500 }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <button onClick={handleLike} aria-label={`${liked ? 'Unlike' : 'Like'} this post. ${likes} likes.`} aria-pressed={liked}
              style={{ fontSize: 13, color: liked ? 'var(--coral)' : 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
              <span aria-hidden="true">{liked ? '♥' : '♡'}</span>{formatCount(likes)}
            </button>
            <button onClick={handleSave} aria-label={saved ? 'Remove from saved' : 'Save this post'} aria-pressed={saved}
              style={{ fontSize: 13, color: saved ? 'var(--amber)' : 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
              <span aria-hidden="true">{saved ? '★' : '☆'}</span>{formatCount(post.save_count || 0)}
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 5 }} aria-label={`${post.comment_count || 0} comments`}>
              <span aria-hidden="true">💬</span>{formatCount(post.comment_count || 0)}
            </span>
            <div onClick={e => e.stopPropagation()}>
              <ShareButton post={post} />
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-3)', marginLeft: 'auto' }} aria-label={`${formatCount(post.play_count || 0)} plays`}>
              <span aria-hidden="true">▶ </span>{formatCount(post.play_count || 0)}
            </span>
          </div>
        </div>
      </div>
    </article>
  )
}
