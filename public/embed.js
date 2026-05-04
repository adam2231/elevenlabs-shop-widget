(function() {
  'use strict';
  
  const scriptTag = document.currentScript || document.querySelector('script[src*="embed.js"]');
  if (!scriptTag) {
    console.error('ElevenLabs Widget: Could not find embed script tag');
    return;
  }

  const agentId = scriptTag.getAttribute('data-agent-id');
  const position = scriptTag.getAttribute('data-position') || 'bottom-right';

  if (!agentId) {
    console.error('ElevenLabs Widget: data-agent-id attribute is required');
    return;
  }

  const WIDGET_BASE_URL = scriptTag.src.replace('/embed.js', '');

  function initWidget() {
    const container = document.createElement('div');
    container.id = 'elevenlabs-widget-container';
    container.style.cssText = `
      position: fixed;
      ${position.includes('bottom') ? 'bottom' : 'top'}: 0;
      ${position.includes('right') ? 'right' : 'left'}: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2147483647;
      border: none;
      margin: 0;
      padding: 0;
    `;

    const iframe = document.createElement('iframe');
    iframe.id = 'elevenlabs-widget-frame';
    iframe.src = `${WIDGET_BASE_URL}/?embed=true&agentId=${encodeURIComponent(agentId)}`;
    iframe.style.cssText = `
      position: absolute;
      width: 100%;
      height: 100%;
      border: none;
      background: transparent;
      pointer-events: auto;
    `;
    iframe.allow = 'microphone';
    iframe.title = 'ElevenLabs Shopping Assistant';

    container.appendChild(iframe);
    document.body.appendChild(container);

    window.addEventListener('message', function(event) {
      if (event.origin !== new URL(WIDGET_BASE_URL).origin) return;

      const data = event.data;
      
      if (data.type === 'widget-opened') {
        container.style.pointerEvents = 'auto';
      } else if (data.type === 'widget-closed') {
        container.style.pointerEvents = 'none';
      }
    });

    console.log('ElevenLabs Widget loaded successfully with agent:', agentId);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
})();