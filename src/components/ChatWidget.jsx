import { useState, useRef, useEffect, useCallback } from 'react'
import ProductCarousel from './ProductCarousel'
import useElevenLabs from '../hooks/useElevenLabs'

const GREEN = '#86BC25'
const GREEN_DARK = '#6fa020'

/* ─── Waveform bars helper ──────────────────────────────────── */
function WaveBars({ count = 7, color = GREEN, height = 40 }) {
  const delays = [0, 0.12, 0.24, 0.12, 0.08, 0.20, 0.04]
  const heights = [0.35, 0.65, 1, 0.75, 0.55, 0.85, 0.45]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="widget-wave-bar"
          style={{
            width: '3px',
            height: `${heights[i % heights.length] * height}px`,
            background: color,
            borderRadius: '2px',
            animationDelay: `${delays[i % delays.length]}s`,
          }}
        />
      ))}
    </div>
  )
}

/* ─── Typing indicator ───────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
      <div style={avatarStyle(GREEN)}>
        <div style={avatarDot} />
      </div>
      <div style={{
        background: '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: '16px 16px 16px 3px',
        padding: '11px 16px',
        display: 'flex', gap: '5px', alignItems: 'center',
      }}>
        {[0, 0.2, 0.4].map((d, i) => (
          <div
            key={i}
            className="widget-typing-dot"
            style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: '#bbb', animationDelay: `${d}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Shared micro-styles ────────────────────────────────────── */
const avatarStyle = (bg) => ({
  width: '28px', height: '28px', borderRadius: '50%',
  background: bg, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
})
const avatarDot = {
  width: '10px', height: '10px', borderRadius: '50%', background: '#fff',
}

/* ─── SendIcon ───────────────────────────────────────────────── */
function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
    </svg>
  )
}

/* ─── MicIcon ────────────────────────────────────────────────── */
function MicIcon({ color = 'white' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={color}>
      <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v7a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-1 17.93V22h2v-1.07A8 8 0 0 0 20 13h-2a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93z" />
    </svg>
  )
}

/* ─── KeyboardIcon ───────────────────────────────────────────── */
function KeyboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 5H5v-2h2v2zm10 0H7v-2h10v2zm0-3h-2v-2h2v2zm0-3h-2V8h2v2zm3 6h-2v-2h2v2zm0-3h-2v-2h2v2zm0-3h-2V8h2v2z" />
    </svg>
  )
}

/* ─── RefreshIcon ────────────────────────────────────────────── */
function RefreshIcon({ color = '#888' }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}

