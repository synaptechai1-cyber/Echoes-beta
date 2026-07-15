// Renders a fetched link as an accessible preview card instead of a raw
// URL string. A screen reader would otherwise read a long link character
// by character — this gives it a real title, a site name ("via YouTube"),
// and a single clearly labeled button to open it. We never try to embed
// or play the destination content itself, since most platforms (YouTube,
// Facebook, TikTok) block real playback outside their own apps — this is
// a preview that hands off cleanly, the same pattern almost every social
// app uses for outside links.
export default function LinkPreviewCard({ post }) {
  if (!post.link_url) return null

  function openLink(e) {
    e.stopPropagation()
    window.open(post.link_url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      style={{
        marginTop: 12, marginBottom: 12,
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        overflow: 'hidden', background: 'var(--bg3)',
      }}
      aria-label={`Linked content: ${post.link_title || post.link_url}, via ${post.link_site_name || 'external site'}`}
    >
      {post.link_image && (
        <img
          src={post.link_image}
          alt=""
          aria-hidden="true"
          style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }}
          onError={e => { e.target.style.display = 'none' }}
        />
      )}
      <div style={{ padding: '14px 16px' }}>
        {post.link_site_name && (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--blue-bright)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            {post.link_site_name}
          </div>
        )}
        {post.link_title && (
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4, lineHeight: 1.4 }}>
            {post.link_title}
          </div>
        )}
        {post.link_description && (
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 12 }}>
            {post.link_description.slice(0, 120)}{post.link_description.length > 120 ? '…' : ''}
          </div>
        )}
        <button
          onClick={openLink}
          aria-label={`Open link: ${post.link_title || post.link_url} on ${post.link_site_name || 'external site'}, opens in a new tab`}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', background: 'var(--blue-soft)', color: 'var(--blue-bright)',
            borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 700,
            border: '1px solid var(--blue)',
          }}
        >
          <span aria-hidden="true">↗</span> Open link
        </button>
      </div>
    </div>
  )
}
