(() => {
  let active = false;
  let loupe = null;
  let zoomLabel = null;
  let mouseX = 0;
  let mouseY = 0;
  let rafId = null;
  let zoomLabelTimeout = null;
  let capturing = false;
  let currentImg = null;

  let zoom = 5;
  const CAPTURE_INTERVAL = 80;
  const MIN_ZOOM = 2;
  const MAX_ZOOM = 15;
  let lastCaptureTime = 0;

  // Focus tracking
  let focusMode = false;
  let focusTarget = null;
  let focusScrollTimer = null;
  let focusInactivityTimer = null;
  let focusScrollOffset = 0;
  let focusScrollDirection = 1;
  let focusScrollRaf = null;

  function getDefaultZoom() {
    try {
      const v = parseInt(localStorage.getItem('__loupe_default_zoom'), 10);
      if (v >= MIN_ZOOM && v <= MAX_ZOOM) return v;
    } catch(e) {}
    return 5;
  }

  function getLoupeStyle(z, isFocus) {
    if (isFocus) {
      if (z <= 4) return { w: 320, h: 180, radius: '16px' };
      if (z <= 9) return { w: 400, h: 260, radius: '16px' };
      if (z <= 12) return { w: 520, h: 320, radius: '16px' };
      return { w: 820, h: 400, radius: '16px' };
    }
    if (z <= 4) return { w: 180, h: 180, radius: '50%' };
    if (z <= 9) return { w: 400, h: 260, radius: '16px' };
    if (z <= 12) return { w: 520, h: 320, radius: '16px' };
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
    const s = getLoupeStyle(zoom, focusMode);
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

  function capture(cb) {
    const now = Date.now();
    if (now - lastCaptureTime < CAPTURE_INTERVAL || capturing) return;
    lastCaptureTime = now;
    capturing = true;

    // Hide loupe before capturing to avoid recursive zoom
    if (loupe) loupe.style.visibility = 'hidden';

    browser.runtime.sendMessage({ type: 'capture' }).then((dataUrl) => {
      capturing = false;
      if (loupe) loupe.style.visibility = 'visible';
      if (dataUrl) {
        const img = new Image();
        img.onload = () => {
          currentImg = dataUrl;
          if (cb) cb();
          else updateLoupe();
        };
        img.src = dataUrl;
      }
    }).catch(() => {
      capturing = false;
      if (loupe) loupe.style.visibility = 'visible';
    });
  }

  function updateLoupe() {
    if (!active || !loupe || !currentImg) return;

    const s = getLoupeStyle(zoom, focusMode);
    const halfW = s.w / 2;
    const halfH = s.h / 2;

    const posX = focusMode ? focusX : mouseX;
    const posY = focusMode ? focusY : mouseY;

    loupe.style.left = posX + 'px';
    loupe.style.top = posY + 'px';
    loupe.style.display = 'block';

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    const bgW = vpW * zoom;
    const bgH = vpH * zoom;

    const bgX = -posX * zoom + halfW - (focusMode ? focusScrollOffset * zoom : 0);
    const bgY = -posY * zoom + halfH;

    loupe.style.backgroundImage = `url(${currentImg})`;
    loupe.style.backgroundSize = `${bgW}px ${bgH}px`;
    loupe.style.backgroundPosition = `${bgX}px ${bgY}px`;
  }

  function onMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (active && !focusMode) {
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
    focusMode = false;
    clearFocusTimers();
    document.body.classList.remove('loupe-active');
    if (loupe) loupe.style.display = 'none';
    currentImg = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
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

  // === FOCUS TRACKING ===
  let focusX = 0;
  let focusY = 0;

  function clearFocusTimers() {
    if (focusScrollTimer) { clearInterval(focusScrollTimer); focusScrollTimer = null; }
    if (focusInactivityTimer) { clearTimeout(focusInactivityTimer); focusInactivityTimer = null; }
    if (focusScrollRaf) { cancelAnimationFrame(focusScrollRaf); focusScrollRaf = null; }
    focusScrollOffset = 0;
  }

  function startFocusOnElement(el) {
    if (!active) return;
    clearFocusTimers();
    focusMode = true;
    focusTarget = el;
    focusScrollOffset = 0;

    const rect = el.getBoundingClientRect();
    focusX = rect.left + rect.width / 2;
    focusY = rect.top + rect.height / 2;

    applyLoupeSize();
    capture(() => {
      updateLoupe();
      // Check if element is wider than loupe view
      const s = getLoupeStyle(zoom, true);
      const visibleWidth = s.w / zoom;
      if (rect.width > visibleWidth) {
        startFocusAutoScroll(rect, visibleWidth);
      } else {
        startFocusInactivityTimer();
      }
    });
  }

  function startFocusAutoScroll(rect, visibleWidth) {
    const maxScroll = rect.width - visibleWidth;
    const scrollSpeed = 0.5; // px per frame
    focusScrollOffset = 0;
    focusScrollDirection = 1;

    function scrollStep() {
      focusScrollOffset += scrollSpeed * focusScrollDirection;
      if (focusScrollOffset >= maxScroll) {
        focusScrollOffset = maxScroll;
        focusScrollDirection = 0; // stop
        // Capture and update one last time then start inactivity
        capture(() => {
          updateLoupe();
          startFocusInactivityTimer();
        });
        return;
      }
      // Re-capture periodically during scroll
      capture(() => updateLoupe());
      updateLoupe();
      focusScrollRaf = requestAnimationFrame(scrollStep);
    }
    focusScrollRaf = requestAnimationFrame(scrollStep);
  }

  function startFocusInactivityTimer() {
    if (focusInactivityTimer) clearTimeout(focusInactivityTimer);
    focusInactivityTimer = setTimeout(() => {
      // Auto dezoom: exit focus mode
      focusMode = false;
      focusTarget = null;
      clearFocusTimers();
      if (loupe) loupe.style.display = 'none';
    }, 5000);
  }

  function onFocusChange(e) {
    if (!active) return;
    const el = e.target;
    if (!el || el === document || el === document.body) return;
    // Check if element is activatable
    const tag = el.tagName;
    const isActivatable = tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' ||
      tag === 'SELECT' || tag === 'TEXTAREA' || el.hasAttribute('tabindex') ||
      el.hasAttribute('onclick') || el.getAttribute('role') === 'button' ||
      el.getAttribute('role') === 'link' || el.getAttribute('role') === 'checkbox' ||
      el.getAttribute('role') === 'menuitem';

    if (isActivatable || el.closest('a, button')) {
      startFocusOnElement(el);
    }
  }

  document.addEventListener('focusin', onFocusChange, true);

  // When mouse moves, exit focus mode
  document.addEventListener('mousemove', (e) => {
    if (focusMode && active) {
      focusMode = false;
      clearFocusTimers();
      applyLoupeSize();
    }
  }, true);

  // === KEYBOARD ===
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
    if (active && !focusMode) {
      capture();
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          updateLoupe();
        });
      }
    }
  }, true);

  // Listen for toolbar button toggle and commands
  browser.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'toggle_loupe') {
      toggle();
    }
    if (msg.type === 'update_default_zoom') {
      try { localStorage.setItem('__loupe_default_zoom', String(msg.zoom)); } catch(e) {}
    }
  });

  restoreState();
})();
