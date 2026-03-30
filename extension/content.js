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
  const SLOW_CAPTURE_MS = 10000;

  // Focus tracking
  let focusTarget = null;
  let focusInactivityTimer = null;
  let focusScrollOffset = 0;
  let focusScrollDirection = 1;
  let focusScrollRaf = null;
  let focusX = 0, focusY = 0;
  let focusLoupeOverride = null;
  // Vertical multi-part scrolling
  let focusVerticalPart = 0;
  let focusVerticalParts = 1;
  let focusVerticalOffset = 0;

  // Cursor ring animation
  let cursorRing = null;

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

  // === CURSOR RING (shown when focus→pending, 1s animation) ===

  function showCursorRing(x, y) {
    if (!cursorRing) {
      cursorRing = document.createElement('div');
      cursorRing.id = 'loupe-cursor-ring';
      document.body.appendChild(cursorRing);
    }
    cursorRing.style.left = x + 'px';
    cursorRing.style.top = y + 'px';
    cursorRing.style.display = 'block';
    cursorRing.style.opacity = '1';
    setTimeout(() => {
      cursorRing.style.opacity = '0';
      setTimeout(() => { cursorRing.style.display = 'none'; }, 600);
    }, 1400);
  }

  // === CAPTURE (smart: on-demand + slow periodic) ===

  function doCapture(cb) {
    if (captureInFlight || (state !== 'active_mouse' && state !== 'active_focus')) return;
    captureInFlight = true;

    if (loupe) loupe.style.visibility = 'hidden';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const p = browser.runtime.sendMessage({ type: 'capture' });

        p.then((dataUrl) => {
          captureInFlight = false;
          if (dataUrl) {
            const img = new Image();
            img.onload = () => {
              currentImg = dataUrl;
              if (loupe) loupe.style.visibility = 'visible';
              updateLoupe();
              if (cb) cb();
            };
            img.onerror = () => {
              if (loupe) loupe.style.visibility = 'visible';
            };
            img.src = dataUrl;
          } else {
            if (loupe) loupe.style.visibility = 'visible';
          }
        }).catch(() => {
          captureInFlight = false;
          if (loupe) loupe.style.visibility = 'visible';
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
    const bgY = -posY * zoom + halfH - (isFocus ? focusVerticalOffset * zoom : 0);

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
      // Mouse moved while in focus mode → switch to pending
      enterPendingMode();
      return;
    }

    if (state === 'active_mouse') {
      scheduleUpdate();
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
      doCapture();
    }
    startSlowCapture();
    notifyBackground(true);
    persistState();
  }

  function enterActiveFocusMode(el) {
    // When entering focus mode, mouse-loupe goes pending conceptually
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
    const wasFocus = state === 'active_focus';
    const focusEl = focusTarget;
    state = 'pending';
    clearFocusTimers();
    stopSlowCapture();
    if (mouseMoveTimer) { clearTimeout(mouseMoveTimer); mouseMoveTimer = null; }
    document.body.classList.remove('loupe-active');
    document.body.classList.add('loupe-pending');
    if (loupe) loupe.style.display = 'none';
    currentImg = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

    // If coming from focus mode, position cursor at center of focused element
    if (wasFocus && focusEl) {
      const rect = focusEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      showCursorRing(cx, cy);
    }

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
    focusVerticalOffset = 0;
    focusVerticalPart = 0;
    focusVerticalParts = 1;
    focusLoupeOverride = null;
  }

  function startFocusOnElement(el) {
    if (state !== 'active_focus') return;
    clearFocusTimers();
    focusTarget = el;
    focusScrollOffset = 0;
    focusVerticalOffset = 0;
    focusVerticalPart = 0;
    focusLoupeOverride = null;

    // Scroll element into view if partially or fully off-screen
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });

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
    const actualVisibleH = actualStyle.h / zoom;

    // Compute vertical parts
    focusVerticalParts = Math.max(1, Math.ceil(rect.height / actualVisibleH));
    focusVerticalPart = 0;
    focusVerticalOffset = 0;

    // For multi-part: center loupe on top of element for first part
    if (focusVerticalParts > 1) {
      focusY = rect.top + actualVisibleH / 2;
    }

    stopSlowCapture();
    doCapture(() => {
      updateLoupe();
      startSlowCapture();

      const needsHScroll = rect.width > actualVisibleW;
      const needsVParts = focusVerticalParts > 1;

      if (needsHScroll || needsVParts) {
        setTimeout(() => { startFocusMultiPartScroll(rect, actualVisibleW, actualVisibleH); }, 1000);
      } else {
        startFocusInactivityTimer();
      }
    });
  }

  function startFocusMultiPartScroll(rect, visibleWidth, visibleHeight) {
    if (state !== 'active_focus') return;

    // Calculate how many vertical "rows" we need (each row = 2 text lines tall in zoom space)
    const lineHeight = 2 * 16; // ~2 lines at 16px each in page pixels
    const totalScrollHeight = rect.height - visibleHeight;
    let currentVerticalOffset = 0;

    function scrollRow() {
      if (state !== 'active_focus') return;

      // Set vertical offset
      focusVerticalOffset = currentVerticalOffset;

      // Update focusY based on current vertical offset
      const effectiveTop = rect.top - currentVerticalOffset;
      focusY = effectiveTop + visibleHeight / 2;
      const s = getLoupeStyle(zoom, true);
      focusY = Math.max(s.h / 2, Math.min(window.innerHeight - s.h / 2, focusY));

      applyLoupeSize();
      updateLoupe();

      const needsHScroll = rect.width > visibleWidth;

      if (needsHScroll) {
        // Horizontal scroll for this row
        const maxHScroll = rect.width - visibleWidth;
        focusScrollOffset = 0;
        const scrollSpeed = 0.5;

        function hScrollStep() {
          if (state !== 'active_focus') return;
          focusScrollOffset += scrollSpeed;
          if (focusScrollOffset >= maxHScroll) {
            focusScrollOffset = maxHScroll;
            updateLoupe();
            // Wait 2s then scroll back left over 2s
            setTimeout(() => {
              scrollBackLeft(maxHScroll, () => {
                advanceVertical();
              });
            }, 2000);
            return;
          }
          updateLoupe();
          focusScrollRaf = requestAnimationFrame(hScrollStep);
        }
        focusScrollRaf = requestAnimationFrame(hScrollStep);
      } else {
        // No horizontal scroll needed, just advance vertically after a pause
        setTimeout(() => { advanceVertical(); }, 1000);
      }
    }

    function advanceVertical() {
      if (state !== 'active_focus') return;
      currentVerticalOffset += lineHeight;
      if (currentVerticalOffset <= totalScrollHeight && totalScrollHeight > 0) {
        // 1s pause before next row
        setTimeout(() => { scrollRow(); }, 1000);
      } else {
        // Done with all rows
        startFocusInactivityTimer();
      }
    }

    scrollRow();
  }

  function scrollBackLeft(maxScroll, cb) {
    if (state !== 'active_focus') return;
    // Scroll back from current offset to 0 over ~2s (at 60fps = ~120 frames)
    const startOffset = focusScrollOffset;
    const duration = 2000;
    const startTime = performance.now();

    function step(now) {
      if (state !== 'active_focus') return;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      focusScrollOffset = startOffset * (1 - progress);
      updateLoupe();
      if (progress < 1) {
        focusScrollRaf = requestAnimationFrame(step);
      } else {
        focusScrollOffset = 0;
        updateLoupe();
        if (cb) cb();
      }
    }
    focusScrollRaf = requestAnimationFrame(step);
  }

  function startFocusInactivityTimer() {
    if (focusInactivityTimer) clearTimeout(focusInactivityTimer);
    // After scroll ends, wait 2s, scroll back left, then disappear
    // For single-part elements without h-scroll, just wait 15s
    focusInactivityTimer = setTimeout(() => {
      if (state === 'active_focus') {
        // If there was a scroll offset, scroll back left first
        if (focusScrollOffset > 0) {
          scrollBackLeft(focusScrollOffset, () => {
            setTimeout(() => {
              if (state === 'active_focus') {
                if (loupe) loupe.style.display = 'none';
                clearFocusTimers();
                // Stay in active_focus but hidden - next tab will re-show
              }
            }, 2000);
          });
        } else {
          if (loupe) loupe.style.display = 'none';
          clearFocusTimers();
          // Stay in active_focus but hidden - next tab will re-show
        }
      }
    }, 15000);
  }

  // === FOCUS CHANGE (Tab navigation) ===

  function isActivatableElement(el) {
    if (!el || el === document || el === document.body) return false;
    const tag = el.tagName;
    return tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' ||
      tag === 'SELECT' || tag === 'TEXTAREA' || el.hasAttribute('tabindex') ||
      el.hasAttribute('onclick') || el.getAttribute('role') === 'button' ||
      el.getAttribute('role') === 'link' || el.getAttribute('role') === 'checkbox' ||
      el.getAttribute('role') === 'menuitem' || !!el.closest('a, button') ||
      tag === 'IMG' || tag === 'VIDEO' || tag === 'IFRAME' || tag === 'OBJECT' ||
      tag === 'EMBED' || el.contentEditable === 'true';
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
      if (state === 'off') return;
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
      return;
    }
    // In active modes: capture after click (content may have changed)
    if (state === 'active_mouse' || state === 'active_focus') {
      setTimeout(() => { doCapture(); }, 100);
    }
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

    // Enter in active modes → capture after activation
    if (e.key === 'Enter' && (state === 'active_mouse' || state === 'active_focus')) {
      setTimeout(() => { doCapture(); }, 100);
    }

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
