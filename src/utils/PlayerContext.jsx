import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react'

const PlayerContext = createContext(null)

export function PlayerProvider({ children }) {
  const [currentPost, setCurrentPost] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef(null)

  // Feed queue support — lets the immersive swipe feed move forward/back
  // through posts without each PostCard needing its own playback logic.
  const [queue, setQueue] = useState([])
  const [queueIndex, setQueueIndex] = useState(0)

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio

    audio.addEventListener('timeupdate', () => setProgress(audio.currentTime))
    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration))
    audio.addEventListener('ended', () => {
      setPlaying(false)
      setProgress(0)
    })
    audio.addEventListener('play', () => setPlaying(true))
    audio.addEventListener('pause', () => setPlaying(false))

    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [])

  function play(post) {
    const audio = audioRef.current
    if (!audio) return

    if (currentPost?.id === post.id) {
      if (playing) {
        audio.pause()
      } else if (audio.src) {
        audio.play().catch(() => {})
      } else {
        window.speechSynthesis.resume()
      }
      return
    }

    window.speechSynthesis.cancel()
    audio.pause()
    setCurrentPost(post)
    setProgress(0)
    setDuration(0)

    if (post.audio_url) {
      audio.src = post.audio_url
      audio.play().catch(() => {})
    } else if (post.body) {
      audio.src = ''
      const utterance = new SpeechSynthesisUtterance(post.title + '. ' + post.body)
      utterance.rate = 0.95
      utterance.pitch = 1
      window.speechSynthesis.speak(utterance)
      setPlaying(true)
      utterance.onend = () => setPlaying(false)
    }
  }

  function pause() {
    audioRef.current?.pause()
    window.speechSynthesis.pause()
  }

  function resume() {
    if (audioRef.current?.src) {
      audioRef.current.play().catch(() => {})
    } else {
      window.speechSynthesis.resume()
    }
  }

  function seek(seconds) {
    if (audioRef.current?.src) {
      audioRef.current.currentTime = seconds
    }
  }

  function stop() {
    audioRef.current?.pause()
    window.speechSynthesis.cancel()
    setCurrentPost(null)
    setPlaying(false)
    setProgress(0)
  }

  // Loads a list of posts as the active feed queue and starts playing
  // from a given index — used when entering the immersive swipe feed.
  const setFeedQueue = useCallback((posts, startIndex = 0) => {
    setQueue(posts)
    setQueueIndex(startIndex)
    if (posts[startIndex]) play(posts[startIndex])
  }, [])

  const next = useCallback(() => {
    setQueueIndex(i => {
      const nextIndex = Math.min(i + 1, queue.length - 1)
      if (queue[nextIndex]) play(queue[nextIndex])
      return nextIndex
    })
  }, [queue])

  const previous = useCallback(() => {
    setQueueIndex(i => {
      const prevIndex = Math.max(i - 1, 0)
      if (queue[prevIndex]) play(queue[prevIndex])
      return prevIndex
    })
  }, [queue])

  return (
    <PlayerContext.Provider value={{
      currentPost, playing, progress, duration,
      play, pause, resume, seek, stop,
      queue, queueIndex, setFeedQueue, next, previous,
    }}>
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  return useContext(PlayerContext)
}
