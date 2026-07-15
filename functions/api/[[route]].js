// Echoes — Cloudflare Pages Functions API (v2)
// Lives at /functions/api/[[route]].js
// Auth: Clerk JWT verification.
// Audio storage: real R2 when AUDIO_BUCKET is bound; otherwise falls back to
// base64-in-D1 (TEST MODE) so the app is fully testable before R2 billing is
// sorted out. See README "Test mode" section for how to switch over.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

function error(msg, status = 400) {
  return json({ error: msg }, status)
}

function uid() {
  return crypto.randomUUID()
}

// Resolves the playable audio URL for a post/comment row. Prefers a real
// R2 URL when an audio_key is present; falls back to a base64 data URL
// when only audio_data exists (test mode, no R2 bound).
function resolveAudioUrl(env, row) {
  if (row.audio_key) {
    const base = env.R2_PUBLIC_BASE_URL || ''
    if (base) return `${base}/${row.audio_key}`
  }
  if (row.audio_data) {
    return `data:${row.audio_mime || 'audio/webm'};base64,${row.audio_data}`
  }
  return ''
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000 // avoid call-stack limits on large arrays
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

// ─── Auth — Clerk JWT verification ────────────────────────────────────────────
let cachedJwks = null
let cachedJwksAt = 0
const JWKS_CACHE_MS = 10 * 60 * 1000

async function getJwks(env) {
  const now = Date.now()
  if (cachedJwks && now - cachedJwksAt < JWKS_CACHE_MS) return cachedJwks
  const res = await fetch(`${env.CLERK_JWKS_URL}`)
  if (!res.ok) throw new Error('Failed to fetch Clerk JWKS')
  cachedJwks = await res.json()
  cachedJwksAt = now
  return cachedJwks
}

function base64UrlToUint8Array(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob(padded)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

async function verifyClerkToken(token, env) {
  try {
    const [headerB64, payloadB64, sigB64] = token.split('.')
    if (!headerB64 || !payloadB64 || !sigB64) return null

    const header = JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(headerB64)))
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(payloadB64)))

    if (payload.exp && Date.now() / 1000 > payload.exp) return null

    const jwks = await getJwks(env)
    const jwk = jwks.keys.find(k => k.kid === header.kid)
    if (!jwk) return null

    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    )

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
    const signature = base64UrlToUint8Array(sigB64)
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, data)

    if (!valid) return null
    return payload.sub
  } catch {
    return null
  }
}

async function getUser(request, env) {
  const auth = request.headers.get('Authorization') || ''
  const token = auth.replace('Bearer ', '')
  if (!token) return null
  return verifyClerkToken(token, env)
}

// ─── Router ──────────────────────────────────────────────────────────────────
export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname.replace('/api', '')
  const method = request.method

  if (method === 'OPTIONS') return new Response(null, { headers: CORS })

  if (path === '/auth/register' && method === 'POST') return handleRegister(request, env)
  if (path === '/me' && method === 'GET') return handleMe(request, env)

  if (path === '/feed' && method === 'GET') return handleFeed(request, env)

  if (path === '/posts' && method === 'POST') return handleCreatePost(request, env)
  if (path.match(/^\/posts\/[^/]+$/) && method === 'DELETE') return handleDeletePost(request, env, path)
  if (path.match(/^\/posts\/[^/]+$/) && method === 'PATCH') return handleEditPost(request, env, path)
  if (path.match(/^\/posts\/[^/]+$/) && method === 'GET') return handleGetPost(request, env, path)
  if (path.match(/^\/posts\/[^/]+\/like$/) && method === 'POST') return handleLike(request, env, path)
  if (path.match(/^\/posts\/[^/]+\/save$/) && method === 'POST') return handleSave(request, env, path)
  if (path.match(/^\/posts\/[^/]+\/comments$/) && method === 'GET') return handleGetComments(request, env, path)
  if (path.match(/^\/posts\/[^/]+\/comments$/) && method === 'POST') return handleAddComment(request, env, path)

  if (path.match(/^\/users\/[^/]+$/) && method === 'GET') return handleGetProfile(request, env, path)
  if (path.match(/^\/users\/[^/]+\/follow$/) && method === 'POST') return handleFollow(request, env, path)
  if (path.match(/^\/users\/[^/]+\/posts$/) && method === 'GET') return handleUserPosts(request, env, path)

  // Real audio upload — the Worker streams the file directly into R2.
  // The client PUTs the raw audio bytes here; we return the key to attach to a post.
  if (path === '/upload/audio' && method === 'POST') return handleAudioUpload(request, env)

  if (path === '/me/saves' && method === 'GET') return handleMySaves(request, env)
  if (path === '/me/earnings' && method === 'GET') return handleMyEarnings(request, env)
  if (path === '/gifts' && method === 'POST') return handleSendGift(request, env)
  if (path.match(/^\/users\/[^/]+\/gifts$/) && method === 'GET') return handleGetGifts(request, env, path)

  return error('Not found', 404)
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleRegister(request, env) {
  const clerkUserId = await getUser(request, env)
  if (!clerkUserId) return error('Unauthorized', 401)

  const { username, display_name } = await request.json()
  if (!username || !display_name) return error('username and display_name required')
  const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, '')
  if (clean.length < 2) return error('Username must be at least 2 characters')

  const existingByUsername = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(clean).first()
  if (existingByUsername) return error('Username taken')

  const existingByClerkId = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(clerkUserId).first()
  if (existingByClerkId) return json({ user: existingByClerkId })

  await env.DB.prepare(
    'INSERT INTO users (id, username, display_name) VALUES (?, ?, ?)'
  ).bind(clerkUserId, clean, display_name).run()

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(clerkUserId).first()
  return json({ user })
}

