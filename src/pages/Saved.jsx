import { useState, useEffect } from 'react'
import { api } from '../utils/api.js'
import PostCard from '../components/PostCard.jsx'

export default function Saved() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.mySaves().then(data => setPosts(data.posts)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px' }}>
      <header style={{ padding: '24px 0 20px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>Saved</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 4 }}>Posts you've bookmarked to listen to again.</p>
      </header>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div className="spinner" role="status" aria-label="Loading saved posts">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-2)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden="true">★</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 8, color: 'var(--text)' }}>Nothing saved yet</h2>
          <p style={{ fontSize: 15 }}>Hold any post in the feed, or tap the star, to save it here.</p>
        </div>
      )}

      <div role="feed" aria-label="Your saved posts" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {posts.map(post => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  )
}
