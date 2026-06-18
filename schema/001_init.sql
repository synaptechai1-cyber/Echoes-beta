-- Echoes — D1 Database Schema (v2 clean rebuild)
-- Run: npm run db:migrate (local) or npm run db:migrate:remote (production)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                    -- Clerk user ID
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('audio','written','voice_note','live')),
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  audio_key TEXT DEFAULT '',              -- R2 object key, e.g. audio/{userId}/{postId}.webm (used once R2 is connected)
  audio_url TEXT DEFAULT '',              -- resolved public URL, filled in by the API
  audio_data TEXT DEFAULT '',             -- TEST MODE ONLY: base64 audio stored directly in D1 while R2 billing is unresolved. Switch to audio_key once R2 is live — see README "Test mode" section.
  audio_mime TEXT DEFAULT 'audio/webm',   -- TEST MODE ONLY: content type for the audio_data blob
  duration_seconds INTEGER DEFAULT 0,
  tags TEXT DEFAULT '[]',
  like_count INTEGER DEFAULT 0,
  save_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  play_count INTEGER DEFAULT 0,
  series_id TEXT DEFAULT NULL,
  series_episode INTEGER DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS likes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS saves (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, post_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  audio_key TEXT DEFAULT '',
  audio_url TEXT DEFAULT '',
  audio_data TEXT DEFAULT '',             -- TEST MODE ONLY: see posts.audio_data note above
  audio_mime TEXT DEFAULT 'audio/webm',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  episode_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Creator payment program: tracks earnings so standout writers/narrators
-- (e.g. talent sourced through school partnerships) can be paid for
-- performance, independent of any ad-revenue system.
CREATE TABLE IF NOT EXISTS creator_earnings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'ZAR',
  reason TEXT NOT NULL CHECK(reason IN ('performance_bonus','featured_creator','school_program','manual_award')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','paid')),
  note TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  paid_at TEXT DEFAULT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_feed ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_saves_user ON saves(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_earnings_user ON creator_earnings(user_id, created_at DESC);