/* ════════════════════════════════════════════════════════════════
   CHAT WIDGET
════════════════════════════════════════════════════════════════ */
export default function ChatWidget({ embedConfig = { isEmbed: false, agentId: null } }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)
  const modeRef = useRef('text')
  const pendingProductsRef = useRef(null)
  const textareaRef = useRef(null)

  /* ── Embed parent resize ── */
  useEffect(() => {
    if (embedConfig.isEmbed && window.parent !== window) {
      window.parent.postMessage({ type: isOpen ? 'widget-opened' : 'widget-closed' }, '*')
    }
  }, [isOpen, embedConfig.isEmbed])

  /* ── ElevenLabs callbacks ── */
  const handleAgentMessage = useCallback((text) => {
    setIsTyping(false)
    const pending = pendingProductsRef.current
    pendingProductsRef.current = null
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      role: 'agent', text,
      products: pending?.products || [],
    }])
  }, [])

  const handleUserMessage = useCallback((text) => {
    if (modeRef.current !== 'voice') return
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      role: 'user', text, products: [],
    }])
  }, [])

  const handleProductsReceived = useCallback(({ products }) => {
    pendingProductsRef.current = { products }
  }, [])

  const { isConnected, isConnecting, isSpeaking, mode, startSession, endSession, sendUserMessage, sendUserActivity } =
    useElevenLabs({
      agentId: embedConfig.agentId,
      onAgentMessage: handleAgentMessage,
      onUserMessage: handleUserMessage,
      onProductsReceived: handleProductsReceived,
    })

  useEffect(() => { modeRef.current = mode }, [mode])

  /* ── Auto-scroll ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  /* ── Auto-start session ── */
  useEffect(() => {
    startSession({ textOnly: true })
    return () => { endSession() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Reconnect when widget is opened while session is dead ── */
  useEffect(() => {
    if (isOpen && !isConnected && !isConnecting) {
      startSession({ textOnly: mode !== 'voice' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  /* ── Focus and auto-resize textarea when switching to text ── */
  useEffect(() => {
    if (mode === 'text' && isOpen && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus()
        // Reset height for proper calculation
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
      }, 100)
    }
  }, [mode, isOpen])

  /* ── Handlers ── */
  const handleSend = () => {
    if (!input.trim() || !isConnected) return
    const text = input.trim()
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text, products: [] }])
    setInput('')
    setIsTyping(true)
    sendUserMessage(text)
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (e) => { 
    setInput(e.target.value)
    sendUserActivity()
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }

  const toggleVoice = async () => {
    try {
      if (mode === 'voice') {
        // Switching to text mode
        await endSession()
        const result = await startSession({ textOnly: true })
        if (!result.success) {
          console.error('Failed to start text session:', result.error)
        }
      } else {
        // Switching to voice mode
        await endSession()
        const result = await startSession({ textOnly: false })
        if (!result.success) {
          console.error('Failed to start voice session:', result.error)
          // If voice fails (mic permission), fall back to text
          if (result.error?.includes('microphone') || result.error?.includes('Microphone')) {
            alert(result.error)
            await startSession({ textOnly: true })
          }
        }
      }
    } catch (err) {
      console.error('Error toggling voice mode:', err)
      // Attempt recovery by restarting in text mode
      await endSession()
      await startSession({ textOnly: true })
    }
  }

  const handleRestart = async () => {
    setMessages([])
    setIsTyping(false)
    setInput('')
    pendingProductsRef.current = null
    await endSession()
    await startSession({ textOnly: mode === 'text' })
  }

  const handleAddToCart = (product) => {
    const kind = (product?.kind || product?.type || product?.cardType || '').toString().toLowerCase()
    const formatDateTime = (obj) => {
      if (!obj) return ''
      if (typeof obj === 'string') return obj
      const date = obj.date || ''; const time = obj.time || ''
      return (date && time) ? `${date} ${time}` : date || time || ''
    }
    if (kind.includes('flight')) {
      const origin = product?.from?.city || product?.from?.code || 'origin'
      const destination = product?.to?.city || product?.to?.code || 'destination'
      const price = product?.priceText || (product?.cost ?? product?.price)
      const departLabel = formatDateTime(product?.depart || product?.departure)
      const returnLabel = formatDateTime(product?.return || product?.returnFlight)
      const parts = [`I'd like to book the ${origin} → ${destination} option`]
      if (departLabel) parts.push(`Departure: ${departLabel}`)
      if (returnLabel) parts.push(`Return: ${returnLabel}`)
      if (price) parts.push(`Price: ${price}`)
      const text = `${parts.join('. ')}.`
      if (!isConnected) return
      setMessages(prev => [...prev, { id: Date.now(), role: 'user', text, products: [] }])
      setIsTyping(true); sendUserMessage(text); return
    }
    if (kind.includes('luggage') || kind.includes('baggage')) {
      const optionName = product?.name || product?.title || 'luggage option'
      const price = product?.priceText || (product?.price ?? product?.cost)
      const text = `I choose the ${optionName} luggage option${price ? ` (${price})` : ''}.`
      if (!isConnected) return
      setMessages(prev => [...prev, { id: Date.now(), role: 'user', text, products: [] }])
      setIsTyping(true); sendUserMessage(text); return
    }
    console.log('Product added to cart:', product?.name)
  }

  /* ════════════════════════════════════════════════
     LAUNCHER BUTTON — positioned slightly higher and left
  ════════════════════════════════════════════════ */
  const launcherButton = (
    <button
      onClick={() => setIsOpen(prev => !prev)}
      aria-label={isOpen ? 'Close assistant' : 'Open assistant'}
      className="widget-glow-pulse"
      style={{
        position: 'fixed', 
        bottom: '28px',  // Slightly higher (was 24px)
        right: '28px',   // Slightly more left (was 24px)
        width: '68px', height: '68px', borderRadius: '50%',
        background: GREEN, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 999998,
        transition: 'transform 0.2s, background 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      {/* Two concentric ripple rings */}
      <span className="widget-ripple" style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        border: `1.5px solid rgba(134,188,37,0.5)`,
        pointerEvents: 'none',
      }} />
      <span className="widget-ripple-delayed" style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        border: `1.5px solid rgba(134,188,37,0.3)`,
        pointerEvents: 'none',
      }} />
      {/* Waveform inside orb */}
      <WaveBars count={5} color="rgba(255,255,255,0.92)" height={24} />
    </button>
  )

  /* ════════════════════════════════════════════════
     WIDGET PANEL SHELL — positioned to slightly overlap launcher
  ════════════════════════════════════════════════ */
  const panelStyle = {
    position: 'fixed',
    bottom: '108px',  // Slightly higher to create subtle overlap (was 104px)
    right: '28px',    // Aligned with launcher (was 24px)
    width: '520px',
    maxWidth: 'calc(100vw - 32px)',
    height: '700px',
    maxHeight: 'calc(100vh - 128px)',
    borderRadius: '20px',
    border: '1px solid #e5e5e5',
    boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 4px 16px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 999999,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    overflow: 'hidden',
    background: mode === 'voice' ? 'transparent' : '#fff',
  }

  /* ════════════════════════════════════════════════
     HEADER  (always visible, adapts per mode)
  ════════════════════════════════════════════════ */
  const isVoice = mode === 'voice'

  const header = (
    <div style={{
      padding: '13px 16px',
      borderBottom: isVoice ? '1px solid rgba(255,255,255,0.12)' : '1px solid #f0f0f0',
      display: 'flex', alignItems: 'center', gap: '11px',
      background: isVoice ? 'rgba(0,0,0,0.18)' : '#fff',
      backdropFilter: isVoice ? 'blur(12px)' : 'none',
      WebkitBackdropFilter: isVoice ? 'blur(12px)' : 'none',
      flexShrink: 0,
      borderRadius: '20px 20px 0 0',
    }}>
      {/* Logo placeholder — swap src for real logo */}
      <div style={{
        width: '36px', height: '36px', borderRadius: '9px',
        background: isVoice ? 'rgba(255,255,255,0.15)' : `rgba(134,188,37,0.1)`,
        border: isVoice ? '1px solid rgba(255,255,255,0.2)' : `1px solid rgba(134,188,37,0.2)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        {/* Green Dot logo mark */}
        <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: GREEN }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '13px', fontWeight: '600', lineHeight: '1.2',
          color: isVoice ? '#fff' : '#111',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          Green Dot · Style Assistant
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: isConnected ? '#22c55e' : '#d1d5db',
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: '11px',
            color: isVoice ? 'rgba(255,255,255,0.65)' : '#999',
          }}>
            {isConnected
              ? (isVoice ? 'Voice active · Powered by ElevenLabs' : 'Connected · Powered by ElevenLabs')
              : isConnecting
              ? 'Connecting...'
              : 'Reconnecting...'}
          </span>
        </div>
      </div>

      {/* Restart button */}
      <button
        onClick={handleRestart}
        title="Restart conversation"
        style={{
          padding: '5px 10px', borderRadius: '7px',
          background: isVoice ? 'rgba(255,255,255,0.1)' : 'transparent',
          border: isVoice ? '1px solid rgba(255,255,255,0.2)' : '1px solid #e5e5e5',
          color: isVoice ? 'rgba(255,255,255,0.75)' : '#888',
          cursor: 'pointer', fontSize: '11px', fontWeight: '500',
          display: 'flex', alignItems: 'center', gap: '5px',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = isVoice ? 'rgba(255,255,255,0.2)' : '#f5f5f5'
          e.currentTarget.style.color = isVoice ? '#fff' : '#444'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = isVoice ? 'rgba(255,255,255,0.1)' : 'transparent'
          e.currentTarget.style.color = isVoice ? 'rgba(255,255,255,0.75)' : '#888'
        }}
      >
        <RefreshIcon color={isVoice ? 'rgba(255,255,255,0.75)' : '#888'} />
        Restart
      </button>

      {/* Close button */}
      <button
        onClick={() => setIsOpen(false)}
        aria-label="Close"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '18px', lineHeight: 1, padding: '2px 4px',
          color: isVoice ? 'rgba(255,255,255,0.5)' : '#bbb',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = isVoice ? '#fff' : '#555'}
        onMouseLeave={e => e.currentTarget.style.color = isVoice ? 'rgba(255,255,255,0.5)' : '#bbb'}
      >
        ✕
      </button>
    </div>
  )

  /* ════════════════════════════════════════════════
     AUDIO MODE BODY
  ════════════════════════════════════════════════ */
  const audioBody = (
    <div
      className="widget-voice-bg"
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Ambient glow blobs */}
      <div style={{
        position: 'absolute', width: '300px', height: '300px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
        top: '-80px', left: '50%', transform: 'translateX(-50%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Scrolling transcript area with fade-out at top */}
      {/* Transcript gets smaller when products are shown */}
      <div style={{ 
        flex: messages.length > 0 && messages[messages.length - 1].products?.length > 0 ? '0 1 30%' : 1,
        minHeight: messages.length > 0 && messages[messages.length - 1].products?.length > 0 ? '180px' : 'auto',
        position: 'relative',
        overflow: 'hidden',
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 40px, black 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 40px, black 100%)',
        transition: 'flex 0.3s ease, min-height 0.3s ease',
      }}>
        <div 
          className="widget-voice-transcript"
          style={{
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {messages.map(msg => (
            <div 
              key={msg.id} 
              className="widget-msg-enter"
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                animation: 'msgFadeUp 0.3s ease both',
              }}
            >
              <div style={{
                background: msg.role === 'user' ? '#FFFAF0' : '#F0F8F0',
                color: '#111',
                borderRadius: '14px',
                padding: '9px 13px',
                maxWidth: '75%',
                fontSize: '12px',
                lineHeight: '1.5',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
              }}>
                {msg.text}
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                background: '#F0F8F0',
                borderRadius: '14px',
                padding: '11px 16px',
                display: 'flex', gap: '5px', alignItems: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}>
                {[0, 0.2, 0.4].map((d, i) => (
                  <div
                    key={i}
                    className="widget-typing-dot"
                    style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: '#6fa020', animationDelay: `${d}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Product cards OR voice orb - products take priority and more space */}
      {messages.length > 0 && messages[messages.length - 1].products?.length > 0 ? (
        // Product cards mode - takes significant space
        <div style={{
          flex: '0 0 auto',
          padding: '12px 20px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          alignItems: 'center',
          zIndex: 1,
          maxHeight: '65%',
          overflowY: 'auto',
        }}>
          <div style={{ width: '100%', maxWidth: '480px' }}>
            <ProductCarousel
              products={messages[messages.length - 1].products}
              onAddToCart={handleAddToCart}
              glassMode={true}
            />
          </div>

          {/* Status text */}
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', letterSpacing: '1px' }}>
            {isSpeaking ? 'SPEAKING' : 'LISTENING'}
          </div>

          {/* Switch to text button */}
          <button
            onClick={toggleVoice}
            style={{
              padding: '9px 22px', borderRadius: '22px',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.22)',
              color: 'rgba(255,255,255,0.85)', fontSize: '12px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              transition: 'all 0.15s',
              fontWeight: '500',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          >
            <KeyboardIcon />
            Switch to text
          </button>
        </div>
      ) : (
        // Voice orb mode - standard centered layout
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          padding: '20px 24px 24px',
          zIndex: 1,
        }}>
          {/* Central orb */}
          <div
            className="widget-orb-breathe"
            style={{ position: 'relative', width: '95px', height: '95px' }}
          >
            {/* Concentric rings */}
            <div style={{ position: 'absolute', inset: '-18px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ position: 'absolute', inset: '-9px', borderRadius: '50%', background: 'rgba(255,255,255,0.09)' }} />
            {/* Core glass orb */}
            <div style={{
              width: '95px', height: '95px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1.5px solid rgba(255,255,255,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}>
              <WaveBars count={7} color="rgba(255,255,255,0.9)" height={38} />
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', letterSpacing: '1px' }}>
            {isSpeaking ? 'SPEAKING' : 'LISTENING'}
          </div>

          {/* Switch to text button */}
          <button
            onClick={toggleVoice}
            style={{
              padding: '9px 22px', borderRadius: '22px',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.22)',
              color: 'rgba(255,255,255,0.85)', fontSize: '12px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              transition: 'all 0.15s',
              fontWeight: '500',
              marginTop: '4px',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          >
            <KeyboardIcon />
            Switch to text
          </button>
        </div>
      )}
    </div>
  )

  /* ════════════════════════════════════════════════
     TEXT MODE BODY
  ════════════════════════════════════════════════ */
  const textBody = (
    <>
      {/* Messages */}
      <div
        className="widget-messages"
        style={{
          flex: 1, overflowY: 'auto',
          padding: '18px',
          background: '#f7f7f7',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}
      >
        {messages.map(msg => (
          <div key={msg.id} className="widget-msg-enter">
            <div style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: '8px',
              alignItems: 'flex-end',
            }}>
              {msg.role === 'agent' && (
                <div style={avatarStyle(isSpeaking ? '#22c55e' : GREEN)}>
                  <div style={avatarDot} />
                </div>
              )}
              <div style={{
                background: msg.role === 'user' ? '#111' : '#fff',
                color: msg.role === 'user' ? '#fff' : '#111',
                borderRadius: msg.role === 'user' ? '16px 16px 3px 16px' : '16px 16px 16px 3px',
                padding: '10px 14px',
                maxWidth: '76%',
                fontSize: '12.5px',
                lineHeight: '1.6',
                border: msg.role === 'agent' ? '1px solid #e8e8e8' : 'none',
                boxShadow: msg.role === 'agent' ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
                whiteSpace: 'pre-wrap', // Preserve line breaks
                wordWrap: 'break-word',
              }}>
                {msg.text}
              </div>
            </div>
            {msg.products?.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <ProductCarousel
                  products={msg.products}
                  onAddToCart={handleAddToCart}
                  glassMode={false}
                />
              </div>
            )}
          </div>
        ))}

        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div style={{
        padding: '12px 14px',
        borderTop: '1px solid #f0f0f0',
        background: '#fff',
        display: 'flex', alignItems: 'flex-end', gap: '10px',
        flexShrink: 0,
      }}>
        {/* Voice orb — compact, lives in input bar in text mode */}
        <button
          onClick={toggleVoice}
          title="Switch to voice"
          aria-label="Switch to voice"
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: GREEN, border: 'none', cursor: 'pointer',
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s, transform 0.15s',
            boxShadow: '0 2px 8px rgba(134,188,37,0.3)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = GREEN_DARK; e.currentTarget.style.transform = 'scale(1.08)' }}
          onMouseLeave={e => { e.currentTarget.style.background = GREEN; e.currentTarget.style.transform = 'scale(1)' }}
        >
          <MicIcon />
        </button>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="widget-input"
          rows={1}
          style={{
            flex: 1,
            border: '1px solid #e5e5e5',
            borderRadius: '22px',
            padding: '10px 16px',
            fontSize: '12.5px',
            fontFamily: 'inherit',
            background: '#fafafa',
            color: '#111',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            resize: 'none',
            minHeight: '40px',
            maxHeight: '120px',
            lineHeight: '1.5',
            overflow: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        />

        <button
          onClick={handleSend}
          disabled={!input.trim() || !isConnected}
          aria-label="Send"
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: (!input.trim() || !isConnected) ? '#d1d5db' : GREEN,
            border: 'none',
            cursor: (!input.trim() || !isConnected) ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s, transform 0.15s',
          }}
          onMouseEnter={e => { if (input.trim() && isConnected) { e.currentTarget.style.background = GREEN_DARK; e.currentTarget.style.transform = 'scale(1.08)' } }}
          onMouseLeave={e => { e.currentTarget.style.background = (!input.trim() || !isConnected) ? '#d1d5db' : GREEN; e.currentTarget.style.transform = 'scale(1)' }}
        >
          <SendIcon />
        </button>
      </div>
    </>
  )

  /* ════════════════════════════════════════════════
     ASSEMBLE PANEL
  ════════════════════════════════════════════════ */
  const chatPanel = (
    <div style={panelStyle} className="widget-panel-mobile">
      {/* Voice mode bg sits behind everything */}
      {isVoice && (
        <div className="widget-voice-bg" style={{
          position: 'absolute', inset: 0, borderRadius: '20px', zIndex: 0,
        }} />
      )}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {header}
        {isVoice ? audioBody : textBody}
      </div>
    </div>
  )

  /* ════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════ */
  return (
    <>
      {isOpen && chatPanel}
      {launcherButton}
    </>
  )
}
