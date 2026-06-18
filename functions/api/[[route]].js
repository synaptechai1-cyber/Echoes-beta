// Echoes — Cloudflare Pages Functions API (v2)
// Lives at /functions/api/[[route]].js
// Auth: Clerk JWT verification. Audio: real R2 storage, not blob URLs.

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

function resolveAudioUrl(env, audioKey) {
  if (!audioKey) return ''
  const base = env.R2_PUBLIC_BASE_URL || ''
  return base ? `${base}/${audioKey}` : ''
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
    audio_url: resolveAudioUrl(env, p.audio_key),
  }))

  const nextCursor = posts.length === limit ? posts[posts.length - 1].created_at : null
  return json({ posts, nextCursor })
}

async function handleCreatePost(request, env) {
  const userId = await getUser(request, env)
  if (!userId) return error('Unauthorized', 401)

  const body = await request.json()
  const { type, title, content, audio_key, duration_seconds, tags, series_id, series_episode } = body
  if (!type || !title) return error('type and title required')

  const id = uid()
  await env.DB.prepare(
    `INSERT INTO posts (id, user_id, type, title, body, audio_key, duration_seconds, tags, series_id, series_episode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, userId, type, title, content || '', audio_key || '', duration_seconds || 0,
    JSON.stringify(tags || []), series_id || null, series_episode || null).run()

  await env.DB.prepare('UPDATE users SET post_count = post_count + 1 WHERE id = ?').bind(userId).run()

  const post = await env.DB.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first()
  return json({ post: { ...post, tags: JSON.parse(post.tags), audio_url: resolveAudioUrl(env, post.audio_key) } }, 201)
}

async function handleGetPost(request, env, path) {
  const id = path.split('/')[2]
  const post = await env.DB.prepare(
    `SELECT p.*, u.username, u.display_name, u.avatar_url
     FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?`
  ).bind(id).first()
  if (!post) return error('Post not found', 404)
  await env.DB.prepare('UPDATE posts SET play_count = play_count + 1 WHERE id = ?').bind(id).run()
  return json({ post: { ...post, tags: JSON.parse(post.tags || '[]'), audio_url: resolveAudioUrl(env, post.audio_key) } })
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
  const comments = results.results.map(c => ({ ...c, audio_url: resolveAudioUrl(env, c.audio_key) }))
  return json({ comments })
}

async function handleAddComment(request, env, path) {
  const userId = await getUser(request, env)
  if (!userId) return error('Unauthorized', 401)
  const postId = path.split('/')[2]
  const { body, audio_key } = await request.json()
  if (!body && !audio_key) return error('body or audio_key required')

  const id = uid()
  await env.DB.prepare(
    'INSERT INTO comments (id, post_id, user_id, body, audio_key) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, postId, userId, body || '', audio_key || '').run()
  await env.DB.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?').bind(postId).run()

  const comment = await env.DB.prepare(
    'SELECT c.*, u.username, u.display_name FROM comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?'
  ).bind(id).first()
  return json({ comment: { ...comment, audio_url: resolveAudioUrl(env, comment.audio_key) } }, 201)
}

async function handleGetProfile(request, env, path) {
  const username = path.split('/')[2]
  const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first()
  if (!user) return error('User not found', 404)
  return json({ user })
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
  return json({ posts: results.results.map(p => ({ ...p, tags: JSON.parse(p.tags || '[]'), audio_url: resolveAudioUrl(env, p.audio_key) })) })
}

// Real R2 upload: the client sends raw audio bytes (audio/webm) with the
// Authorization header; we stream it straight into the bucket. No presigned
// URL dance needed because the Worker itself has the R2 binding.
async function handleAudioUpload(request, env) {
  const userId = await getUser(request, env)
  if (!userId) return error('Unauthorized', 401)
  if (!env.AUDIO_BUCKET) return error('Storage not configured', 500)

  const contentType = request.headers.get('Content-Type') || 'audio/webm'
  const extension = contentType.includes('mp4') ? 'm4a' : 'webm'
  const key = `audio/${userId}/${uid()}.${extension}`

  const body = await request.arrayBuffer()
  if (body.byteLength === 0) return error('Empty audio upload')
  if (body.byteLength > 25 * 1024 * 1024) return error('Audio file too large (25MB max)')

  await env.AUDIO_BUCKET.put(key, body, {
    httpMetadata: { contentType },
  })

  return json({ key, url: resolveAudioUrl(env, key) }, 201)
}

async function handleMySaves(request, env) {
  const userId = await getUser(request, env)
  if (!userId) return error('Unauthorized', 401)

  const results = await env.DB.prepare(
    `SELECT p.*, u.username, u.display_name, u.avatar_url
     FROM saves s JOIN posts p ON s.post_id = p.id JOIN users u ON p.user_id = u.id
     WHERE s.user_id = ? ORDER BY s.created_at DESC`
  ).bind(userId).all()
  return json({ posts: results.results.map(p => ({ ...p, tags: JSON.parse(p.tags || '[]'), audio_url: resolveAudioUrl(env, p.audio_key) })) })
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
