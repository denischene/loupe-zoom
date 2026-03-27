(() => {
  let active = false;
  let loupe = null;
  let mouseX = 0;
  let mouseY = 0;
  let rafId = null;

  const ZOOM = 5;
  const SIZE = 180;

  function createLoupe() {
    if (loupe) return loupe;
    loupe = document.createElement('div');
    loupe.id = 'loupe-overlay';
    document.body.appendChild(loupe);
    return loupe;
  }

  function updateLoupe() {
    if (!active || !loupe) return;

    const halfSize = SIZE / 2;
    const bgSize = ZOOM * 100;

    // Position relative to page scroll
    const pageX = mouseX + window.scrollX;
    const pageY = mouseY + window.scrollY;

    // Background position: center the zoomed area on the cursor
    const bgX = -(pageX * ZOOM - halfSize);
    const bgY = -(pageY * ZOOM - halfSize);

    loupe.style.left = mouseX + 'px';
    loupe.style.top = mouseY + 'px';
    loupe.style.display = 'block';

    // Capture current page as background using element()  — not supported broadly,
    // so we use a canvas-based approach instead
    captureAndRender(bgX, bgY, bgSize);
  }

  let canvas = null;
  function getCanvas() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
    }
    return canvas;
  }

  // Throttled rendering
  let lastRender = 0;
  function captureAndRender(bgX, bgY, bgSize) {
    const now = performance.now();
    if (now - lastRender < 50) {
      // Schedule next frame
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          if (active) updateLoupe();
        });
      }
      return;
    }
    lastRender = now;

    // Use background-image with the page's current computed style
    // For a lightweight approach, we clone a region using CSS zoom trick
    // Actually, the most reliable cross-browser way: use element screenshot or
    // simply scale the page background. We'll use a CSS-based approach:
    // Create an iframe-like clone — but that's heavy.
    
    // Simplest effective approach: use a scaled clone of document.documentElement
    renderWithTransform();
  }

  let cloneContainer = null;

  function renderWithTransform() {
    if (!loupe) return;
    
    const halfSize = SIZE / 2;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    
    // We position a scaled version of the page behind the loupe
    if (!cloneContainer) {
      cloneContainer = document.createElement('div');
      cloneContainer.style.cssText = `
        position: absolute;
        width: ${SIZE}px;
        height: ${SIZE}px;
        overflow: hidden;
        border-radius: 50%;
        pointer-events: none;
        top: 0; left: 0;
      `;
      loupe.appendChild(cloneContainer);
    }

    // Use the page itself as background via CSS transform on a wrapper
    // The trick: render the actual page element scaled inside the loupe
    const originX = mouseX + scrollX;
    const originY = mouseY + scrollY;

    const translateX = -originX * ZOOM + halfSize;
    const translateY = -originY * ZOOM + halfSize;

    cloneContainer.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: ${document.documentElement.scrollWidth}px;
      height: ${document.documentElement.scrollHeight}px;
      transform: scale(${ZOOM});
      transform-origin: 0 0;
      pointer-events: none;
      left: ${translateX}px;
      top: ${translateY}px;
    `;

    // Instead of cloning the entire DOM (expensive), use background-attachment approach
    // Best lightweight method: use the page's own rendering via element() or background
    
    // Final approach: set loupe background to a screenshot using html2canvas-like method
    // For performance, we use CSS background-image pointing to a data URL of the viewport
    
    // Actually, the simplest and most performant: use CSS zoom on the body itself
    // viewed through a circular window. We render body into the loupe via an iframe.

    // PRAGMATIC SOLUTION: Use window screenshot via canvas
    renderViaClone(originX, originY, halfSize);
  }

  function renderViaClone(originX, originY, halfSize) {
    if (!loupe) return;
    
    // Remove previous iframe
    const oldIframe = loupe.querySelector('iframe');
    if (oldIframe) oldIframe.remove;

    // CSS-only approach: replicate the background
    // Set the loupe to show a zoomed portion using background properties on a pseudo-rendered element
    
    // FINAL SIMPLE APPROACH: 
    // Overlay a div that shows the page content scaled via CSS, clipped to circle
    loupe.style.background = 'white';
    
    if (!loupe._inner) {
      const inner = document.createElement('div');
      inner.style.cssText = `
        position: absolute;
        pointer-events: none;
        transform-origin: 0 0;
        top: 0;
        left: 0;
        width: 0;
        height: 0;
      `;
      loupe.appendChild(inner);
      loupe._inner = inner;
    }
  }

  // ---- Better approach: use CSS element() where supported (Firefox!) ----
  // Firefox supports -moz-element() which is perfect here!
  
  function updateLoupeFirefox() {
    if (!active || !loupe) return;

    const halfSize = SIZE / 2;
    const originX = mouseX + window.scrollX;
    const originY = mouseY + window.scrollY;

    loupe.style.left = mouseX + 'px';
    loupe.style.top = mouseY + 'px';
    loupe.style.display = 'block';

    // Firefox supports -moz-element()!
    loupe.style.background = `-moz-element(#loupe-source) no-repeat`;
    loupe.style.backgroundSize = `${document.documentElement.scrollWidth * ZOOM}px ${document.documentElement.scrollHeight * ZOOM}px`;
    loupe.style.backgroundPosition = `${-originX * ZOOM + halfSize}px ${-originY * ZOOM + halfSize}px`;
  }

  function ensureSourceId() {
    if (!document.documentElement.id) {
      document.documentElement.id = 'loupe-source';
    } else if (document.documentElement.id !== 'loupe-source') {
      // Use body instead
      document.body.id = 'loupe-source';
      return 'loupe-source';
    }
    return 'loupe-source';
  }

  function toggle() {
    active = !active;
    createLoupe();
    if (active) {
      ensureSourceId();
      document.body.classList.add('loupe-active');
      updateLoupeFirefox();
    } else {
      document.body.classList.remove('loupe-active');
      loupe.style.display = 'none';
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    }
  }, true);

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (active) {
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          updateLoupeFirefox();
        });
      }
    }
  });

  document.addEventListener('scroll', () => {
    if (active) {
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          updateLoupeFirefox();
        });
      }
    }
  }, true);
})();
