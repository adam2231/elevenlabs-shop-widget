(function() {
  'use strict';
  
  console.log('🟢 ElevenLabs embed.js executing...');
  
  const scriptTag = document.currentScript || document.querySelector('script[src*="embed.js"]');
  if (!scriptTag) {
    console.error('❌ ElevenLabs Widget: Could not find embed script tag');
    return;
  }

  const agentId = scriptTag.getAttribute('data-agent-id');
  const position = scriptTag.getAttribute('data-position') || 'bottom-right';

  if (!agentId) {
    console.error('❌ ElevenLabs Widget: data-agent-id attribute is required');
    return;
  }

  const WIDGET_BASE_URL = scriptTag.src.replace('/embed.js', '');

  function initWidget() {
    console.log('🟢 Initializing widget with agent:', agentId);

    const iframe = document.createElement('iframe');
    iframe.id = 'elevenlabs-widget-frame';
    iframe.src = `${WIDGET_BASE_URL}/?embed=true&agentId=${encodeURIComponent(agentId)}`;
    
    // Start SMALL — just enough for the launcher button (bottom-right corner)
    iframe.style.cssText = `
      position: fixed;
      bottom: 0;
      right: 0;
      width: 100px;
      height: 100px;
      border: none;
      background: transparent;
      z-index: 2147483647;
      pointer-events: auto;
    `;
    
    iframe.allow = 'microphone';
    iframe.title = 'ElevenLabs Shopping Assistant';

    document.body.appendChild(iframe);

    // Listen for messages from iframe to resize
    window.addEventListener('message', function(event) {
      try {
        if (event.origin !== new URL(WIDGET_BASE_URL).origin) return;
      } catch(e) {
        return;
      }

      const data = event.data;
      
      if (data.type === 'widget-opened') {
        console.log('🟢 Widget opened — expanding iframe');
        iframe.style.width = '100vw';
        iframe.style.height = '100vh';
        iframe.style.maxWidth = '100%';
        iframe.style.maxHeight = '100%';
      } else if (data.type === 'widget-closed') {
        console.log('🟢 Widget closed — shrinking iframe');
        iframe.style.width = '100px';
        iframe.style.height = '100px';
        iframe.style.maxWidth = '';
        iframe.style.maxHeight = '';
      }
    });

    console.log('✅ ElevenLabs Widget loaded successfully');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();