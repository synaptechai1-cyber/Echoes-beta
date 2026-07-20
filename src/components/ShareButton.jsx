import { useState } from 'react'

// Uses the browser's native share sheet so a screen reader user lands in
// an interface their device already knows how to navigate. Falls back to
// copy-to-clipboard where Web Share isn't available.
export default function ShareButton({ post, layout = 'row' }) {
  const [copied, setCopied] = useState(false)
  const postUrl = `${window.location.origin}/post/${post.id}`

  function buildShareText() {
    if (post.type === 'written' && post.body) {
      const preview = post.body.length > 280 ? post.body.slice(0, 280).trim() + '…' : post.body
      return `${post.title}\n\nby ${post.display_name || post.username} on Echoes\n\n${preview}\n\nRead and listen to the full story:`
    }
    return `${post.title} — a ${post.type === 'audio' ? 'voice story' : 'post'} by ${post.display_name || post.username} on Echoes. Give it a listen:`
  }

  async function handleShare(e) {
    e.stopPropagation()
    const shareText = buildShareText()

    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, text: shareText, url: postUrl })
      } catch {
        // cancelled — not an error worth surfacing
      }
    } else {
      await navigator.clipboard.writeText(`${shareText}\n${postUrl}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const isColumn = layout === 'column'

  return (
    <button
      onClick={handleShare}
      aria-label={copied ? 'Link and text copied to clipboard' : `Share ${post.title} to other apps`}
      style={{
        display: 'flex',
        flexDirection: isColumn ? 'column' : 'row',
        alignItems: 'center', gap: isColumn ? 4 : 5,
        color: copied ? 'var(--amber)' : 'var(--text-2)',
        fontWeight: isColumn ? 400 : 500,
        fontSize: isColumn ? 11 : 13,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: isColumn ? 20 : 14 }}>{copied ? '✓' : '↗'}</span>
      <span>{copied ? 'Copied' : 'Share'}</span>
    </button>
  )
}
