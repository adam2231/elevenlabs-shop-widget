import { useEffect, useState } from 'react'
import ChatWidget from './components/ChatWidget'

export default function App() {
  const [embedConfig, setEmbedConfig] = useState(null)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const isEmbed = urlParams.get('embed') === 'true'
    const agentId = urlParams.get('agentId')

    if (isEmbed && agentId) {
      setEmbedConfig({ isEmbed: true, agentId })
    } else {
      setEmbedConfig({ isEmbed: false, agentId: null })
    }
  }, [])

  if (embedConfig === null) return null

  return <ChatWidget embedConfig={embedConfig} />
}