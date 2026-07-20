import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../utils/api.js'
import { useEchoUser } from '../utils/EchoUserSync.jsx'

export default function Conversation() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { echoUser } = useEchoUser() || {}
  const [messages, setMessages] = useState([])
  const [conversation, setConversation] = useState(null)
  const [otherUser, setOtherUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [listening, setListening] = useState(false)
  const bottomRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getMessages(id)
        setMessages(data.messages)
        setConversation(data.conversation)
        // Figure out who the other user is
        if (data.conversation && echoUser) {
          const otherId = data.conversation.participant_1 === echoUser.id
            ? data.conversation.participant_2
            : data.conversation.participant_1
          // Get their info from first message or fall back
          const otherMsg = data.messages.find(m => m.sender_id !== echoUser.id)
          if (otherMsg) setOtherUser({ username: otherMsg.username, display_name: otherMsg.display_name })
        }
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [id, echoUser])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Poll for new messages every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await api.getMessages(id)
        setMessages(data.messages)
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [id])

  async function handleSend(e) {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    try {
      const data = await api.sendMessage(id, body.trim())
      setMessages(prev => [...prev, data.message])
      setBody('')
    } catch {}
    finally { setSending(false) }
  }

  function startVoiceInput() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    if (listening) { recognitionRef.current?.stop(); return }
    const r = new SR()
    r.lang = 'en-ZA'
    r.onresult = e => setBody(p => (p + ' ' + Array.from(e.results).map(r => r[0].transcript).join(' ')).trim())
    r.onerror = () => setListening(false)
    r.onend = () => setListening(false)
    recognitionRef.current = r
    setListening(true)
    r.start()
  }

  function formatTime(dateStr) {
    return new Date(dateStr + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
      <div className="spinner" role="status" aria-label="Loading conversation">
        <span></span><span></span><span></span><span></span><span></span>
      </div>
    </div>
  )

  const otherName = otherUser?.display_name || otherUser?.username || 'User'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - var(--nav-height))', maxWidth: 640, margin: '0 auto' }}>

      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
        background: 'var(--bg2)', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <button onClick={() => navigate('/messages')} aria-label="Back to messages"
          style={{ color: 'var(--text-2)', fontSize: 20 }}>←</button>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'var(--blue-soft)', border: '1px solid var(--blue)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, color: 'var(--blue-bright)', fontFamily: 'var(--font-display)',
        }} aria-hidden="true">
          {otherName[0]?.toUpperCase()}
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>{otherName}</div>
          {otherUser?.username && (
            <button onClick={() => navigate(`/profile/${otherUser.username}`)}
              style={{ fontSize: 12, color: 'var(--text-3)' }}>
              @{otherUser.username}
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div
        role="log"
        aria-label={`Conversation with ${otherName}`}
        aria-live="polite"
        style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px 0', fontSize: 14 }}>
            Start the conversation — say hello!
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === echoUser?.id
          return (
            <div key={msg.id}
              style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}
              aria-label={`${isMe ? 'You' : msg.display_name || msg.username}: ${msg.body}. ${formatTime(msg.created_at)}`}
            >
              <div style={{
                maxWidth: '75%', padding: '10px 14px',
                background: isMe ? 'var(--blue)' : 'var(--surface)',
                border: isMe ? 'none' : '1px solid var(--border)',
                borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                color: isMe ? '#fff' : 'var(--text)',
              }}>
                <p style={{ fontSize: 15, lineHeight: 1.5, margin: 0 }}>{msg.body}</p>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4, textAlign: isMe ? 'right' : 'left' }}>
                  {formatTime(msg.created_at)}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend}
        style={{ padding: '12px 16px', background: 'var(--bg2)', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}
        aria-label="Send a message"
      >
        <button type="button" onClick={startVoiceInput}
          aria-label={listening ? 'Stop voice input' : 'Dictate message by voice'}
          aria-pressed={listening}
          style={{ width: 44, height: 44, borderRadius: '50%', background: listening ? 'var(--coral)' : 'var(--bg3)', color: listening ? '#fff' : 'var(--text-2)', fontSize: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)' }}>
          🎤
        </button>
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={`Message ${otherName}…`}
          style={{ flex: 1, padding: '12px 16px', background: 'var(--surface)', border: `1px solid ${listening ? 'var(--coral)' : 'var(--border)'}`, borderRadius: 'var(--radius-full)', color: 'var(--text)', fontSize: 15 }}
          aria-label="Type your message"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) } }}
        />
        <button type="submit" disabled={sending || !body.trim()}
          aria-label="Send message"
          style={{ width: 44, height: 44, borderRadius: '50%', background: (sending || !body.trim()) ? 'var(--bg3)' : 'var(--blue)', color: '#fff', fontSize: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: (sending || !body.trim()) ? 0.5 : 1 }}>
          ↑
        </button>
      </form>
    </div>
  )
}
