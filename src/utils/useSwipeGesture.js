import { useRef, useCallback } from 'react'

// Detects vertical swipes (next/previous post) and specific tap patterns
// (double-tap to like, long-press to save) within a single contained
// element — the immersive feed view only.
//
// Why scoped, not global: VoiceOver and TalkBack already own swipe
// gestures system-wide (swipe right/left moves focus between elements,
// double-tap activates the focused element). If Echoes intercepted swipes
// everywhere, it would fight the screen reader's own navigation model on
// every screen. Confining this to the feed — where there is one piece of
// content to interact with, not a list of elements to move between — means
// it adds a fast, addictive interaction layer without overriding standard
// screen reader behavior anywhere else in the app.
//
// IMPORTANT: this hook does not replace standard screen reader semantics
// inside the feed either. Every action it offers (next, previous, like,
// save, share) is also reachable through ordinary focusable buttons with
// proper aria-labels, rendered alongside the immersive view. Swipe is an
// accelerator for people who want it, never the only path to an action.

const SWIPE_THRESHOLD = 60       // px of vertical movement to count as a swipe
const DOUBLE_TAP_WINDOW = 300    // ms between taps to count as a double-tap
const LONG_PRESS_DURATION = 550  // ms of holding to count as a long-press

export function useSwipeGesture({ onNext, onPrevious, onLike, onSave }) {
  const touchStartY = useRef(null)
  const touchStartTime = useRef(null)
  const lastTapTime = useRef(0)
  const longPressTimer = useRef(null)
  const longPressFired = useRef(false)

  const handleTouchStart = useCallback((e) => {
    const touch = e.touches[0]
    touchStartY.current = touch.clientY
    touchStartTime.current = Date.now()
    longPressFired.current = false

    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      onSave?.()
      if (navigator.vibrate) navigator.vibrate(40)
    }, LONG_PRESS_DURATION)
  }, [onSave])

  const handleTouchMove = useCallback((e) => {
    // Any significant movement cancels the long-press timer — a swipe
    // isn't a hold.
    if (touchStartY.current === null) return
    const touch = e.touches[0]
    const delta = Math.abs(touch.clientY - touchStartY.current)
    if (delta > 12 && longPressTimer.current) {
      clearTimeout(longPressTimer.current)
    }
  }, [])

  const handleTouchEnd = useCallback((e) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    if (longPressFired.current) {
      touchStartY.current = null
      return
    }
    if (touchStartY.current === null) return

    const touch = e.changedTouches[0]
    const deltaY = touch.clientY - touchStartY.current
    const elapsed = Date.now() - touchStartTime.current

    // Fast, large vertical movement = swipe, not tap
    if (Math.abs(deltaY) > SWIPE_THRESHOLD && elapsed < 600) {
      if (deltaY < 0) onNext?.()   // swiped up → next post
      else onPrevious?.()          // swiped down → previous post
      touchStartY.current = null
      return
    }

    // Small movement, short duration = a tap. Check for double-tap.
    if (Math.abs(deltaY) < 12 && elapsed < 300) {
      const now = Date.now()
      if (now - lastTapTime.current < DOUBLE_TAP_WINDOW) {
        onLike?.()
        if (navigator.vibrate) navigator.vibrate(25)
        lastTapTime.current = 0
      } else {
        lastTapTime.current = now
      }
    }

    touchStartY.current = null
  }, [onNext, onPrevious, onLike])

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  }
}
