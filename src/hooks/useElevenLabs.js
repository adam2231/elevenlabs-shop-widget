import { useState, useCallback, useRef } from 'react'
import { Conversation } from '@elevenlabs/client'

export default function useElevenLabs() {
  const [isConnected, setIsConnected] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const conversationRef = useRef(null)

  const startSession = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })

      conversationRef.current = await Conversation.startSession({
        agentId: import.meta.env.VITE_ELEVENLABS_AGENT_ID,
        onConnect: () => {
          setIsConnected(true)
        },
        onDisconnect: () => {
          setIsConnected(false)
          setIsSpeaking(false)
        },
        onAgentSpeaking: () => {
          setIsSpeaking(true)
        },
        onAgentNotSpeaking: () => {
          setIsSpeaking(false)
        },
        onError: (error) => {
          console.error('ElevenLabs error:', error)
          setIsConnected(false)
          setIsSpeaking(false)
        }
      })
    } catch (err) {
      console.error('Failed to start session:', err)
    }
  }, [])

  const stopSession = useCallback(async () => {
    if (conversationRef.current) {
      await conversationRef.current.endSession()
      conversationRef.current = null
    }
    setIsConnected(false)
    setIsSpeaking(false)
  }, [])

  return { startSession, stopSession, isConnected, isSpeaking }
}