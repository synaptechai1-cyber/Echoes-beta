# Echoes 🎙️

**The world's first audio-first social media platform — built for the blind, loved by everyone.**

This is the v2 clean rebuild: real R2 audio storage, Clerk authentication, and an immersive swipe-navigable feed designed to coexist with — never override — standard screen reader navigation.

---

## What changed from v1

- **Auth**: Clerk (phone/OTP, free to 50,000 monthly active users) replaces the original HMAC token system
- **Audio storage**: real uploads to Cloudflare R2, replacing temporary browser blob URLs that didn't persist
- **Navigation**: a dedicated immersive feed view with swipe-up/down (next/previous), double-tap (like), and long-press (save) gestures — scoped entirely to the feed so it never conflicts with VoiceOver/TalkBack's own swipe-based navigation elsewhere in the app
- **Visual identity**: rebuilt around the trademarked Echoes logo — deep navy base, electric blue gradient accent, geometric display type
- **Creator payments**: a `creator_earnings` table to track and pay standout writers/narrators

Every swipe gesture has an identical, fully focusable button equivalent rendered alongside it — swipe is an accelerator for people who want it, never the only way to do something.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite (SPA) |
| Hosting | Cloudflare Pages |
| API | Cloudflare Pages Functions (Workers) |
| Database | Cloudflare D1 (SQLite at the edge) |
| Audio storage | Cloudflare R2 (real uploads, public bucket serving) |
| Auth | Clerk (phone/OTP, email, social login) |

---

## Test mode (no R2 required)

If R2 billing isn't activated yet on your Cloudflare account, Echoes still works fully — audio recordings are stored as base64 directly in D1 instead of in R2. Nothing in the UI changes; the Worker auto-detects whether `AUDIO_BUCKET` is bound and falls back automatically.

**Limitations while in test mode:**
- Clips are capped at 5MB (roughly 2–3 minutes of typical voice recording) to keep D1 rows reasonable
- Less efficient than R2 at scale — fine for a small testing cohort, not meant to stay this way long-term
- The feed list response strips raw audio data to stay fast; full audio loads when a post is opened or played

**Switching to R2 later** takes three steps and needs no frontend changes:
1. Activate R2 billing and create the `echoes-audio` bucket (see main setup steps above)
2. Enable Public Access on the bucket and copy its public URL
3. In Cloudflare Pages → Settings → Functions, add the `AUDIO_BUCKET` R2 binding and the `R2_PUBLIC_BASE_URL` environment variable, then redeploy

New posts created after switching will use R2 automatically. Posts created during test mode keep working off their stored D1 audio_data — nothing breaks.

---

## Getting started

### 1. Prerequisites

- Node.js 18+
- A Cloudflare account
- A Clerk account (clerk.com — free)
- Wrangler CLI: `npm install -g wrangler`

### 2. Install

```bash
npm install
```

### 3. Set up Cloudflare resources

```bash
wrangler login
wrangler d1 create echoes-db        # copy the database_id into wrangler.toml
wrangler r2 bucket create echoes-audio
```

**Make the R2 bucket publicly readable** so audio files can be served directly:
in the Cloudflare dashboard, go to R2 → echoes-audio → Settings → Public Access → enable, and copy the public bucket URL into `wrangler.toml` as `R2_PUBLIC_BASE_URL`.

Run the migration:
```bash
npm run db:migrate:remote
```

### 4. Set up Clerk

Create an application at clerk.com. Choose phone number (OTP) as your primary sign-in method — no typed passwords, which is the most accessible option for screen reader users.

Copy your **publishable key** into `.env` (see `.env.example`):
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxx
```

Copy your **Frontend API URL** into `wrangler.toml`'s `CLERK_JWKS_URL`:
```
CLERK_JWKS_URL = "https://your-app-name.clerk.accounts.dev/.well-known/jwks.json"
```

### 5. Run locally

```bash
npm run dev
```

---

## Deploy to Cloudflare Pages

1. Push to GitHub
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
3. Build command: `npm run build`, output directory: `dist`
4. Environment variables: `VITE_CLERK_PUBLISHABLE_KEY`, and confirm `CLERK_JWKS_URL` / `R2_PUBLIC_BASE_URL` are set in `wrangler.toml` or as Pages environment variables
5. Bind your D1 database (`DB`) and R2 bucket (`AUDIO_BUCKET`) under Pages → Settings → Functions
6. Deploy

Every push to `main` redeploys automatically.

---

## Project structure

```
echoes-v2/
├── functions/api/[[route]].js   # All API routes — Clerk JWT verify, R2 upload, D1 queries
├── schema/001_init.sql          # Database schema, incl. creator_earnings
├── src/
│   ├── components/
│   │   ├── NavBar.jsx
│   │   ├── MiniPlayer.jsx
│   │   ├── PostCard.jsx         # used in Profile/Saved (standard tap navigation)
│   │   └── ShareButton.jsx      # Web Share API, text-aware for written stories
│   ├── pages/
│   │   ├── Feed.jsx             # immersive swipe feed — the core experience
│   │   ├── Create.jsx           # real R2 upload on publish
│   │   ├── Profile.jsx
│   │   ├── Saved.jsx
│   │   ├── PostDetail.jsx
│   │   └── Auth.jsx             # Clerk SignIn UI
│   ├── utils/
│   │   ├── api.js
│   │   ├── EchoUserSync.jsx     # bridges Clerk identity to the Echoes user row
│   │   ├── PlayerContext.jsx    # global audio player + feed queue
│   │   └── useSwipeGesture.js   # scoped swipe/tap/hold detection
│   ├── styles/global.css
│   ├── App.jsx
│   └── main.jsx
├── public/logo.png
├── index.html
├── vite.config.js
├── wrangler.toml
└── package.json
```

---

## On the swipe gesture design

Swipe navigation is intentionally confined to the immersive feed view, not applied app-wide. Screen readers (VoiceOver, TalkBack) already own swipe gestures system-wide — swipe right/left moves focus between elements, double-tap activates whatever is focused. If Echoes hijacked swipes everywhere, it would fight that model on every screen: settings, profile, comments.

Inside the feed, there's exactly one piece of content active at a time, so a custom swipe language can layer on top of, rather than compete with, standard screen reader behavior. And critically: every swipe action (next, previous, like, save, share) has an identical button alongside it with a proper `aria-label`. Nobody is ever required to use swipe to get something done.

---

## Roadmap

- [ ] Push notifications (Web Push API)
- [ ] Series / episode system with auto-queue
- [ ] Voice search
- [ ] Discovery/explore page with sound tags
- [ ] Live audio rooms (WebRTC)
- [ ] AI story generation assistant
- [ ] Creator earnings dashboard (payout requests, school program tracking)
- [ ] Mobile app (React Native / Expo)
- [ ] Audio content moderation pipeline

---

## License

MIT
