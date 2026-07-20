import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api.js'

const CONTENT_TYPES = [
  { id: 'moment',     label: 'Moment',        icon: '💬', desc: "What's on your mind?" },
  { id: 'audio',      label: 'Audio story',   icon: '🎙️', desc: 'Record your voice' },
  { id: 'written',    label: 'Written story', icon: '📖', desc: 'Type a story' },
  { id: 'voice_note', label: 'Voice note',    icon: '🗣️', desc: 'Quick thought' },
  { id: 'video',      label: 'Video',         icon: '🎬', desc: 'Upload a video clip' },
]

const SUGGESTED_TAGS = [
  'anime recap', 'horror story', 'romance', 'comedy', 'poetry',
  'life update', 'chill vibes', 'thriller', 'sci-fi', 'motivation',
]

export default function Create() {
  const [type, setType] = useState('moment')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audioDescription, setAudioDescription] = useState('') // for video: voice description for blind users
  const [tags, setTags] = useState([])
  const [recording, setRecording] = useState(false)
  const [mediaBlob, setMediaBlob] = useState(null)      // holds audio OR video file
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState('')
  const [mediaIsVideo, setMediaIsVideo] = useState(false)
  const [duration, setDuration] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [listening, setListening] = useState(false)
  const [voiceTarget, setVoiceTarget] = useState('body')

  const mediaRef = useRef(null)
  const startTimeRef = useRef(null)
  const timerRef = useRef(null)
  const recognitionRef = useRef(null)
  const navigate = useNavigate()

  const isMoment = type === 'moment'
  const isAudio = type === 'audio' || type === 'voice_note'
  const isVideo = type === 'video'
  const isWritten = type === 'written'

  // ── Audio recording ──────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks = []
      recorder.ondataavailable = e => chunks.push(e.data)
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        setMediaBlob(blob)
        setMediaPreviewUrl(URL.createObjectURL(blob))
        setMediaIsVideo(false)
        setDuration(Math.round(elapsed))
        stream.getTracks().forEach(t => t.stop())
      }
      mediaRef.current = recorder
      recorder.start()
      setRecording(true)
      startTimeRef.current = Date.now()
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 500)
    } catch {
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

  // ── File upload from device (audio or video) ──────────────────────
  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const isVid = file.type.startsWith('video/')
    const isAud = file.type.startsWith('audio/')

    if (!isVid && !isAud) {
      setError('Please select an audio or video file.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('File too large — maximum 50MB.')
      return
    }

    setMediaBlob(file)
    setMediaPreviewUrl(URL.createObjectURL(file))
    setMediaIsVideo(isVid)
    setDuration(0)
    setError('')
  }

  // ── Voice-to-text ─────────────────────────────────────────────────
  function startVoiceInput(target = 'body') {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setError('Voice-to-text not supported on this browser. Try Chrome.'); return }
    if (listening) { recognitionRef.current?.stop(); return }
    const r = new SR()
    r.continuous = true
    r.interimResults = false
    r.lang = 'en-ZA'
    recognitionRef.current = r
    setVoiceTarget(target)
    setListening(true)
    r.onresult = e => {
      const t = Array.from(e.results).map(r => r[0].transcript).join(' ').trim()
      if (target === 'title') setTitle(p => (p + ' ' + t).trim())
      else if (target === 'desc') setAudioDescription(p => (p + ' ' + t).trim())
      else setBody(p => (p + ' ' + t).trim())
    }
    r.onerror = () => setListening(false)
    r.onend = () => setListening(false)
    r.start()
  }

  function formatTime(s) { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}` }

  function previewText() {
    if (!body) return
    const u = new SpeechSynthesisUtterance((title ? title + '. ' : '') + body)
    u.rate = 0.95
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
    setPreview(true)
    u.onend = () => setPreview(false)
  }

  function toggleTag(tag) {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  // ── Submit ────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    if (isMoment && !body.trim()) { setError("What's on your mind? Write something."); return }
    if (!isMoment && !isVideo && !title.trim()) { setError('Please add a title.'); return }
    if (isAudio && !mediaBlob) { setError('Please record or upload your audio first.'); return }
    if (isVideo && !mediaBlob) { setError('Please select a video file first.'); return }
    if (isWritten && !body.trim()) { setError('Please write your story.'); return }

    setSubmitting(true)
    setError('')

    try {
      let audioFields = {}
      if (mediaBlob) {
        setUploadProgress(mediaIsVideo ? 'Uploading video…' : 'Uploading audio…')
        const result = await api.uploadAudio(mediaBlob) // endpoint handles both audio and video
        audioFields = result.mode === 'r2'
          ? { audio_key: result.key }
          : { audio_data: result.audio_data, audio_mime: result.audio_mime }
      }

      setUploadProgress('Publishing…')
      await api.createPost({
        type,
        title: isMoment ? '' : title.trim(),
        content: body.trim(),
        audio_description: audioDescription.trim(), // for video posts
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

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 16px' }}>
      <header style={{ padding: '24px 0 20px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700 }}>
          {isMoment ? "What's on your mind?" : 'Create a post'}
        </h1>
      </header>

      <form onSubmit={handleSubmit} noValidate aria-label="Create a new post">

        {/* Type selector */}
        <fieldset style={{ border: 'none', marginBottom: 24 }}>
          <legend style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', marginBottom: 12, textTransform: 'uppercase' }}>
            Post type
          </legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {CONTENT_TYPES.map(ct => (
              <label key={ct.id} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '10px 4px',
                background: type === ct.id ? 'var(--blue-soft)' : 'var(--surface)',
                border: `1px solid ${type === ct.id ? 'var(--blue)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'center',
              }}>
                <input type="radio" name="type" value={ct.id} checked={type === ct.id}
                  onChange={() => { setType(ct.id); setMediaBlob(null); setMediaPreviewUrl(''); setMediaIsVideo(false); setTitle(''); setBody(''); setAudioDescription('') }}
                  className="sr-only" />
                <span style={{ fontSize: 18 }} aria-hidden="true">{ct.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: type === ct.id ? 'var(--blue-bright)' : 'var(--text)', lineHeight: 1.2 }}>{ct.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Moment — no title, just text */}
        {isMoment && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
              <button type="button" onClick={() => startVoiceInput('body')} aria-pressed={listening && voiceTarget === 'body'}
                style={{ fontSize: 12, color: (listening && voiceTarget === 'body') ? 'var(--coral)' : 'var(--text-3)', fontWeight: 500 }}>
                {(listening && voiceTarget === 'body') ? '🔴 Listening…' : '🎤 Dictate'}
              </button>
            </div>
            <textarea id="moment_body" value={body} onChange={e => setBody(e.target.value)}
              placeholder="Share a thought, a feeling, a link, anything…" rows={5} maxLength={500} autoFocus
              style={{ width: '100%', padding: '16px', background: 'var(--surface)', border: `1px solid ${listening ? 'var(--coral)' : 'var(--border)'}`, borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 16, lineHeight: 1.6, resize: 'none' }} />
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, textAlign: 'right' }}>{body.length} / 500</div>
          </div>
        )}

        {/* Title — for non-moment types */}
        {!isMoment && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label htmlFor="title" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Title</label>
              <button type="button" onClick={() => startVoiceInput('title')} aria-pressed={listening && voiceTarget === 'title'}
                style={{ fontSize: 12, color: (listening && voiceTarget === 'title') ? 'var(--coral)' : 'var(--text-3)', fontWeight: 500 }}>
                {(listening && voiceTarget === 'title') ? '🔴 Listening…' : '🎤 Dictate title'}
              </button>
            </div>
            <input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Give your post a title…" maxLength={120}
              style={{ width: '100%', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 16, fontFamily: 'var(--font-display)', fontWeight: 600 }} />
          </div>
        )}

        {/* Audio recording + file upload */}
        {isAudio && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Audio</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              {recording && <div aria-live="assertive" style={{ fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--coral)' }}>⏺ {formatTime(elapsed)}</div>}
              {mediaPreviewUrl && !recording && !mediaIsVideo && (
                <audio controls src={mediaPreviewUrl} aria-label="Your recording preview" style={{ width: '100%', borderRadius: 8 }} />
              )}
              <button type="button" onClick={recording ? stopRecording : startRecording}
                aria-label={recording ? `Stop recording. Time: ${formatTime(elapsed)}` : 'Start recording'}
                style={{ width: 72, height: 72, borderRadius: '50%', background: recording ? 'var(--coral)' : 'var(--blue)', color: '#fff', fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: recording ? '0 0 0 8px rgba(255,107,91,0.2)' : '0 0 0 8px var(--blue-glow)' }}>
                {recording ? '⏹' : '🎙️'}
              </button>
              <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{recording ? 'Tap to stop' : mediaPreviewUrl ? 'Tap to re-record' : 'Tap to start recording'}</p>
              <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <p style={{ fontSize: 12, color: 'var(--text-3)' }}>Or upload a saved audio file</p>
                <label htmlFor="audio_upload" style={{ padding: '10px 24px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span aria-hidden="true">📁</span> Choose audio file
                </label>
                <input id="audio_upload" type="file" accept="audio/*" onChange={handleFileUpload} className="sr-only" />
              </div>
            </div>
          </div>
        )}

        {/* Video upload */}
        {isVideo && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Video</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              {mediaPreviewUrl && mediaIsVideo && (
                <video controls src={mediaPreviewUrl} aria-label="Your video preview"
                  style={{ width: '100%', maxHeight: 280, borderRadius: 8, background: '#000' }} />
              )}
              <label htmlFor="video_upload" style={{
                padding: '16px 32px', background: mediaPreviewUrl ? 'var(--bg3)' : 'var(--blue)',
                border: `1px solid ${mediaPreviewUrl ? 'var(--border)' : 'var(--blue)'}`,
                borderRadius: 'var(--radius-sm)', fontSize: 15, fontWeight: 700,
                color: mediaPreviewUrl ? 'var(--text-2)' : '#fff',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
              }} aria-label="Choose a video file from your device">
                <span aria-hidden="true">🎬</span> {mediaPreviewUrl ? 'Choose a different video' : 'Choose video file'}
              </label>
              <input id="video_upload" type="file" accept="video/*" onChange={handleFileUpload} className="sr-only" />
              <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
                Maximum 50MB · MP4, MOV, WebM supported
              </p>

              {/* Audio description — the core principle for video on Echoes */}
              <div style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label htmlFor="audio_desc" style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue-bright)' }}>
                    🎙️ Voice description for blind listeners
                  </label>
                  <button type="button" onClick={() => startVoiceInput('desc')} aria-pressed={listening && voiceTarget === 'desc'}
                    style={{ fontSize: 12, color: (listening && voiceTarget === 'desc') ? 'var(--coral)' : 'var(--text-3)', fontWeight: 500 }}>
                    {(listening && voiceTarget === 'desc') ? '🔴 Listening…' : '🎤 Dictate'}
                  </button>
                </div>
                <textarea id="audio_desc" value={audioDescription} onChange={e => setAudioDescription(e.target.value)}
                  placeholder="Describe what's in your video so blind listeners can enjoy it too. This is what makes Echoes special — add a voice description so blind listeners can enjoy this too…"
                  rows={4}
                  style={{ width: '100%', padding: '12px 14px', background: 'var(--bg3)', border: '1px solid var(--blue)', borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 14, lineHeight: 1.6, resize: 'none' }} />
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                  Optional but encouraged — this is the heart of Echoes
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Written story */}
        {isWritten && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
              <label htmlFor="body" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Your story</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => startVoiceInput('body')} aria-pressed={listening && voiceTarget === 'body'}
                  style={{ fontSize: 12, color: (listening && voiceTarget === 'body') ? 'var(--coral)' : 'var(--text-3)', fontWeight: 500 }}>
                  {(listening && voiceTarget === 'body') ? '🔴 Listening…' : '🎤 Dictate'}
                </button>
                <button type="button" onClick={previewText} disabled={!body}
                  style={{ fontSize: 12, color: preview ? 'var(--amber)' : 'var(--blue-bright)', fontWeight: 500 }}>
                  {preview ? '🔊 Playing…' : '🔊 Preview'}
                </button>
              </div>
            </div>
            <textarea id="body" value={body} onChange={e => setBody(e.target.value)}
              placeholder="Write your story, or tap Dictate to speak it…" rows={8}
              style={{ width: '100%', padding: '14px 16px', background: 'var(--surface)', border: `1px solid ${listening && voiceTarget === 'body' ? 'var(--coral)' : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', color: 'var(--text)', fontSize: 15, lineHeight: 1.7, resize: 'vertical' }} />
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, textAlign: 'right' }}>
              {body.length} chars · ~{Math.ceil(body.split(' ').filter(Boolean).length / 150)} min read
            </div>
          </div>
        )}

        {/* Tags */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Tags <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional, up to 5)</span>
          </div>
          <div role="group" aria-label="Select tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUGGESTED_TAGS.map(tag => {
              const active = tags.includes(tag)
              return (
                <button key={tag} type="button" onClick={() => toggleTag(tag)} aria-pressed={active}
                  disabled={!active && tags.length >= 5}
                  style={{ padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: 13, fontWeight: 500, background: active ? 'var(--blue)' : 'var(--surface)', color: active ? '#fff' : 'var(--text-2)', border: `1px solid ${active ? 'var(--blue)' : 'var(--border)'}`, opacity: (!active && tags.length >= 5) ? 0.4 : 1 }}>
                  {tag}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <div role="alert" style={{ padding: 14, background: 'var(--coral-soft)', border: '1px solid var(--coral)', borderRadius: 'var(--radius-sm)', color: 'var(--coral)', fontSize: 14, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting}
          style={{ width: '100%', padding: '16px', background: 'var(--blue)', color: '#fff', borderRadius: 'var(--radius)', fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', opacity: submitting ? 0.6 : 1, marginBottom: 32 }}>
          {submitting ? (uploadProgress || 'Publishing…') : isMoment ? 'Share moment' : isVideo ? 'Upload video' : 'Publish to Echoes'}
        </button>
      </form>
    </div>
  )
}
