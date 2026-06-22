import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../utils/api.js'
import { usePlayer } from '../utils/PlayerContext.jsx'
import ShareButton from '../components/ShareButton.jsx'
import LinkPreviewCard from '../components/LinkPreviewCard.jsx'

export default function PostDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { play, currentPost, playing } = usePlayer()
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)

  const isPlaying = currentPost?.id === id && playing

  useEffect(() => {
    async function load() {
      try {
        const [pData, cData] = await Promise.all([api.getPost(id), api.getComments(id)])
        setPost(pData.post)
        setComments(cData.comments)
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [id])

  async function handleLike() {
    const res = await api.likePost(id)
    setLiked(res.liked)
    setPost(p => ({ ...p, like_count: res.liked ? p.like_count + 1 : p.like_count - 1 }))
  }

  async function handleSave() {
    const res = await api.savePost(id)
    setSaved(res.saved)
  }

  async function submitComment(e) {
    e.preventDefault()
    if (!commentText.trim()) return
    setSubmittingComment(true)
    try {
      const res = await api.addComment(id, commentText)
      setComments(prev => [...prev, res.comment])
      setCommentText('')
      setPost(p => ({ ...p, comment_count: (p.comment_count || 0) + 1 }))
    } catch {}
    finally { setSubmittingComment(false) }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <div className="spinner" role="status" aria-label="Loading post"><span></span><span></span><span></span><span></span><span></span></div>
      </div>
    )
  }
  if (!post) return <div style={{ padding: 32, color: 'var(--coral)', textAlign: 'center' }}>Post not found.</div>

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px 48px' }}>
      <button onClick={() => navigate(-1)} aria-label="Go back" style={{ padding: '20px 0', color: 'var(--text-3)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        ← Back
      </button>

      <article aria-label={`${post.title} by ${post.display_name || post.username}`}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, lineHeight: 1.2, marginBottom: 12 }}>{post.title}</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={() => navigate(`/profile/${post.username}`)} style={{ fontSize: 14, color: 'var(--blue-bright)', fontWeight: 600 }} aria-label={`Go to ${post.display_name || post.username}'s profile`}>
            {post.display_name || post.username}
          </button>
          <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{new Date(post.created_at).toLocaleDateString()}</span>
        </div>

        <button
          onClick={() => play(post)}
          aria-label={isPlaying ? 'Pause' : `Play ${post.title}`}
          style={{
            width: '100%', padding: '20px',
            background: isPlaying ? 'var(--blue)' : 'var(--surface)',
            border: `1px solid ${isPlaying ? 'var(--blue)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)', color: '#fff', fontSize: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20,
          }}
        >
          <span aria-hidden="true">{isPlaying ? '⏸' : '▶'}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: isPlaying ? '#fff' : 'var(--text)' }}>
            {isPlaying ? 'Playing…' : 'Play'}
          </span>
        </button>

        {post.audio_url && (
          <audio controls src={post.audio_url} aria-label={`Audio for: ${post.title}`} style={{ width: '100%', marginBottom: 20 }} />
        )}

        {post.body && (
          <div style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--text)', padding: '20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 20 }}
            aria-label={`Story text: ${post.body}`}>
            {post.body}
          </div>
        )}

        <LinkPreviewCard post={post} />

        {post.tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }} aria-label={`Tags: ${post.tags.join(', ')}`}>
            {post.tags.map(tag => (
              <span key={tag} style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)', background: 'var(--blue-soft)', color: 'var(--blue-bright)', fontSize: 12, fontWeight: 500 }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 20, padding: '16px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
          <button onClick={handleLike} aria-pressed={liked} aria-label={liked ? 'Unlike' : 'Like'} style={{ display: 'flex', alignItems: 'center', gap: 8, color: liked ? 'var(--coral)' : 'var(--text-2)', fontWeight: 600 }}>
            <span aria-hidden="true">{liked ? '♥' : '♡'}</span> {post.like_count || 0}
          </button>
          <button onClick={handleSave} aria-pressed={saved} aria-label={saved ? 'Remove from saved' : 'Save'} style={{ display: 'flex', alignItems: 'center', gap: 8, color: saved ? 'var(--amber)' : 'var(--text-2)', fontWeight: 600 }}>
            <span aria-hidden="true">{saved ? '★' : '☆'}</span> Save
          </button>
          <ShareButton post={post} />
          <span style={{ color: 'var(--text-3)', fontSize: 14, marginLeft: 'auto', alignSelf: 'center' }} aria-label={`${post.play_count || 0} plays`}>
            ▶ {post.play_count || 0} plays
          </span>
        </div>

        <section aria-label="Comments">
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
            {comments.length} comment{comments.length !== 1 ? 's' : ''}
          </h2>

          <form onSubmit={submitComment} style={{ marginBottom: 24 }} aria-label="Add a comment">
            <label htmlFor="comment" className="sr-only">Write a comment</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <textarea
                id="comment" value={commentText} onChange={e => setCommentText(e.target.value)}
                placeholder="Add a comment…" rows={2}
                style={{ flex: 1, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 14, resize: 'none' }}
              />
              <button type="submit" disabled={submittingComment || !commentText.trim()} aria-label="Post comment"
                style={{ padding: '0 18px', background: 'var(--blue)', color: '#fff', borderRadius: 'var(--radius-sm)', fontWeight: 700, fontSize: 14, alignSelf: 'stretch', opacity: (submittingComment || !commentText.trim()) ? 0.5 : 1 }}>
                Post
              </button>
            </div>
          </form>

          <div role="list" aria-label="All comments">
            {comments.map(c => (
              <div key={c.id} role="listitem" style={{ padding: '14px 0', borderBottom: '1px solid var(--border)' }} aria-label={`Comment by ${c.display_name || c.username}: ${c.body}`}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--blue-bright)' }}>{c.display_name || c.username}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>{c.body}</p>
              </div>
            ))}
          </div>
        </section>
      </article>
    </div>
  )
}