async function handleMe(request, env) {
  const userId = await getUser(request, env)
  if (!userId) return error('Unauthorized', 401)
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first()
  if (!user) return error('No Echoes profile yet', 404)
  return json({ user })
}

async function handleFeed(request, env) {
  const url = new URL(request.url)
  const cursor = url.searchParams.get('cursor') || ''
  const limit = 20

  const results = cursor
    ? await env.DB.prepare(
        `SELECT p.*, u.username, u.display_name, u.avatar_url
         FROM posts p JOIN users u ON p.user_id = u.id
         WHERE p.created_at < ? ORDER BY p.created_at DESC LIMIT ?`
      ).bind(cursor, limit).all()
    : await env.DB.prepare(
        `SELECT p.*, u.username, u.display_name, u.avatar_url
         FROM posts p JOIN users u ON p.user_id = u.id
         ORDER BY p.created_at DESC LIMIT ?`
      ).bind(limit).all()

  const posts = results.results.map(p => ({
    ...p,
    tags: JSON.parse(p.tags || '[]'),
    audio_url: resolveAudioUrl(env, p),
    audio_data: undefined, // never send raw base64 blobs through the feed list — too heavy; fetched on demand via getPost
  }))

  const nextCursor = posts.length === limit ? posts[posts.length - 1].created_at : null
  return json({ posts, nextCursor })
}

// ─── Link preview ("unfurling") ───────────────────────────────────────────────
// When a post's text contains a URL, we fetch that page server-side and pull
// out its Open Graph meta tags (the same standard every major site publishes
// for link previews) — title, description, image, site name. This becomes
// an accessible card on the frontend instead of a raw URL string, which
// would otherwise be read aloud character-by-character by a screen reader.
// We never attempt to embed or play the linked content itself — only
// preview it — since most platforms block real embedding outside their
// own app anyway.

const URL_PATTERN = /https?:\/\/[^\s]+/i

function extractFirstUrl(text) {
  const match = (text || '').match(URL_PATTERN)
  return match ? match[0] : null
}

