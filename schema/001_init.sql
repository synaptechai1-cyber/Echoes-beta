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
  type TEXT NOT NULL CHECK(type IN ('audio','written','voice_note','live','moment','video')),
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  audio_key TEXT DEFAULT '',              -- R2 object key, e.g. audio/{userId}/{postId}.webm (used once R2 is connected)
  audio_url TEXT DEFAULT '',              -- resolved public URL, filled in by the API
  audio_data TEXT DEFAULT '',             -- TEST MODE ONLY
  audio_mime TEXT DEFAULT 'audio/webm',   -- TEST MODE ONLY
  audio_description TEXT DEFAULT '',      -- video posts: spoken description for blind listeners
  duration_seconds INTEGER DEFAULT 0,
  tags TEXT DEFAULT '[]',
  like_count INTEGER DEFAULT 0,
  save_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  play_count INTEGER DEFAULT 0,
  series_id TEXT DEFAULT NULL,
  series_episode INTEGER DEFAULT NULL,
  link_url TEXT DEFAULT '',               -- detected URL in the post body, if any
  link_title TEXT DEFAULT '',             -- fetched page title for the preview card
  link_description TEXT DEFAULT '',       -- fetched page description
  link_image TEXT DEFAULT '',             -- fetched preview image URL
  link_site_name TEXT DEFAULT '',         -- e.g. "YouTube", "Facebook" — read aloud so listeners know where a link goes
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
-- Gifts / stars system — users can send virtual stars to creators
-- as appreciation, similar to TikTok gifts or Facebook stars.
-- Stars are cosmetic for now (no real-money value) but tracked so
-- the creator earnings system can reward top-gifted creators later.
CREATE TABLE IF NOT EXISTS gifts (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id TEXT REFERENCES posts(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL DEFAULT 1,
  message TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gifts_recipient ON gifts(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gifts_post ON gifts(post_id);

-- Direct messages
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  participant_1 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_2 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message TEXT DEFAULT '',
  last_message_at TEXT DEFAULT (datetime('now')),
  unread_1 INTEGER DEFAULT 0,
  unread_2 INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(participant_1, participant_2)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  audio_key TEXT DEFAULT '',
  read_at TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('like','comment','follow','mention','gift','message')),
  post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
  message_preview TEXT DEFAULT '',
  read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conversations_p1 ON conversations(participant_1, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_p2 ON conversations(participant_2, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
