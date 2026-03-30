(() => {
  // === STATE MACHINE ===
  // 'off' | 'pending' | 'active_mouse' | 'active_focus'
  let state = 'off';

  let loupe = null;
  let zoomLabel = null;
  let pendingIndicator = null;
  let mouseX = 0, mouseY = 0;
  let rafId = null;
  let zoomLabelTimeout = null;
  let currentImg = null;

  let zoom = 5;
  const MIN_ZOOM = 2;
  const MAX_ZOOM = 15;
  let captureInFlight = false;
  let mouseMoveTimer = null;
  let slowCaptureInterval = null;
  const SLOW_CAPTURE_MS = 5000;

  // Focus tracking
  let focusTarget = null;
  let focusInactivityTimer = null;
  let focusScrollOffset = 0;
  let focusScrollDirection = 1;
  let focusScrollRaf = null;
  let focusX = 0, focusY = 0;
  let focusLoupeOverride = null;

  // === HELPERS ===

  function getDefaultZoom() {
    try {
      const v = parseInt(localStorage.getItem('__loupe_default_zoom'), 10);
      if (v >= MIN_ZOOM && v <= MAX_ZOOM) return v;
    } catch (e) {}
    return 5;
  }

  function getLoupeStyle(z, isFocus) {
    if (isFocus && focusLoupeOverride) {
      return { w: focusLoupeOverride.w, h: focusLoupeOverride.h, radius: '16px' };
    }
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

  // === LOUPE DOM ===

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
    const isFocus = state === 'active_focus';
    const s = getLoupeStyle(zoom, isFocus);
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

  // === PENDING INDICATOR ===

  function createPendingIndicator() {
    if (pendingIndicator) return;
    pendingIndicator = document.createElement('div');
    pendingIndicator.id = 'loupe-pending-icon';
    pendingIndicator.innerHTML = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<circle cx="8" cy="8" r="5.5" stroke="#333" stroke-width="1.8" fill="rgba(255,255,255,0.85)"/>' +
      '<line x1="12.5" y1="12.5" x2="17" y2="17" stroke="#333" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="5.5" y1="8" x2="10.5" y2="8" stroke="#333" stroke-width="1.3"/>' +
      '<line x1="8" y1="5.5" x2="8" y2="10.5" stroke="#333" stroke-width="1.3"/>' +
      '</svg>';
    pendingIndicator.style.display = 'none';
    document.body.appendChild(pendingIndicator);
  }

  function showPendingIndicator(el) {
    if (!el || el === document.body || el === document) { hidePendingIndicator(); return; }
    if (!pendingIndicator) createPendingIndicator();
    const rect = el.getBoundingClientRect();
    pendingIndicator.style.display = 'block';
    pendingIndicator.style.left = (rect.left + rect.width / 2) + 'px';
    pendingIndicator.style.top = Math.max(0, rect.top - 26) + 'px';
  }

  function hidePendingIndicator() {
    if (pendingIndicator) pendingIndicator.style.display = 'none';
  }

  // === CAPTURE (smart: on-demand + slow periodic) ===

  function doCapture(cb) {
    if (captureInFlight || (state !== 'active_mouse' && state !== 'active_focus')) return;
    captureInFlight = true;

    if (loupe) loupe.style.visibility = 'hidden';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const p = browser.runtime.sendMessage({ type: 'capture' });
        // Restore immediately — old image stays until new one loads
        if (loupe) loupe.style.visibility = 'visible';

        p.then((dataUrl) => {
          captureInFlight = false;
          if (dataUrl) {
            const img = new Image();
            img.onload = () => {
              currentImg = dataUrl;
              updateLoupe();
              if (cb) cb();
            };
            img.onerror = () => {};
            img.src = dataUrl;
          }
        }).catch(() => {
          captureInFlight = false;
        });
      });
    });
  }

  function startSlowCapture() {
    stopSlowCapture();
    slowCaptureInterval = setInterval(() => {
      if (state === 'active_mouse' || state === 'active_focus') doCapture();
    }, SLOW_CAPTURE_MS);
  }

  function stopSlowCapture() {
    if (slowCaptureInterval) { clearInterval(slowCaptureInterval); slowCaptureInterval = null; }
  }

  // === RENDER ===

  function updateLoupe() {
    if ((state !== 'active_mouse' && state !== 'active_focus') || !loupe || !currentImg) return;

    const isFocus = state === 'active_focus';
    const s = getLoupeStyle(zoom, isFocus);
    const halfW = s.w / 2;
    const halfH = s.h / 2;

    const posX = isFocus ? focusX : mouseX;
    const posY = isFocus ? focusY : mouseY;

    // Clamp to viewport bounds (always for focus, also for mouse)
    let loupeLeft = posX;
    let loupeTop = posY;
    if (isFocus) {
      loupeLeft = Math.max(halfW, Math.min(window.innerWidth - halfW, loupeLeft));
      loupeTop = Math.max(halfH, Math.min(window.innerHeight - halfH, loupeTop));
    }

    loupe.style.left = loupeLeft + 'px';
    loupe.style.top = loupeTop + 'px';
    loupe.style.display = 'block';

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    const bgW = vpW * zoom;
    const bgH = vpH * zoom;
    const bgX = -posX * zoom + halfW - (isFocus ? focusScrollOffset * zoom : 0);
    const bgY = -posY * zoom + halfH;

    loupe.style.backgroundImage = 'url(' + currentImg + ')';
    loupe.style.backgroundSize = bgW + 'px ' + bgH + 'px';
    loupe.style.backgroundPosition = bgX + 'px ' + bgY + 'px';
  }

  function scheduleUpdate() {
    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateLoupe();
      });
    }
  }

  // === MOUSE ===

  function onMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (state === 'active_focus') {
      // Mouse moved while in focus mode → switch to mouse mode
      clearFocusTimers();
      state = 'active_mouse';
      focusLoupeOverride = null;
      applyLoupeSize();
      doCapture();
      startSlowCapture();
    }

    if (state === 'active_mouse') {
      scheduleUpdate();
      // Capture after mouse stops moving
      if (mouseMoveTimer) clearTimeout(mouseMoveTimer);
      mouseMoveTimer = setTimeout(() => { doCapture(); }, 200);
    }
  }

  function adjustZoom(delta) {
    if (state === 'off' || state === 'pending') return;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    applyLoupeSize();
    doCapture(() => { updateLoupe(); });
    showZoomIndicator();
    try { sessionStorage.setItem('__loupe_zoom', String(zoom)); } catch (e) {}
  }

  // === STATE TRANSITIONS ===

  function notifyBackground(isOn) {
    try {
      browser.runtime.sendMessage({ type: isOn ? 'loupe_active' : 'loupe_off' }).catch(() => {});
    } catch (e) {}
  }

  function enterActiveMouseMode() {
    state = 'active_mouse';
    createLoupe();
    applyLoupeSize();
    document.body.classList.remove('loupe-pending');
    document.body.classList.add('loupe-active');
    hidePendingIndicator();
    if (!currentImg) {
      // First capture
      doCapture();
    }
    startSlowCapture();
    notifyBackground(true);
    persistState();
  }

  function enterActiveFocusMode(el) {
    state = 'active_focus';
    focusTarget = el || document.activeElement;
    createLoupe();
    document.body.classList.remove('loupe-pending');
    document.body.classList.add('loupe-active');
    hidePendingIndicator();
    if (focusTarget) startFocusOnElement(focusTarget);
    notifyBackground(true);
    persistState();
  }

  function enterPendingMode() {
    state = 'pending';
    clearFocusTimers();
    stopSlowCapture();
    if (mouseMoveTimer) { clearTimeout(mouseMoveTimer); mouseMoveTimer = null; }
    document.body.classList.remove('loupe-active');
    document.body.classList.add('loupe-pending');
    if (loupe) loupe.style.display = 'none';
    currentImg = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

    const focused = document.activeElement;
    if (focused && focused !== document.body && focused !== document) {
      showPendingIndicator(focused);
    }

    notifyBackground(true);
    persistState();
  }

  function deactivate() {
    state = 'off';
    clearFocusTimers();
    stopSlowCapture();
    if (mouseMoveTimer) { clearTimeout(mouseMoveTimer); mouseMoveTimer = null; }
    document.body.classList.remove('loupe-active', 'loupe-pending');
    if (loupe) loupe.style.display = 'none';
    hidePendingIndicator();
    currentImg = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    notifyBackground(false);
    try { sessionStorage.removeItem('__loupe_state'); } catch (e) {}
    try { sessionStorage.removeItem('__loupe_zoom'); } catch (e) {}
  }

  function toggle() {
    if (state === 'off') {
      zoom = getDefaultZoom();
      enterActiveMouseMode();
    } else {
      deactivate();
    }
  }

  function persistState() {
    try {
      if (state !== 'off') {
        sessionStorage.setItem('__loupe_state', 'pending');
        sessionStorage.setItem('__loupe_zoom', String(zoom));
      }
    } catch (e) {}
  }

  function restoreState() {
    try {
      const saved = sessionStorage.getItem('__loupe_state');
      if (saved === 'pending') {
        const savedZoom = parseInt(sessionStorage.getItem('__loupe_zoom'), 10);
        if (savedZoom >= MIN_ZOOM && savedZoom <= MAX_ZOOM) zoom = savedZoom;
        enterPendingMode();
      }
    } catch (e) {}
  }

  // === FOCUS TRACKING ===

  function clearFocusTimers() {
    if (focusInactivityTimer) { clearTimeout(focusInactivityTimer); focusInactivityTimer = null; }
    if (focusScrollRaf) { cancelAnimationFrame(focusScrollRaf); focusScrollRaf = null; }
    focusScrollOffset = 0;
    focusLoupeOverride = null;
  }

  function startFocusOnElement(el) {
    if (state !== 'active_focus') return;
    clearFocusTimers();
    focusTarget = el;
    focusScrollOffset = 0;
    focusLoupeOverride = null;

    const rect = el.getBoundingClientRect();
    focusX = rect.left + rect.width / 2;
    focusY = rect.top + rect.height / 2;

    const defaultStyle = getLoupeStyle(zoom, true);
    const elZoomedW = rect.width * zoom;
    const elZoomedH = rect.height * zoom;

    const ENLARGE_THRESHOLD = 1.5;
    if (elZoomedW > defaultStyle.w * ENLARGE_THRESHOLD || elZoomedH > defaultStyle.h * ENLARGE_THRESHOLD) {
      const maxW = Math.min(window.innerWidth - 20, 1200);
      const maxH = Math.min(window.innerHeight - 20, 800);
      const newW = Math.min(Math.max(elZoomedW + 40, defaultStyle.w), maxW);
      const newH = Math.min(Math.max(elZoomedH + 40, defaultStyle.h), maxH);
      focusLoupeOverride = { w: Math.round(newW), h: Math.round(newH) };
    }

    applyLoupeSize();

    const actualStyle = getLoupeStyle(zoom, true);
    const actualVisibleW = actualStyle.w / zoom;

    stopSlowCapture();
    doCapture(() => {
      updateLoupe();
      startSlowCapture();
      if (rect.width > actualVisibleW) {
        startFocusAutoScroll(rect, actualVisibleW);
      } else {
        startFocusInactivityTimer();
      }
    });
  }

  function startFocusAutoScroll(rect, visibleWidth) {
    const maxScroll = rect.width - visibleWidth;
    const scrollSpeed = 0.5;
    focusScrollOffset = 0;
    focusScrollDirection = 1;

    function scrollStep() {
      focusScrollOffset += scrollSpeed * focusScrollDirection;
      if (focusScrollOffset >= maxScroll) {
        focusScrollOffset = maxScroll;
        focusScrollDirection = 0;
        updateLoupe();
        startFocusInactivityTimer();
        return;
      }
      updateLoupe();
      focusScrollRaf = requestAnimationFrame(scrollStep);
    }
    focusScrollRaf = requestAnimationFrame(scrollStep);
  }

  function startFocusInactivityTimer() {
    if (focusInactivityTimer) clearTimeout(focusInactivityTimer);
    focusInactivityTimer = setTimeout(() => {
      if (state === 'active_focus') {
        if (loupe) loupe.style.display = 'none';
        clearFocusTimers();
      }
    }, 5000);
  }

  // === FOCUS CHANGE (Tab navigation) ===

  function isActivatableElement(el) {
    if (!el || el === document || el === document.body) return false;
    const tag = el.tagName;
    return tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' ||
      tag === 'SELECT' || tag === 'TEXTAREA' || el.hasAttribute('tabindex') ||
      el.hasAttribute('onclick') || el.getAttribute('role') === 'button' ||
      el.getAttribute('role') === 'link' || el.getAttribute('role') === 'checkbox' ||
      el.getAttribute('role') === 'menuitem' || !!el.closest('a, button');
  }

  function onFocusChange(e) {
    const el = e.target;

    if (state === 'pending') {
      showPendingIndicator(el);
      return;
    }

    if (state !== 'active_mouse' && state !== 'active_focus') return;
    if (!isActivatableElement(el)) return;

    // Transition: hide loupe → show unzoomed page briefly → reappear on new element
    clearFocusTimers();
    stopSlowCapture();
    if (loupe) loupe.style.display = 'none';
    currentImg = null;

    // Brief pause to show the unzoomed page with focus visible
    setTimeout(() => {
      state = 'active_focus';
      focusLoupeOverride = null;
      startFocusOnElement(el);
    }, 350);
  }

  document.addEventListener('focusin', onFocusChange, true);

  // === RIGHT-CLICK → PENDING ===

  document.addEventListener('contextmenu', (e) => {
    if (state === 'active_mouse' || state === 'active_focus') {
      e.preventDefault();
      enterPendingMode();
    }
  }, true);

  // === LEFT-CLICK HANDLING ===

  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (state === 'pending') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('click', (e) => {
    if (state === 'pending') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      enterActiveMouseMode();
    }
    // In active_mouse: clicks pass through normally (activate element)
  }, true);

  // === KEYBOARD ===

  document.addEventListener('keydown', (e) => {
    // Ctrl+L toggle on/off
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      e.stopPropagation();
      toggle();
      return;
    }

    // Escape: active → pending
    if (e.key === 'Escape' && (state === 'active_focus' || state === 'active_mouse')) {
      e.preventDefault();
      enterPendingMode();
      return;
    }

    // Enter in pending → activate focus without triggering element
    if (e.key === 'Enter' && state === 'pending') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const el = document.activeElement;
      if (el && el !== document.body && el !== document) {
        enterActiveFocusMode(el);
      }
      return;
    }

    // Enter in active_focus → normal behavior (activate element)
    // Navigation will happen, beforeunload sets state to pending

    // Zoom controls (+/- without modifiers)
    if (state === 'active_mouse' || state === 'active_focus') {
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          adjustZoom(1);
        } else if (e.key === '-') {
          e.preventDefault();
          adjustZoom(-1);
        }
      }
    }
  }, true);

  // Ctrl+wheel zoom
  document.addEventListener('wheel', (e) => {
    if (state !== 'active_mouse' && state !== 'active_focus') return;
    if (!e.ctrlKey) return;
    e.preventDefault();
    adjustZoom(e.deltaY < 0 ? 1 : -1);
  }, { passive: false, capture: true });

  // Mouse move
  document.addEventListener('mousemove', onMove);

  // Scroll → recapture
  let scrollTimer = null;
  document.addEventListener('scroll', () => {
    if (state === 'active_mouse') {
      scheduleUpdate();
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => { doCapture(); }, 100);
    }
  }, true);

  // === MESSAGES FROM BACKGROUND ===

  browser.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'toggle_loupe') toggle();
    if (msg.type === 'start_pending') {
      if (state === 'off') {
        zoom = getDefaultZoom();
        enterPendingMode();
      }
    }
    if (msg.type === 'update_default_zoom') {
      try { localStorage.setItem('__loupe_default_zoom', String(msg.zoom)); } catch (e) {}
    }
  });

  // === BEFORE UNLOAD: persist pending for same-tab nav ===

  window.addEventListener('beforeunload', () => {
    if (state !== 'off') {
      try {
        sessionStorage.setItem('__loupe_state', 'pending');
        sessionStorage.setItem('__loupe_zoom', String(zoom));
      } catch (e) {}
    }
  });

  // === INIT ===
  restoreState();
})();
