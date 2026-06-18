import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api.js'

const CONTENT_TYPES = [
  { id: 'audio', label: 'Audio story', icon: '🎙️', desc: 'Record your voice' },
  { id: 'written', label: 'Written story', icon: '📖', desc: 'Type and we\'ll speak it' },
  { id: 'voice_note', label: 'Voice note', icon: '🗣️', desc: 'Quick thought or update' },
]

const SUGGESTED_TAGS = [
  'anime recap', 'horror story', 'romance', 'comedy', 'poetry',
  'life update', 'chill vibes', 'thriller', 'sci-fi', 'motivation',
]

export default function Create() {
  const [type, setType] = useState('written')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState([])
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('')
  const [duration, setDuration] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)

  const mediaRef = useRef(null)
  const startTimeRef = useRef(null)
  const timerRef = useRef(null)
  const [elapsed, setElapsed] = useState(0)
  const navigate = useNavigate()

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks = []

      recorder.ondataavailable = e => chunks.push(e.data)
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioPreviewUrl(URL.createObjectURL(blob)) // local preview only — not what gets saved
        setDuration(Math.round(elapsed))
        stream.getTracks().forEach(t => t.stop())
      }

      mediaRef.current = recorder
      recorder.start()
      setRecording(true)
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 500)
    } catch (err) {
      setError('Microphone access denied. Please allow microphone in your browser settings.')
    }
  }

  function stopRecording() {
    if (mediaRef.current) {
      mediaRef.current.stop()
      setRecording(false)
      clearInterval(timerRef.current)
    }
  }

  function formatTime(s) {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  }

  function toggleTag(tag) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) { setError('Please add a title.'); return }
    if (type !== 'written' && !audioBlob) { setError('Please record your audio first.'); return }
    if (type === 'written' && !body.trim()) { setError('Please write your story.'); return }

    setSubmitting(true)
    setError('')

    try {
      let audioFields = {}
      if (audioBlob) {
        setUploadProgress('Uploading your recording…')
        const result = await api.uploadAudio(audioBlob)
        // Server tells us which storage mode it used — pass through whichever
        // fields it gave us. Works the same either way from this point on.
        audioFields = result.mode === 'r2'
          ? { audio_key: result.key }
          : { audio_data: result.audio_data, audio_mime: result.audio_mime }
      }

      setUploadProgress('Publishing…')
      await api.createPost({
        type,
        title: title.trim(),
        content: body.trim(),
        ...audioFields,
        duration_seconds: duration,
        tags,
      })
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
      setUploadProgress('')
    }
  }

  function previewText() {
    if (!body) return
    const utterance = new SpeechSynthesisUtterance(title + '. ' + body)
    utterance.rate = 0.95
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setPreview(true)
    utterance.onend = () => setPreview(false)
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px' }}>
      <header style={{ padding: '24px 0 20px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>Create a post</h1>
        <p style={{ color: 'var(--text-2)', fontSize: 14, marginTop: 4 }}>Your voice, your story, the world listening.</p>
      </header>

      <form onSubmit={handleSubmit} noValidate aria-label="Create a new post">

        <fieldset style={{ border: 'none', marginBottom: 24 }}>
          <legend style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', marginBottom: 12, textTransform: 'uppercase' }}>
            Content type
          </legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {CONTENT_TYPES.map(ct => (
              <label key={ct.id} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 10px',
                background: type === ct.id ? 'var(--blue-soft)' : 'var(--surface)',
                border: `1px solid ${type === ct.id ? 'var(--blue)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'center',
              }}>
                <input type="radio" name="type" value={ct.id} checked={type === ct.id} onChange={() => setType(ct.id)} className="sr-only" />
                <span style={{ fontSize: 24 }} aria-hidden="true">{ct.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: type === ct.id ? 'var(--blue-bright)' : 'var(--text)' }}>{ct.label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{ct.desc}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div style={{ marginBottom: 20 }}>
          <label htmlFor="title" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Title
          </label>
          <input
            id="title" type="text" value={title} onChange={e => setTitle(e.target.value)}
            placeholder="Give your post a title…" maxLength={120}
            style={{ width: '100%', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 600 }}
          />
        </div>

        {(type === 'audio' || type === 'voice_note') && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recording</div>
            <div style={{
              fontSize: 12, color: 'var(--text-3)', background: 'var(--bg3)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              padding: '8px 12px', marginBottom: 12,
            }}>
              Test mode: recordings are stored short-term for this testing round. Keep clips under about 2 minutes for best results.
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              {recording && (
                <div aria-live="assertive" style={{ fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--coral)' }}>
                  ⏺ {formatTime(elapsed)}
                </div>
              )}
              {audioPreviewUrl && !recording && (
                <audio controls src={audioPreviewUrl} aria-label="Your recording preview" style={{ width: '100%', borderRadius: 8 }} />
              )}
              <button
                type="button" onClick={recording ? stopRecording : startRecording}
                aria-label={recording ? `Stop recording. Recording time: ${formatTime(elapsed)}` : 'Start recording'}
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: recording ? 'var(--coral)' : 'var(--blue)', color: '#fff', fontSize: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: recording ? '0 0 0 8px rgba(255,107,91,0.2)' : '0 0 0 8px var(--blue-glow)',
                }}
              >
                {recording ? '⏹' : '🎙️'}
              </button>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                {recording ? 'Tap to stop recording' : audioPreviewUrl ? 'Tap to re-record' : 'Tap to start recording'}
              </p>
            </div>
          </div>
        )}

        {type === 'written' && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label htmlFor="body" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your story</label>
              <button type="button" onClick={previewText} disabled={!body} aria-label="Preview how this will sound when read aloud"
                style={{ fontSize: 12, color: preview ? 'var(--amber)' : 'var(--blue-bright)', fontWeight: 500 }}>
                {preview ? '🔊 Playing…' : '🔊 Preview voice'}
              </button>
            </div>
            <textarea
              id="body" value={body} onChange={e => setBody(e.target.value)}
              placeholder="Write your story here. We'll read it aloud with a natural voice…" rows={8}
              style={{ width: '100%', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 15, lineHeight: 1.7, resize: 'vertical' }}
            />
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, textAlign: 'right' }}>
              {body.length} characters · approx. {Math.ceil(body.split(' ').length / 150)} min read
            </div>
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Tags <span style={{ fontWeight: 400, textTransform: 'none' }}>(choose up to 5)</span>
          </div>
          <div role="group" aria-label="Select tags for your post" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUGGESTED_TAGS.map(tag => {
              const active = tags.includes(tag)
              return (
                <button key={tag} type="button" onClick={() => toggleTag(tag)} aria-pressed={active} disabled={!active && tags.length >= 5}
                  style={{
                    padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 500,
                    background: active ? 'var(--blue)' : 'var(--surface)', color: active ? '#fff' : 'var(--text-2)',
                    border: `1px solid ${active ? 'var(--blue)' : 'var(--border)'}`,
                    opacity: (!active && tags.length >= 5) ? 0.4 : 1,
                  }}>
                  {tag}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div role="alert" style={{ padding: 14, background: 'rgba(255,107,91,0.1)', border: '1px solid rgba(255,107,91,0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--coral)', fontSize: 14, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button
          type="submit" disabled={submitting}
          aria-label={submitting ? (uploadProgress || 'Publishing your post…') : 'Publish post'}
          style={{
            width: '100%', padding: '16px', background: 'var(--blue)', color: '#fff',
            borderRadius: 'var(--radius)', fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)',
            opacity: submitting ? 0.6 : 1, marginBottom: 32,
          }}
        >
          {submitting ? (uploadProgress || 'Publishing…') : 'Publish to Echoes'}
        </button>
      </form>
    </div>
  )
}
