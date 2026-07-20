import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useClerk } from '@clerk/clerk-react'
import { api } from '../utils/api.js'
import { useEchoUser } from '../utils/EchoUserSync.jsx'
import { useTheme } from '../utils/ThemeContext.jsx'
import PostCard from '../components/PostCard.jsx'

export default function Profile() {
  const { username } = useParams()
  const navigate = useNavigate()
  const { echoUser: me } = useEchoUser() || {}
  const { signOut } = useClerk()
  const { theme, toggleTheme } = useTheme()
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const isMe = me?.username === username

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [pData, postsData] = await Promise.all([
          api.getProfile(username),
          api.getUserPosts(username),
        ])
        setProfile(pData.user)
        setFollowing(!!pData.user.is_following)
        setPosts(postsData.posts)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [username])

  async function handleFollow() {
    try {
      const res = await api.follow(username)
      setFollowing(res.following)
      setProfile(p => ({
        ...p,
        follower_count: res.following ? p.follower_count + 1 : p.follower_count - 1,
      }))
    } catch {}
  }

  function formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return (n || 0).toString()
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
        <div className="spinner" role="status" aria-label="Loading profile">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return <div role="alert" style={{ padding: 32, color: 'var(--coral)', textAlign: 'center' }}>Profile not found.</div>
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px' }}>
      <div
        role="region"
        aria-label={`${profile.display_name}'s profile`}
        style={{ padding: '32px 0 24px', borderBottom: '1px solid var(--border)', marginBottom: 24 }}
      >
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'var(--blue-soft)', border: '2px solid var(--blue)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 700,
          color: 'var(--blue-bright)', marginBottom: 16,
        }} aria-hidden="true">
          {profile.display_name?.[0]?.toUpperCase()}
        </div>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
          {profile.display_name}
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 12 }}>@{profile.username}</p>

        {profile.bio && (
          <p style={{ color: 'var(--text-2)', fontSize: 15, lineHeight: 1.6, marginBottom: 16 }}>{profile.bio}</p>
        )}

        <div
          style={{ display: 'flex', gap: 32, marginBottom: 20 }}
          aria-label={`${formatNum(profile.post_count)} posts, ${formatNum(profile.follower_count)} followers, ${formatNum(profile.following_count)} following`}
        >
          {[
            { label: 'posts', value: profile.post_count },
            { label: 'followers', value: profile.follower_count },
            { label: 'following', value: profile.following_count },
          ].map(stat => (
            <div key={stat.label}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>{formatNum(stat.value)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {isMe ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode (high contrast)' : 'Switch to dark mode'}
              className="theme-toggle"
            >
              <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button
              onClick={() => signOut()}
              aria-label="Sign out of Echoes"
              style={{ padding: '10px 24px', background: 'var(--bg4)', color: 'var(--text-2)', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600, border: '1px solid var(--border)' }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleFollow}
              aria-label={following ? `Unfollow ${profile.display_name}` : `Follow ${profile.display_name}`}
              aria-pressed={following}
              style={{
                padding: '10px 28px',
                background: following ? 'transparent' : 'var(--blue)',
                color: following ? 'var(--blue-bright)' : '#fff',
                borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700,
                border: '1px solid var(--blue)', fontFamily: 'var(--font-display)',
              }}
            >
              {following ? 'Following' : 'Follow'}
            </button>
            <button
              onClick={async () => {
                try {
                  const data = await api.startConversation(username)
                  navigate(`/messages/${data.conversation_id}`)
                } catch {}
              }}
              aria-label={`Send a direct message to ${profile.display_name}`}
              style={{
                padding: '10px 20px',
                background: 'var(--surface)', color: 'var(--text-2)',
                borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 600,
                border: '1px solid var(--border)',
              }}
            >
              ✉️ Message
            </button>
          </div>
        )}
      </div>

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 16 }} aria-live="polite">
        {posts.length === 0 ? 'No posts yet' : `${posts.length} post${posts.length !== 1 ? 's' : ''}`}
      </h2>

      <div role="feed" aria-label={`${profile.display_name}'s posts`} style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 32 }}>
        {posts.map(post => (
          <PostCard key={post.id} post={post} showAuthor={false} />
        ))}
      </div>
    </div>
  )
}
