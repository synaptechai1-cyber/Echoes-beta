// Echoes API client — talks to Cloudflare Workers backend.
// Auth handled by Clerk. Instead of caching the token string (which
// expires), we store Clerk's getToken function and call it fresh before
// every request — Clerk handles caching internally and issues a new
// token automatically when the current one expires.

let _getToken = null

function setGetToken(fn) {
  _getToken = fn
}

async function request(path, options = {}) {
  // Always get a fresh token — Clerk caches it internally so this is
  // fast when the token is still valid, and transparent when it isn't.
  const token = _getToken ? await _getToken({ skipCache: false }) : null

  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// Audio uploads send raw bytes, not JSON — separate path that skips the
// Content-Type: application/json default above. Server replies with either
// { mode: 'r2', key, url } or { mode: 'test', audio_data, audio_mime }
// depending on whether R2 is connected — Create.jsx handles both.
async function uploadAudio(blob) {
  const token = _getToken ? await _getToken({ skipCache: false }) : null
  const res = await fetch('/api/upload/audio', {
    method: 'POST',
    headers: {
      'Content-Type': blob.type || 'audio/webm',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: blob,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data
}

export const api = {
  // Called once on app load with Clerk's getToken function
  setGetToken,

  // Keep setToken for backward compat during transition
  setToken: () => {},

  uploadAudio,

  register: (username, display_name) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ username, display_name }) }),
  me: () => request('/me'),

  feed: (cursor) => request(`/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),

  createPost: (data) => request('/posts', { method: 'POST', body: JSON.stringify(data) }),
  getPost: (id) => request(`/posts/${id}`),
  likePost: (id) => request(`/posts/${id}/like`, { method: 'POST' }),
  savePost: (id) => request(`/posts/${id}/save`, { method: 'POST' }),
  getComments: (id) => request(`/posts/${id}/comments`),
  addComment: (id, body, audioFields = {}) =>
    request(`/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ body, ...audioFields }) }),

  getProfile: (username) => request(`/users/${username}`),
  getUserPosts: (username) => request(`/users/${username}/posts`),
  follow: (username) => request(`/users/${username}/follow`, { method: 'POST' }),

  mySaves: () => request('/me/saves'),
  myEarnings: () => request('/me/earnings'),
}
