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
    
    const container = document.createElement('div');
    container.id = 'elevenlabs-widget-container';
    
    // FIXED: Container should only contain the iframe, not cover full screen
    container.style.cssText = `
      position: fixed;
      ${position.includes('bottom') ? 'bottom' : 'top'}: 0;
      ${position.includes('right') ? 'right' : 'left'}: 0;
      z-index: 2147483647;
      pointer-events: none;
    `;

    const iframe = document.createElement('iframe');
    iframe.id = 'elevenlabs-widget-frame';
    iframe.src = `${WIDGET_BASE_URL}/?embed=true&agentId=${encodeURIComponent(agentId)}`;
    
    // FIXED: Iframe should be small initially, widget will handle its own display
    iframe.style.cssText = `
      position: fixed;
      bottom: 0;
      right: 0;
      width: 100vw;
      height: 100vh;
      max-width: 100%;
      max-height: 100%;
      border: none;
      background: transparent;
      pointer-events: auto;
    `;
    
    iframe.allow = 'microphone';
    iframe.title = 'ElevenLabs Shopping Assistant';

    container.appendChild(iframe);
    document.body.appendChild(container);

    // Listen for messages from iframe to control pointer events
    window.addEventListener('message', function(event) {
      if (event.origin !== new URL(WIDGET_BASE_URL).origin) return;

      const data = event.data;
      
      if (data.type === 'widget-opened') {
        console.log('🟢 Widget opened');
        container.style.pointerEvents = 'auto';
      } else if (data.type === 'widget-closed') {
        console.log('🟢 Widget closed');
        container.style.pointerEvents = 'none';
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