function extractMetaTag(html, property) {
  // Matches <meta property="og:title" content="..."> in either attribute order
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`, 'i'),
  ]
  for (const re of patterns) {
    const match = html.match(re)
    if (match) return decodeHtmlEntities(match[1])
  }
  return ''
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
}

async function unfurlLink(url) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // don't let a slow site hang post creation

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Many sites serve simplified Open-Graph-only HTML to known crawlers
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      },
    })
    clearTimeout(timeout)
    if (!res.ok) return null

    const contentType = res.headers.get('Content-Type') || ''
    if (!contentType.includes('text/html')) return null

    // Only read the first chunk — meta tags are always in <head>, no need
    // to download an entire page body just for a preview.
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let html = ''
    for (let i = 0; i < 30; i++) { // cap iterations as a safety net
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
      if (html.length > 60000 || html.includes('</head>')) break
    }
    reader.cancel().catch(() => {})

    const title = extractMetaTag(html, 'og:title') || extractMetaTag(html, 'title')
    const description = extractMetaTag(html, 'og:description') || extractMetaTag(html, 'description')
    const image = extractMetaTag(html, 'og:image')
    const siteName = extractMetaTag(html, 'og:site_name') || new URL(url).hostname.replace('www.', '')

    if (!title && !description) return null // nothing useful found

    return {
      link_url: url,
      link_title: title.slice(0, 200),
      link_description: description.slice(0, 300),
      link_image: image,
      link_site_name: siteName,
    }
  } catch {
    return null // any failure (timeout, blocked, malformed) just means no preview card — never blocks posting
  }
}

async function handleCreatePost(request, env) {
  const userId = await getUser(request, env)
  if (!userId) return error('Unauthorized', 401)

  const body = await request.json()
  const { type, title, content, audio_key, audio_data, audio_mime, audio_description, duration_seconds, tags, series_id, series_episode } = body
  if (!type) return error('type required')
  if (!['audio','written','voice_note','live','moment','video'].includes(type)) return error('Invalid post type')
  if (type !== 'moment' && !title) return error('title required')

  // Detect and unfurl a link in the post body, if present.
  let linkData = null
  const detectedUrl = extractFirstUrl(content)
  if (detectedUrl) {
    linkData = await unfurlLink(detectedUrl)
  }

  const id = uid()
  await env.DB.prepare(
    `INSERT INTO posts (id, user_id, type, title, body, audio_key, audio_data, audio_mime, audio_description, duration_seconds, tags, series_id, series_episode, link_url, link_title, link_description, link_image, link_site_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, userId, type, title, content || '', audio_key || '', audio_data || '', audio_mime || 'audio/webm',
    audio_description || '', duration_seconds || 0, JSON.stringify(tags || []), series_id || null, series_episode || null,
    linkData?.link_url || '', linkData?.link_title || '', linkData?.link_description || '',
    linkData?.link_image || '', linkData?.link_site_name || '').run()

  await env.DB.prepare('UPDATE users SET post_count = post_count + 1 WHERE id = ?').bind(userId).run()

  const post = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first()
  return json({ post: { ...post, tags: JSON.parse(post.tags), audio_url: resolveAudioUrl(env, post), audio_data: undefined } }, 201)
}

async function handleDeletePost(request, env, path) {
  const userId = await getUser(request, env)
  if (!userId) return error('Unauthorized', 401)
  const postId = path.split('/')[2]

  const post = await env.DB.prepare('SELECT user_id, audio_key FROM posts WHERE id = ?').bind(postId).first()
  if (!post) return error('Post not found', 404)

  // Only the author can delete their own post
  if (post.user_id !== userId) return error('Forbidden — you can only delete your own posts', 403)

  // Clean up R2 audio file if one exists
  if (post.audio_key && env.AUDIO_BUCKET) {
    await env.AUDIO_BUCKET.delete(post.audio_key).catch(() => {})
  }

  await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(postId).run()
  await env.DB.prepare('UPDATE users SET post_count = MAX(0, post_count - 1) WHERE id = ?').bind(userId).run()

  return json({ deleted: true })
}

async function handleEditPost(request, env, path) {
  const userId = await getUser(request, env)
  if (!userId) return error('Unauthorized', 401)
  const postId = path.split('/')[2]

  const post = await env.DB.prepare('SELECT user_id, type FROM posts WHERE id = ?').bind(postId).first()
  if (!post) return error('Post not found', 404)
  if (post.user_id !== userId) return error('Forbidden — you can only edit your own posts', 403)

  const { title, body, tags } = await request.json()

  // Only title, body, and tags are editable — not type or audio
  await env.DB.prepare(
    'UPDATE posts SET title = ?, body = ?, tags = ? WHERE id = ?'
  ).bind(
    title !== undefined ? title : null,
    body !== undefined ? body : '',
    tags !== undefined ? JSON.stringify(tags) : '[]',
    postId
  ).run()

  const updated = await env.DB.prepare(
    'SELECT p.*, u.username, u.display_name FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?'
  ).bind(postId).first()

  return json({ post: { ...updated, tags: JSON.parse(updated.tags || '[]'), audio_url: resolveAudioUrl(env, updated), audio_data: undefined } })
}

async function handleGetPost(request, env, path) {
  const id = path.split('/')[2]
  const post = await env.DB.prepare(
    `SELECT p.*, u.username, u.display_name, u.avatar_url
     FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?`
  ).bind(id).first()
  if (!post) return error('Post not found', 404)
  await env.DB.prepare('UPDATE posts SET play_count = play_count + 1 WHERE id = ?').bind(id).run()
  return json({ post: { ...post, tags: JSON.parse(post.tags || '[]'), audio_url: resolveAudioUrl(env, post), audio_data: undefined } })
}

