// Echoes API client — talks to Cloudflare Workers backend.
// Auth handled by Clerk; this module holds the session token in memory
// and attaches it to every request.

let currentToken = null

function setToken(token) {
  currentToken = token
}

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      ...options.headers,
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// Audio uploads send raw bytes, not JSON — separate path that skips the
// Content-Type: application/json default above.
async function uploadAudio(blob) {
  const res = await fetch('/api/upload/audio', {
    method: 'POST',
    headers: {
      'Content-Type': blob.type || 'audio/webm',
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
    },
    body: blob,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  return data // { key, url }
}

export const api = {
  setToken,
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
  addComment: (id, body, audio_key) =>
    request(`/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ body, audio_key }) }),

  getProfile: (username) => request(`/users/${username}`),
  getUserPosts: (username) => request(`/users/${username}/posts`),
  follow: (username) => request(`/users/${username}/follow`, { method: 'POST' }),

  mySaves: () => request('/me/saves'),
  myEarnings: () => request('/me/earnings'),
}
