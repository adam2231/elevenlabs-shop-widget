import { useState, useCallback, useRef } from 'react';
import { ElevenLabsClient } from '@elevenlabs/client';

export default function useElevenLabs() {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const clientRef = useRef(null);
  const sessionRef = useRef(null);

  const startSession = useCallback(async () => {
    try {
      if (!clientRef.current) {
        clientRef.current = new ElevenLabsClient({
          apiKey: import.meta.env.VITE_ELEVENLABS_API_KEY,
        });
      }

      const agentId = import.meta.env.VITE_ELEVENLABS_AGENT_ID;
      if (!agentId) {
        console.error('VITE_ELEVENLABS_AGENT_ID not found in environment variables');
        return;
      }

      // Start a new conversation session
      sessionRef.current = await clientRef.current.conversationalAI.startSession({
        agentId: agentId,
      });

      setIsConnected(true);
      setIsSpeaking(false);

      // Set up event listeners for the session
      sessionRef.current.on('message', (message) => {
        console.log('Received message:', message);
      });

      sessionRef.current.on('speaking_started', () => {
        setIsSpeaking(true);
      });

      sessionRef.current.on('speaking_stopped', () => {
        setIsSpeaking(false);
      });

      sessionRef.current.on('error', (error) => {
        console.error('Session error:', error);
        setIsConnected(false);
        setIsSpeaking(false);
      });

    } catch (error) {
      console.error('Failed to start ElevenLabs session:', error);
      setIsConnected(false);
      setIsSpeaking(false);
    }
  }, []);

  const stopSession = useCallback(() => {
    try {
      if (sessionRef.current) {
        sessionRef.current.disconnect();
        sessionRef.current = null;
      }
      setIsConnected(false);
      setIsSpeaking(false);
    } catch (error) {
      console.error('Failed to stop ElevenLabs session:', error);
    }
  }, []);

  return {
    startSession,
    stopSession,
    isConnected,
    isSpeaking,
  };
}