async function handleLike(request, env, path) {
  const userId = await getUser(request, env)
  if (!userId) return error('Unauthorized', 401)
  const postId = path.split('/')[2]

  const existing = await env.DB.prepare('SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?').bind(userId, postId).first()
  if (existing) {
    await env.DB.prepare('DELETE FROM likes WHERE user_id = ? AND post_id = ?').bind(userId, postId).run()
    await env.DB.prepare('UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id = ?').bind(postId).run()
    return json({ liked: false })
  } else {
    await env.DB.prepare('INSERT INTO likes (user_id, post_id) VALUES (?, ?)').bind(userId, postId).run()
    await env.DB.prepare('UPDATE posts SET like_count = like_count + 1 WHERE id = ?').bind(postId).run()
    return json({ liked: true })
  }
}

async function handleSave(request, env, path) {
  const userId = await getUser(request, env)
  if (!userId) return error('Unauthorized', 401)
  const postId = path.split('/')[2]

  const existing = await env.DB.prepare('SELECT 1 FROM saves WHERE user_id = ? AND post_id = ?').bind(userId, postId).first()
  if (existing) {
    await env.DB.prepare('DELETE FROM saves WHERE user_id = ? AND post_id = ?').bind(userId, postId).run()
    await env.DB.prepare('UPDATE posts SET save_count = MAX(0, save_count - 1) WHERE id = ?').bind(postId).run()
    return json({ saved: false })
  } else {
    await env.DB.prepare('INSERT INTO saves (user_id, post_id) VALUES (?, ?)').bind(userId, postId).run()
    await env.DB.prepare('UPDATE posts SET save_count = save_count + 1 WHERE id = ?').bind(postId).run()
    return json({ saved: true })
  }
}

async function handleGetComments(request, env, path) {
  const postId = path.split('/')[2]
  const results = await env.DB.prepare(
    `SELECT c.*, u.username, u.display_name FROM comments c
     JOIN users u ON c.user_id = u.id WHERE c.post_id = ? ORDER BY c.created_at ASC`
  ).bind(postId).all()
  const comments = results.results.map(c => ({ ...c, audio_url: resolveAudioUrl(env, c), audio_data: undefined }))
  return json({ comments })
}

async function handleAddComment(request, env, path) {
  const userId = await getUser(request, env)
  if (!userId) return error('Unauthorized', 401)
  const postId = path.split('/')[2]
  const { body, audio_key, audio_data, audio_mime } = await request.json()
  if (!body && !audio_key && !audio_data) return error('body or audio required')

  const id = uid()
  await env.DB.prepare(
    'INSERT INTO comments (id, post_id, user_id, body, audio_key, audio_data, audio_mime) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, postId, userId, body || '', audio_key || '', audio_data || '', audio_mime || 'audio/webm').run()
  await env.DB.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?').bind(postId).run()

  const comment = await env.DB.prepare(
    'SELECT c.*, u.username, u.display_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?'
  ).bind(id).first()
  return json({ comment: { ...comment, audio_url: resolveAudioUrl(env, comment), audio_data: undefined } }, 201)
}

async function handleGetProfile(request, env, path) {
  const username = path.split('/')[2]
  const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first()
  if (!user) return error('User not found', 404)

  // Tell the frontend whether the current viewer already follows this
  // person, so the Follow/Following button reflects reality on load
  // instead of always starting unfollowed.
  let is_following = false
  const viewerId = await getUser(request, env)
  if (viewerId) {
    const existing = await env.DB.prepare(
      'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?'
    ).bind(viewerId, user.id).first()
    is_following = !!existing
  }

  return json({ user: { ...user, is_following } })
}

async function handleFollow(request, env, path) {
  const userId = await getUser(request, env)
  if (!userId) return error('Unauthorized', 401)
  const targetUsername = path.split('/')[2]
  const target = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(targetUsername).first()
  if (!target) return error('User not found', 404)
  if (target.id === userId) return error('Cannot follow yourself')

  const existing = await env.DB.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').bind(userId, target.id).first()
  if (existing) {
    await env.DB.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').bind(userId, target.id).run()
    await env.DB.prepare('UPDATE users SET follower_count = MAX(0, follower_count - 1) WHERE id = ?').bind(target.id).run()
    await env.DB.prepare('UPDATE users SET following_count = MAX(0, following_count - 1) WHERE id = ?').bind(userId).run()
    return json({ following: false })
  } else {
    await env.DB.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)').bind(userId, target.id).run()
    await env.DB.prepare('UPDATE users SET follower_count = follower_count + 1 WHERE id = ?').bind(target.id).run()
    await env.DB.prepare('UPDATE users SET following_count = following_count + 1 WHERE id = ?').bind(userId).run()
    return json({ following: true })
  }
}

