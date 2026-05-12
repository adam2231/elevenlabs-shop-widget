import { useState, useRef, useEffect, useCallback } from 'react'
import ProductCarousel from './ProductCarousel'
import useElevenLabs from '../hooks/useElevenLabs'

const DELOITTE_GREEN = '#86BC25'

export default function ChatWidget({ embedConfig = { isEmbed: false, agentId: null } }) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef(null)
  const modeRef = useRef('text')

  const pendingProductsRef = useRef(null)

  // Notify parent window (for embed mode) when widget opens/closes
  useEffect(() => {
    if (embedConfig.isEmbed && window.parent !== window) {
      window.parent.postMessage(
        { type: isOpen ? 'widget-opened' : 'widget-closed' },
        '*'
      )
    }
  }, [isOpen, embedConfig.isEmbed])

  const handleAgentMessage = useCallback((text) => {
    setIsTyping(false)
    const pending = pendingProductsRef.current
    pendingProductsRef.current = null

    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      role: 'agent',
      text,
      products: pending?.products || [],
    }])
  }, [])

  const handleUserMessage = useCallback((text) => {
    if (modeRef.current !== 'voice') return
    setMessages(prev => [...prev, {
      id: Date.now() + Math.random(),
      role: 'user',
      text,
      products: [],
    }])
  }, [])

  const handleProductsReceived = useCallback(({ products }) => {
    pendingProductsRef.current = { products }
  }, [])

  const {
    isConnected,
    isConnecting,
    isSpeaking,
    micError,
    mode,
    startSession,
    endSession,
    sendUserMessage,
    sendUserActivity,
  } = useElevenLabs({
    agentId: embedConfig.agentId,
    onAgentMessage: handleAgentMessage,
    onUserMessage: handleUserMessage,
    onProductsReceived: handleProductsReceived,
  })

  useEffect(() => { modeRef.current = mode }, [mode])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    startSession({ textOnly: true })
    return () => { endSession() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Restart handler ──
  const handleRestart = async () => {
    setMessages([])
    setInput('')
    setIsTyping(false)
    await endSession()
    await startSession({ textOnly: true })
  }

  const handleSend = () => {
    if (!input.trim() || !isConnected) return
    const text = input.trim()
    setMessages(prev => [...prev, {
      id: Date.now(),
      role: 'user',
      text,
      products: [],
    }])
    setInput('')
    setIsTyping(true)
    sendUserMessage(text)
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
  }

  // ── Voice toggle with graceful fallback ──
  const toggleVoice = async () => {
    if (mode === 'voice') {
      // Switch back to text — end voice session, start text session
      await endSession()
      await startSession({ textOnly: true })
    } else {
      // Switch to voice — end text session, try voice
      await endSession()
      const result = await startSession({ textOnly: false })
      
      if (!result.success) {
        // Voice failed (mic error) — restart text session so user isn't left disconnected
        console.warn('Voice mode failed, falling back to text:', result.error)
        await startSession({ textOnly: true })
      }
    }
  }

  const handleAddToCart = (product) => {
    console.log('Product added to cart:', product.name)
  }

  // ── Connection status text ──
  const getStatusText = () => {
    if (isConnecting) return 'Connecting...'
    if (!isConnected) return 'Disconnected'
    if (mode === 'voice') return 'Voice mode · Powered by ElevenLabs'
    return 'Text mode · Powered by ElevenLabs'
  }

  const getStatusColor = () => {
    if (isConnecting) return '#f59e0b' // amber
    if (isConnected) return '#22c55e'   // green
    return '#d1d5db'                     // grey
  }

  // ── Chat panel ──
  const chatPanel = (
    <div style={{
      position: 'fixed', 
      bottom: '90px', 
      right: '24px',
      width: '520px', 
      maxWidth: 'calc(100vw - 32px)',
      height: '700px', 
      maxHeight: 'calc(100vh - 120px)',
      background: '#fff', 
      borderRadius: '16px',
      border: '1px solid #e5e7eb',
      boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      display: 'flex', 
      flexDirection: 'column',
      zIndex: 999999,
      fontFamily: 'system-ui, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', 
        borderBottom: '1px solid #f0f0f0',
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        background: '#fff', 
        flexShrink: 0
      }}>
        <div style={{
          width: '40px', 
          height: '40px', 
          borderRadius: '50%',
          background: DELOITTE_GREEN,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center'
        }}>
          <div style={{ 
            width: '16px', 
            height: '16px', 
            borderRadius: '50%', 
            background: '#fff' 
          }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: '15px', 
            fontWeight: '600', 
            color: '#111' 
          }}>
            Green Dot · Style Assistant
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: '#888',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <div style={{
              width: '6px', 
              height: '6px', 
              borderRadius: '50%',
              background: getStatusColor(),
              flexShrink: 0
            }} />
            {getStatusText()}
          </div>
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px' 
        }}>
          <button 
            onClick={handleRestart}
            title="Restart conversation"
            style={{
              background: 'none', 
              border: '1px solid #e5e7eb', 
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px', 
              color: '#666',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
            onMouseLeave={(e) => e.target.style.background = 'none'}
          >
            ↻ Restart
          </button>
          <button 
            onClick={() => setIsOpen(false)} 
            style={{
              background: 'none', 
              border: 'none', 
              cursor: 'pointer',
              fontSize: '20px', 
              color: '#888', 
              lineHeight: 1,
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Mic error banner */}
      {micError && (
        <div style={{
          padding: '10px 20px',
          background: '#fef2f2',
          borderBottom: '1px solid #fecaca',
          fontSize: '12px',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0
        }}>
          <span>⚠</span>
          <span style={{ flex: 1 }}>{micError}</span>
          <button 
            onClick={() => toggleVoice()}
            style={{
              background: 'none',
              border: '1px solid #fecaca',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '11px',
              color: '#dc2626',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Messages */}
      <div style={{
        flex: 1, 
        overflowY: 'auto', 
        padding: '20px',
        display: 'flex', 
        flexDirection: 'column', 
        gap: '16px'
      }}>
        {messages.map(msg => (
          <div key={msg.id}>
            <div style={{ 
              display: 'flex', 
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', 
              gap: '10px' 
            }}>
              {msg.role === 'agent' && (
                <div style={{
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%',
                  background: isSpeaking ? '#22c55e' : DELOITTE_GREEN,
                  flexShrink: 0, 
                  marginTop: '2px',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  transition: 'background 0.3s'
                }}>
                  <div style={{ 
                    width: '12px', 
                    height: '12px', 
                    borderRadius: '50%', 
                    background: '#fff' 
                  }} />
                </div>
              )}
              <div style={{
                background: msg.role === 'user' ? '#111' : '#f5f5f5',
                color: msg.role === 'user' ? '#fff' : '#111',
                borderRadius: msg.role === 'user' ? '18px 6px 18px 18px' : '6px 18px 18px 18px',
                padding: '12px 16px', 
                maxWidth: '75%',
                fontSize: '14px', 
                lineHeight: '1.5'
              }}>
                {msg.text}
              </div>
            </div>
            {msg.products && msg.products.length > 0 && (
              <ProductCarousel
                products={msg.products}
                onAddToCart={handleAddToCart}
              />
            )}
          </div>
        ))}
        {isTyping && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{
              width: '32px', 
              height: '32px', 
              borderRadius: '50%',
              background: DELOITTE_GREEN, 
              flexShrink: 0,
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center'
            }}>
              <div style={{ 
                width: '12px', 
                height: '12px', 
                borderRadius: '50%', 
                background: '#fff' 
              }} />
            </div>
            <div style={{
              background: '#f5f5f5', 
              borderRadius: '6px 18px 18px 18px',
              padding: '12px 16px', 
              fontSize: '14px', 
              color: '#888'
            }}>
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div style={{
        padding: '16px', 
        borderTop: '1px solid #f0f0f0',
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px',
        background: '#fff', 
        flexShrink: 0
      }}>
        <button 
          onClick={toggleVoice} 
          disabled={isConnecting}
          title={mode === 'voice' ? 'Switch to text' : 'Switch to voice'} 
          style={{
            width: '42px', 
            height: '42px', 
            borderRadius: '50%',
            background: mode === 'voice' ? DELOITTE_GREEN : '#111',
            border: 'none', 
            cursor: isConnecting ? 'wait' : 'pointer', 
            flexShrink: 0,
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            transition: 'background 0.2s',
            opacity: isConnecting ? 0.6 : 1
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v7a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-1 17.93V22h2v-1.07A8 8 0 0 0 20 13h-2a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93z" />
          </svg>
        </button>
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={mode === 'voice' ? 'Voice mode active — speak or tap mic to switch' : 'Type a message...'}
          disabled={mode === 'voice'}
          style={{
            flex: 1, 
            border: '1px solid #e5e7eb', 
            borderRadius: '22px',
            padding: '11px 16px', 
            fontSize: '14px', 
            outline: 'none',
            fontFamily: 'inherit',
            background: mode === 'voice' ? '#f0f0f0' : '#fafafa',
            color: mode === 'voice' ? '#888' : '#111'
          }}
        />
        <button
          onClick={handleSend}
          disabled={mode === 'voice' || !input.trim() || !isConnected}
          style={{
            width: '42px', 
            height: '42px', 
            borderRadius: '50%',
            background: DELOITTE_GREEN, 
            border: 'none',
            cursor: (mode === 'voice' || !input.trim()) ? 'not-allowed' : 'pointer',
            opacity: (mode === 'voice' || !input.trim()) ? 0.5 : 1,
            flexShrink: 0, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  )

  const launcherButton = (
    <button 
      onClick={() => setIsOpen(prev => !prev)} 
      style={{
        position: 'fixed', 
        bottom: '24px', 
        right: '24px',
        width: '64px', 
        height: '64px', 
        borderRadius: '50%',
        background: DELOITTE_GREEN, 
        border: 'none', 
        cursor: 'pointer',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        zIndex: 999998,
        transition: 'transform 0.2s',
      }}
    >
      <div style={{ 
        width: '26px', 
        height: '26px', 
        borderRadius: '50%', 
        background: '#fff' 
      }} />
    </button>
  )

  return (
    <>
      {isOpen && chatPanel}
      {launcherButton}
    </>
  )
}
