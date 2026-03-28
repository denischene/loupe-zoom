(() => {
  let active = false;
  let loupe = null;
  let zoomLabel = null;
  let mouseX = 0;
  let mouseY = 0;
  let rafId = null;
  let zoomLabelTimeout = null;
  let capturing = false;

  // Double-buffer: keep current + next screenshot
  let currentImg = null;
  let nextImg = null;

  let zoom = 5;
  const CAPTURE_INTERVAL = 120;
  const MIN_ZOOM = 2;
  const MAX_ZOOM = 15;
  let lastCaptureTime = 0;

  function getDefaultZoom() {
    try {
      const v = parseInt(localStorage.getItem('__loupe_default_zoom'), 10);
      if (v >= MIN_ZOOM && v <= MAX_ZOOM) return v;
    } catch(e) {}
    return 5;
  }

  function getLoupeStyle(z) {
    if (z <= 5) return { w: 180, h: 180, radius: '50%' };
    if (z <= 9) return { w: 400, h: 260, radius: '16px' };
    if (z <= 13) return { w: 520, h: 320, radius: '16px' };
    return { w: 820, h: 400, radius: '16px' };
  }

  function createLoupe() {
    if (loupe) return;
    loupe = document.createElement('div');
    loupe.id = 'loupe-overlay';

    zoomLabel = document.createElement('div');
    zoomLabel.id = 'loupe-zoom-label';
    zoomLabel.style.display = 'none';
    loupe.appendChild(zoomLabel);

    document.body.appendChild(loupe);
  }

  function applyLoupeSize() {
    if (!loupe) return;
    const s = getLoupeStyle(zoom);
    loupe.style.width = s.w + 'px';
    loupe.style.height = s.h + 'px';
    loupe.style.borderRadius = s.radius;
  }

  function showZoomIndicator() {
    if (!zoomLabel) return;
    zoomLabel.textContent = '\u00d7' + zoom;
    zoomLabel.style.display = 'block';
    zoomLabel.style.opacity = '1';
    if (zoomLabelTimeout) clearTimeout(zoomLabelTimeout);
    zoomLabelTimeout = setTimeout(() => {
      zoomLabel.style.opacity = '0';
      setTimeout(() => { zoomLabel.style.display = 'none'; }, 300);
    }, 2000);
  }

  function capture() {
    const now = Date.now();
    if (now - lastCaptureTime < CAPTURE_INTERVAL || capturing) return;
    lastCaptureTime = now;
    capturing = true;

    browser.runtime.sendMessage({ type: 'capture' }).then((dataUrl) => {
      capturing = false;
      if (dataUrl) {
        // Preload image before swapping to avoid flicker
        const img = new Image();
        img.onload = () => {
          currentImg = dataUrl;
          updateLoupe();
        };
        img.src = dataUrl;
      }
    }).catch(() => {
      capturing = false;
    });
  }

  function updateLoupe() {
    if (!active || !loupe || !currentImg) return;

    const s = getLoupeStyle(zoom);
    const halfW = s.w / 2;
    const halfH = s.h / 2;

    loupe.style.left = mouseX + 'px';
    loupe.style.top = mouseY + 'px';
    loupe.style.display = 'block';

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    const bgW = vpW * zoom;
    const bgH = vpH * zoom;

    const bgX = -mouseX * zoom + halfW;
    const bgY = -mouseY * zoom + halfH;

    loupe.style.backgroundImage = `url(${currentImg})`;
    loupe.style.backgroundSize = `${bgW}px ${bgH}px`;
    loupe.style.backgroundPosition = `${bgX}px ${bgY}px`;
  }

  function onMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (active) {
      capture();
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          updateLoupe();
        });
      }
    }
  }

  function adjustZoom(delta) {
    if (!active) return;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    applyLoupeSize();
    updateLoupe();
    showZoomIndicator();
    try { sessionStorage.setItem('__loupe_zoom', String(zoom)); } catch(e) {}
  }

  function activate() {
    active = true;
    createLoupe();
    applyLoupeSize();
    document.body.classList.add('loupe-active');
    capture();
    try { sessionStorage.setItem('__loupe_active', '1'); } catch(e) {}
    try { sessionStorage.setItem('__loupe_zoom', String(zoom)); } catch(e) {}
  }

  function deactivate() {
    active = false;
    document.body.classList.remove('loupe-active');
    if (loupe) {
      loupe.style.display = 'none';
    }
    currentImg = null;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    try { sessionStorage.removeItem('__loupe_active'); } catch(e) {}
    try { sessionStorage.removeItem('__loupe_zoom'); } catch(e) {}
  }

  function toggle() {
    if (active) deactivate();
    else {
      zoom = getDefaultZoom();
      activate();
    }
  }

  function restoreState() {
    try {
      if (sessionStorage.getItem('__loupe_active') === '1') {
        const savedZoom = parseInt(sessionStorage.getItem('__loupe_zoom'), 10);
        if (savedZoom >= MIN_ZOOM && savedZoom <= MAX_ZOOM) zoom = savedZoom;
        activate();
      }
    } catch(e) {}
  }

  // Keyboard: Ctrl+L to toggle, +/- (no Ctrl) to adjust zoom
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      e.stopPropagation();
      toggle();
      return;
    }
    if (active && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        adjustZoom(1);
      } else if (e.key === '-') {
        e.preventDefault();
        adjustZoom(-1);
      }
    }
  }, true);

  // Wheel: only Ctrl+wheel adjusts zoom
  document.addEventListener('wheel', (e) => {
    if (!active || !e.ctrlKey) return;
    e.preventDefault();
    adjustZoom(e.deltaY < 0 ? 1 : -1);
  }, { passive: false, capture: true });

  document.addEventListener('mousemove', onMove);

  document.addEventListener('scroll', () => {
    if (active) {
      capture();
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          updateLoupe();
        });
      }
    }
  }, true);

  // Listen for toolbar button toggle
  browser.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'toggle_loupe') {
      toggle();
    }
    if (msg.type === 'activate_loupe') {
      zoom = msg.zoom || getDefaultZoom();
      activate();
    }
    if (msg.type === 'update_default_zoom') {
      try { localStorage.setItem('__loupe_default_zoom', String(msg.zoom)); } catch(e) {}
    }
  });

  restoreState();
})();