async function handleUserPosts(request, env, path) {
  const username = path.split('/')[2]
  const user = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
  if (!user) return error('User not found', 404)

  const results = await env.DB.prepare(
    'SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(user.id).all()
  return json({ posts: results.results.map(p => ({ ...p, tags: JSON.parse(p.tags || '[]'), audio_url: resolveAudioUrl(env, p), audio_data: undefined })) })
}

// Audio upload. Uses real R2 storage when AUDIO_BUCKET is bound to this
// Worker. If it isn't (e.g. R2 billing not yet activated), falls back to
// returning the audio as base64 for the client to attach directly to the
// post/comment as audio_data — stored in D1 instead. This keeps the app
// fully testable without R2, at the cost of D1 storage efficiency, which
// is fine for a small test cohort. Switch to R2 later by simply binding
// AUDIO_BUCKET; no frontend changes needed, since the client already
// prefers whichever the upload response gives it.
async function handleAudioUpload(request, env) {
  const userId = await getUser(request, env)
  if (!userId) return error('Unauthorized', 401)

  const contentType = request.headers.get('Content-Type') || 'audio/webm'
  const body = await request.arrayBuffer()
  if (body.byteLength === 0) return error('Empty upload')
  if (body.byteLength > 50 * 1024 * 1024) return error('File too large (50MB max)')

  const isVideo = contentType.startsWith('video/')
  const extension = isVideo
    ? (contentType.includes('mp4') ? 'mp4' : contentType.includes('quicktime') ? 'mov' : 'webm')
    : (contentType.includes('mp4') ? 'm4a' : 'webm')
  const folder = isVideo ? 'video' : 'audio'

  if (env.AUDIO_BUCKET) {
    const key = `${folder}/${userId}/${uid()}.${extension}`
    await env.AUDIO_BUCKET.put(key, body, { httpMetadata: { contentType } })
    return json({ mode: 'r2', key, url: resolveAudioUrl(env, { audio_key: key }) }, 201)
  }

  // Test mode fallback — D1 only, limited to 5MB
  if (body.byteLength > 5 * 1024 * 1024) {
    return error('File too large for test mode (5MB max). R2 storage is not connected yet.')
  }
  const audio_data = arrayBufferToBase64(body)
  return json({ mode: 'test', audio_data, audio_mime: contentType }, 201)
}

async function handleMySaves(request, env) {
  const userId = await getUser(request, env)
  if (!userId) return error('Unauthorized', 401)

  const results = await env.DB.prepare(
    `SELECT p.*, u.username, u.display_name, u.avatar_url
     FROM saves s JOIN posts p ON s.post_id = p.id JOIN users u ON p.user_id = u.id
     WHERE s.user_id = ? ORDER BY s.created_at DESC`
  ).bind(userId).all()
  return json({ posts: results.results.map(p => ({ ...p, tags: JSON.parse(p.tags || '[]'), audio_url: resolveAudioUrl(env, p), audio_data: undefined })) })
}

async function handleMyEarnings(request, env) {
  const userId = await getUser(request, env)
  if (!userId) return error('Unauthorized', 401)

  const results = await env.DB.prepare(
    'SELECT * FROM creator_earnings WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all()
  const total = results.results.reduce((sum, e) => sum + (e.status !== 'pending' ? e.amount_cents : 0), 0)
  return json({ earnings: results.results, total_paid_cents: total })
}

async function handleSendGift(request, env) {
  const senderId = await getUser(request, env)
  if (!senderId) return error('Unauthorized', 401)

  const { recipient_username, post_id, amount, message } = await request.json()
  if (!recipient_username) return error('recipient_username required')
  if (!amount || amount < 1 || amount > 100) return error('Amount must be between 1 and 100 stars')

  const recipient = await env.DB.prepare(
    'SELECT id FROM users WHERE username = ?'
  ).bind(recipient_username).first()
  if (!recipient) return error('Recipient not found', 404)
  if (recipient.id === senderId) return error('You cannot send stars to yourself')

  const id = uid()
  await env.DB.prepare(
    'INSERT INTO gifts (id, sender_id, recipient_id, post_id, amount, message) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, senderId, recipient.id, post_id || null, amount, message || '').run()

  return json({ gift: { id, amount, message }, success: true }, 201)
}

async function handleGetGifts(request, env, path) {
  const username = path.split('/')[2]
  const user = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first()
  if (!user) return error('User not found', 404)

  const results = await env.DB.prepare(
    `SELECT g.*, u.username as sender_username, u.display_name as sender_display_name
     FROM gifts g JOIN users u ON g.sender_id = u.id
     WHERE g.recipient_id = ? ORDER BY g.created_at DESC LIMIT 50`
  ).bind(user.id).all()

  const total = results.results.reduce((sum, g) => sum + g.amount, 0)
  return json({ gifts: results.results, total_stars: total })
}
