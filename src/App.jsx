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
      // Make everything transparent so the host page shows through
      document.documentElement.style.background = 'transparent'
      document.body.style.background = 'transparent'
      const root = document.getElementById('root')
      if (root) root.style.background = 'transparent'
    } else {
      setEmbedConfig({ isEmbed: false, agentId: null })
    }
  }, [])

  if (embedConfig === null) return null

  return <ChatWidget embedConfig={embedConfig} />
}
