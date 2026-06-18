import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ClerkProvider, SignedIn, SignedOut, useUser } from '@clerk/clerk-react'
import { PlayerProvider } from './utils/PlayerContext.jsx'
import { EchoUserSync } from './utils/EchoUserSync.jsx'
import NavBar from './components/NavBar.jsx'
import MiniPlayer from './components/MiniPlayer.jsx'
import Feed from './pages/Feed.jsx'
import Profile from './pages/Profile.jsx'
import Saved from './pages/Saved.jsx'
import Create from './pages/Create.jsx'
import Auth from './pages/Auth.jsx'
import PostDetail from './pages/PostDetail.jsx'

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

function AppRoutes() {
  const { isLoaded } = useUser()

  if (!isLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh' }}>
        <div className="spinner" role="status" aria-label="Loading Echoes">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <main id="main" className="main-content">
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/create" element={<Create />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <MiniPlayer />
      <NavBar />
    </div>
  )
}

export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <BrowserRouter>
        <PlayerProvider>
          <SignedIn>
            <EchoUserSync>
              <AppRoutes />
            </EchoUserSync>
          </SignedIn>
          <SignedOut>
            <Auth />
          </SignedOut>
        </PlayerProvider>
      </BrowserRouter>
    </ClerkProvider>
  )
}
