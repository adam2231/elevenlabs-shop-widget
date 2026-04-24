import { useState, useCallback, useRef } from 'react'
import { Conversation } from '@elevenlabs/client'

export default function useElevenLabs() {
  const [isConnected, setIsConnected] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const conversationRef = useRef(null)

  const sendTextMessage = useCallback(async (text) => {
  const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID
  const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentId}/simulate-conversation`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          simulation_specification: {
            simulated_user_config: {
              prompt: text,
              first_message: text
            }
          },
          new_turns_limit: 1
        })
      }
    )

    console.log('ElevenLabs status:', res.status)
    const data = await res.json()
    console.log('ElevenLabs data:', JSON.stringify(data))

    // Extract agent response from simulated_conversation turns
    const turns = data.simulated_conversation || []
    const agentTurn = turns.find(t => t.role === 'agent' || t.role === 'assistant')
    return agentTurn?.message || agentTurn?.content || null

  } catch (err) {
    console.error('ElevenLabs error:', err)
    return null
  }
}, [])

  const startSession = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID
      const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY

      conversationRef.current = await Conversation.startSession({
        agentId,
        authorization: apiKey,
        onConnect: () => setIsConnected(true),
        onDisconnect: () => {
          setIsConnected(false)
          setIsSpeaking(false)
        },
        onAgentSpeaking: () => setIsSpeaking(true),
        onAgentNotSpeaking: () => setIsSpeaking(false),
        onError: (error) => {
          console.error('ElevenLabs error:', error)
          setIsConnected(false)
          setIsSpeaking(false)
        }
      })
    } catch (err) {
      console.error('Failed to start voice session:', err)
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

  return { startSession, stopSession, isConnected, isSpeaking, sendTextMessage }
}