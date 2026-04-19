(() => {
  // === STATE MACHINE ===
  // 'off' | 'pending' | 'active_mouse' | 'active_focus' | 'active_magnifier'
  let state = 'off';

  let loupe = null;
  let zoomLabel = null;
  let pendingIndicator = null;
  let mouseX = 0, mouseY = 0;
  let rafId = null;
  let zoomLabelTimeout = null;
  let currentImg = null;

  // Separate zoom levels for each mode
  let mouseZoom = 2;
  let focusZoom = 5;
  let magnifierZoom = 8;
  // Active zoom used for rendering
  let zoom = 5;

  const MOUSE_ZOOM_MIN = 2, MOUSE_ZOOM_MAX = 4;
  const FOCUS_ZOOM_MIN = 2, FOCUS_ZOOM_MAX = 9;
  const MAGNIFIER_ZOOM_MIN = 8, MAGNIFIER_ZOOM_MAX = 20;

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
  let focusVerticalPart = 0;
  let focusVerticalParts = 1;
  let focusVerticalOffset = 0;
  let focusScrollPassCount = 0;
  const MAX_SCROLL_PASSES = 3;

  // Manual arrow-key scroll control
  let manualScrollMode = false;
  const ARROW_PAN_STEP = 20;

  // Magnifier state
  let magnifierPanX = 0, magnifierPanY = 0;
  let magnifierLastElement = null;

  // Cursor ring animation
  let cursorRing = null;

  // === HELPERS ===

  function loadZoomSettings() {
    try {
      const m = parseInt(localStorage.getItem('__loupe_mouse_zoom'), 10);
      if (m >= MOUSE_ZOOM_MIN && m <= MOUSE_ZOOM_MAX) mouseZoom = m;
    } catch (e) {}
    try {
      const f = parseInt(localStorage.getItem('__loupe_focus_zoom'), 10);
      if (f >= FOCUS_ZOOM_MIN && f <= FOCUS_ZOOM_MAX) focusZoom = f;
    } catch (e) {}
    try {
      const g = parseInt(localStorage.getItem('__loupe_magnifier_zoom'), 10);
      if (g >= MAGNIFIER_ZOOM_MIN && g <= MAGNIFIER_ZOOM_MAX) magnifierZoom = g;
    } catch (e) {}
    // Also load from extension storage
    try {
      browser.storage.local.get(['mouseZoom', 'focusZoom', 'magnifierZoom']).then((data) => {
        if (data.mouseZoom >= MOUSE_ZOOM_MIN && data.mouseZoom <= MOUSE_ZOOM_MAX) mouseZoom = data.mouseZoom;
        if (data.focusZoom >= FOCUS_ZOOM_MIN && data.focusZoom <= FOCUS_ZOOM_MAX) focusZoom = data.focusZoom;
        if (data.magnifierZoom >= MAGNIFIER_ZOOM_MIN && data.magnifierZoom <= MAGNIFIER_ZOOM_MAX) magnifierZoom = data.magnifierZoom;
      });
    } catch (e) {}
  }

  function getActiveZoom() {
    if (state === 'active_mouse') return mouseZoom;
    if (state === 'active_focus') return focusZoom;
    if (state === 'active_magnifier') return magnifierZoom;
    return focusZoom;
  }

  function getLoupeStyle(z, isFocus) {
    if (state === 'active_magnifier') {
      // Magnifier: full window
      return { w: window.innerWidth, h: window.innerHeight, radius: '0' };
    }
    if (isFocus && focusLoupeOverride) {
      return { w: focusLoupeOverride.w, h: focusLoupeOverride.h, radius: '16px' };
    }
    if (isFocus) {
      if (z <= 4) return { w: 320, h: 180, radius: '16px' };
      if (z <= 9) return { w: 400, h: 260, radius: '16px' };
      if (z <= 12) return { w: 520, h: 320, radius: '16px' };
      return { w: 820, h: 400, radius: '16px' };
    }
    // Mouse loupe: always round for ×2-×4
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

  // === CURSOR RING ===

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

  // === CAPTURE ===

  function doCapture(cb) {
    if (captureInFlight || (state !== 'active_mouse' && state !== 'active_focus' && state !== 'active_magnifier')) return;
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
      if (state === 'active_mouse' || state === 'active_focus' || state === 'active_magnifier') doCapture();
    }, SLOW_CAPTURE_MS);
  }

  function stopSlowCapture() {
    if (slowCaptureInterval) { clearInterval(slowCaptureInterval); slowCaptureInterval = null; }
  }

  // === RENDER ===

  function updateLoupe() {
    if ((state !== 'active_mouse' && state !== 'active_focus' && state !== 'active_magnifier') || !loupe || !currentImg) return;

    const isFocus = state === 'active_focus';
    const isMagnifier = state === 'active_magnifier';
    const s = getLoupeStyle(zoom, isFocus);
    const halfW = s.w / 2;
    const halfH = s.h / 2;

    if (isMagnifier) {
      // Magnifier: full window, top-left anchored
      loupe.style.left = (s.w / 2) + 'px';
      loupe.style.top = (s.h / 2) + 'px';
      loupe.style.display = 'block';

      const vpW = window.innerWidth;
      const vpH = window.innerHeight;
      const bgW = vpW * zoom;
      const bgH = vpH * zoom;
      const bgX = -magnifierPanX * zoom;
      const bgY = -magnifierPanY * zoom;

      loupe.style.backgroundImage = 'url(' + currentImg + ')';
      loupe.style.backgroundSize = bgW + 'px ' + bgH + 'px';
      loupe.style.backgroundPosition = bgX + 'px ' + bgY + 'px';
      return;
    }

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
      // Mouse movement alone keeps the user in focus-loupe (no pending switch).
      // Only Escape or right-click switches to pending.
      return;
    }

    if (state === 'active_magnifier') {
      // Mouse movement doesn't affect magnifier
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

    const newZoom = zoom + delta;
    if (newZoom < 2 || newZoom > 20) return;

    // --- Upward transitions ---
    if (delta > 0) {
      if (state === 'active_mouse' && newZoom > MOUSE_ZOOM_MAX) {
        // Mouse ×4 → Focus ×5: transition to focus-loupe
        focusZoom = newZoom;
        zoom = newZoom;
        // Place focus near last mouse position
        const elAtMouse = document.elementFromPoint(mouseX, mouseY);
        enterActiveFocusMode(elAtMouse || document.activeElement);
        showZoomIndicator();
        return;
      }
      if (state === 'active_focus' && newZoom > FOCUS_ZOOM_MAX) {
        // Focus ×9 → Magnifier ×10: transition to magnifier
        magnifierZoom = newZoom;
        zoom = newZoom;
        // Place magnifier view near last focus/mouse position
        magnifierPanX = Math.max(0, (state === 'active_focus' ? focusX : mouseX) - window.innerWidth / (2 * newZoom));
        magnifierPanY = Math.max(0, (state === 'active_focus' ? focusY : mouseY) - window.innerHeight / (2 * newZoom));
        enterMagnifierMode();
        zoom = newZoom; // re-set after enterMagnifierMode resets it
        magnifierZoom = newZoom;
        applyLoupeSize();
        updateLoupe();
        showZoomIndicator();
        return;
      }
    }

    // --- Downward transitions ---
    if (delta < 0) {
      if (state === 'active_magnifier' && newZoom < MAGNIFIER_ZOOM_MIN) {
        // Magnifier → Focus-loupe (at ×7 or below)
        focusZoom = newZoom;
        zoom = newZoom;
        // Focus near the center of what was visible in magnifier
        const cx = magnifierPanX + window.innerWidth / (2 * (newZoom + 1));
        const cy = magnifierPanY + window.innerHeight / (2 * (newZoom + 1));
        const elAt = document.elementFromPoint(
          Math.min(cx, window.innerWidth - 1),
          Math.min(cy, window.innerHeight - 1)
        );
        enterActiveFocusMode(elAt || document.activeElement);
        zoom = newZoom;
        focusZoom = newZoom;
        applyLoupeSize();
        showZoomIndicator();
        return;
      }
      // From focus-loupe going below ×5 does NOT switch to mouse loupe
      // User must left-click to go back to mouse mode
    }

    // --- Same mode zoom ---
    zoom = newZoom;

    if (state === 'active_mouse') mouseZoom = zoom;
    else if (state === 'active_focus') focusZoom = zoom;
    else if (state === 'active_magnifier') magnifierZoom = zoom;

    applyLoupeSize();
    doCapture(() => { updateLoupe(); });
    showZoomIndicator();
  }

  // === STATE TRANSITIONS ===

  function notifyBackground(isOn) {
    try {
      browser.runtime.sendMessage({ type: isOn ? 'loupe_active' : 'loupe_off' }).catch(() => {});
    } catch (e) {}
  }

  function enterActiveMouseMode() {
    state = 'active_mouse';
    zoom = mouseZoom;
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
    state = 'active_focus';
    zoom = focusZoom;
    focusTarget = el || document.activeElement;
    createLoupe();
    document.body.classList.remove('loupe-pending');
    document.body.classList.add('loupe-active');
    hidePendingIndicator();
    if (focusTarget) startFocusOnElement(focusTarget);
    notifyBackground(true);
    persistState();
  }

  function enterMagnifierMode() {
    state = 'active_magnifier';
    zoom = magnifierZoom;
    createLoupe();
    applyLoupeSize();
    document.body.classList.remove('loupe-pending');
    document.body.classList.add('loupe-active');
    hidePendingIndicator();

    // Start at top-left of page
    magnifierPanX = 0;
    magnifierPanY = 0;
    magnifierLastElement = document.activeElement || null;

    doCapture(() => {
      updateLoupe();
    });
    startSlowCapture();
    notifyBackground(true);
    persistState();
  }

  function enterPendingMode() {
    const wasFocus = state === 'active_focus';
    const wasMagnifier = state === 'active_magnifier';
    const focusEl = wasFocus ? focusTarget : null;
    state = 'pending';
    clearFocusTimers();
    stopSlowCapture();
    if (mouseMoveTimer) { clearTimeout(mouseMoveTimer); mouseMoveTimer = null; }
    document.body.classList.remove('loupe-active');
    document.body.classList.add('loupe-pending');
    if (loupe) loupe.style.display = 'none';
    currentImg = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

    // If coming from magnifier, focus on last zoomed element
    if (wasMagnifier && magnifierLastElement) {
      try { magnifierLastElement.focus(); } catch (e) {}
      const rect = magnifierLastElement.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      mouseX = cx;
      mouseY = cy;
      showCursorRing(cx, cy);
    }

    // If coming from focus mode, show ring at center of focused element
    if (wasFocus && focusEl) {
      const rect = focusEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      mouseX = cx;
      mouseY = cy;
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
      loadZoomSettings();
      // Start in pending mode (user then chooses how to interact)
      enterPendingMode();
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
        loadZoomSettings();
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
    focusScrollPassCount = 0;
    manualScrollMode = false;
  }

  function enterManualScroll() {
    if (manualScrollMode) return;
    manualScrollMode = true;
    if (focusScrollRaf) { cancelAnimationFrame(focusScrollRaf); focusScrollRaf = null; }
    startFocusInactivityTimer();
  }

  function handleArrowPan(direction) {
    if (state === 'active_focus') {
      enterManualScroll();
      startFocusInactivityTimer();
      switch (direction) {
        case 'left':  focusScrollOffset -= ARROW_PAN_STEP; break;
        case 'right': focusScrollOffset += ARROW_PAN_STEP; break;
        case 'up':    focusVerticalOffset -= ARROW_PAN_STEP; break;
        case 'down':  focusVerticalOffset += ARROW_PAN_STEP; break;
      }
      if (focusScrollOffset < 0) focusScrollOffset = 0;
      if (focusVerticalOffset < 0) focusVerticalOffset = 0;
      updateLoupe();
    } else if (state === 'active_magnifier') {
      // Pan magnifier view without recapture (no flickering)
      const step = 30;
      switch (direction) {
        case 'left':  magnifierPanX -= step; break;
        case 'right': magnifierPanX += step; break;
        case 'up':    magnifierPanY -= step; break;
        case 'down':  magnifierPanY += step; break;
      }
      // Clamp to page bounds
      magnifierPanX = Math.max(0, Math.min(window.innerWidth, magnifierPanX));
      magnifierPanY = Math.max(0, Math.min(window.innerHeight, magnifierPanY));

      // Track what element is at this position for pending focus
      const centerX = window.innerWidth / (2 * zoom) + magnifierPanX;
      const centerY = window.innerHeight / (2 * zoom) + magnifierPanY;
      const elAtPoint = document.elementFromPoint(
        Math.min(centerX, window.innerWidth - 1),
        Math.min(centerY, window.innerHeight - 1)
      );
      if (elAtPoint) magnifierLastElement = elAtPoint;

      updateLoupe();
    }
  }

  function startFocusOnElement(el) {
    if (state !== 'active_focus') return;
    clearFocusTimers();
    focusTarget = el;
    focusScrollOffset = 0;
    focusVerticalOffset = 0;
    focusVerticalPart = 0;
    focusLoupeOverride = null;

    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });

    const rect = el.getBoundingClientRect();

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

    // Left-align
    focusX = rect.left + actualVisibleW / 2;
    focusY = rect.top + rect.height / 2;

    focusVerticalPart = 0;
    focusVerticalOffset = 0;

    stopSlowCapture();
    doCapture(() => {
      updateLoupe();
      startSlowCapture();

      const needsHScroll = rect.width > actualVisibleW;
      const needsVScroll = rect.height > actualVisibleH;

      if (needsHScroll) {
        if (needsVScroll) {
          setTimeout(() => { startFocusMultiPartScroll(rect, actualVisibleW, actualVisibleH); }, 1000);
        } else {
          setTimeout(() => { startFocusHScrollOnly(rect, actualVisibleW); }, 1000);
        }
      } else {
        startFocusInactivityTimer();
      }
    });
  }

  function startFocusHScrollOnly(rect, visibleWidth) {
    if (state !== 'active_focus') return;
    const maxHScroll = rect.width - visibleWidth;
    focusScrollOffset = 0;
    const scrollSpeed = 0.5;
    focusScrollPassCount++;

    function hStep() {
      if (state !== 'active_focus' || manualScrollMode) return;
      focusScrollOffset += scrollSpeed;
      if (focusScrollOffset >= maxHScroll) {
        focusScrollOffset = maxHScroll;
        updateLoupe();
        setTimeout(() => {
          scrollBackLeft(maxHScroll, () => {
            if (focusScrollPassCount >= MAX_SCROLL_PASSES) {
              enterPendingMode();
              return;
            }
            setTimeout(() => {
              if (state === 'active_focus') {
                startFocusHScrollOnly(rect, visibleWidth);
              }
            }, 1000);
          });
        }, 2000);
        return;
      }
      updateLoupe();
      focusScrollRaf = requestAnimationFrame(hStep);
    }
    focusScrollRaf = requestAnimationFrame(hStep);
  }

  function startFocusMultiPartScroll(rect, visibleWidth, visibleHeight) {
    if (state !== 'active_focus') return;

    const totalScrollHeight = rect.height - visibleHeight;
    let verticalSteps = [0];
    if (totalScrollHeight > 0) {
      const thirdH = visibleHeight / 3;
      let offset = thirdH;
      while (offset < totalScrollHeight) {
        verticalSteps.push(offset);
        const remaining = totalScrollHeight - offset;
        if (remaining < thirdH && offset + remaining <= totalScrollHeight) {
          verticalSteps.push(totalScrollHeight);
          break;
        }
        offset += thirdH;
      }
      if (verticalSteps[verticalSteps.length - 1] < totalScrollHeight) {
        verticalSteps.push(totalScrollHeight);
      }
    }

    let stepIndex = 0;

    function scrollRow() {
      if (state !== 'active_focus') return;

      let currentVerticalOffset = verticalSteps[stepIndex] || 0;
      focusVerticalOffset = currentVerticalOffset;

      const effectiveTop = rect.top - currentVerticalOffset;
      focusY = effectiveTop + visibleHeight / 2;
      const s = getLoupeStyle(zoom, true);
      focusY = Math.max(s.h / 2, Math.min(window.innerHeight - s.h / 2, focusY));

      applyLoupeSize();
      updateLoupe();

      const needsHScroll = rect.width > visibleWidth;

      if (needsHScroll) {
        const maxHScroll = rect.width - visibleWidth;
        focusScrollOffset = 0;
        const scrollSpeed = 0.5;

        function hScrollStep() {
          if (state !== 'active_focus' || manualScrollMode) return;
          focusScrollOffset += scrollSpeed;
          if (focusScrollOffset >= maxHScroll) {
            focusScrollOffset = maxHScroll;
            updateLoupe();
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
        setTimeout(() => { advanceVertical(); }, 1000);
      }
    }

    function advanceVertical() {
      if (state !== 'active_focus') return;
      stepIndex++;
      if (stepIndex < verticalSteps.length) {
        setTimeout(() => { scrollRow(); }, 1000);
      } else {
        focusScrollPassCount++;
        if (focusScrollPassCount >= MAX_SCROLL_PASSES) {
          enterPendingMode();
          return;
        }
        setTimeout(() => {
          if (state === 'active_focus') {
            stepIndex = 0;
            focusVerticalOffset = 0;
            focusScrollOffset = 0;
            scrollRow();
          }
        }, 1000);
      }
    }

    scrollRow();
  }

  function scrollBackLeft(maxScroll, cb) {
    if (state !== 'active_focus') return;
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
    focusInactivityTimer = setTimeout(() => {
      if (state === 'active_focus') {
        if (focusScrollOffset > 0) {
          scrollBackLeft(focusScrollOffset, () => {
            setTimeout(() => {
              if (state === 'active_focus') {
                if (loupe) loupe.style.display = 'none';
                clearFocusTimers();
              }
            }, 2000);
          });
        } else {
          if (loupe) loupe.style.display = 'none';
          clearFocusTimers();
        }
      }
    }, 15000);
  }

  // === FOCUS CHANGE ===

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

    // Magnifier ignores tab navigation
    if (state === 'active_magnifier') return;

    if (state !== 'active_mouse' && state !== 'active_focus') return;
    if (!isActivatableElement(el)) return;

    clearFocusTimers();
    stopSlowCapture();
    if (loupe) loupe.style.display = 'none';
    currentImg = null;

    setTimeout(() => {
      if (state === 'off') return;
      state = 'active_focus';
      zoom = focusZoom;
      focusLoupeOverride = null;
      startFocusOnElement(el);
    }, 350);
  }

  document.addEventListener('focusin', onFocusChange, true);

  // === RIGHT-CLICK → PENDING ===

  document.addEventListener('contextmenu', (e) => {
    if (state === 'active_mouse' || state === 'active_focus' || state === 'active_magnifier') {
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
    if (state === 'active_mouse' || state === 'active_focus') {
      setTimeout(() => { doCapture(); }, 100);
    }
  }, true);

  // === KEYBOARD ===

  document.addEventListener('keydown', (e) => {
    // Escape: active → pending
    if (e.key === 'Escape' && (state === 'active_focus' || state === 'active_mouse' || state === 'active_magnifier')) {
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

    // Arrow keys: focus-loupe or magnifier panning
    if (state === 'active_focus' || state === 'active_magnifier') {
      if (e.key === 'ArrowLeft') { e.preventDefault(); handleArrowPan('left'); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleArrowPan('right'); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); handleArrowPan('up'); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); handleArrowPan('down'); return; }
    }

    // Zoom controls (+/- without modifiers)
    if (state === 'active_mouse' || state === 'active_focus' || state === 'active_magnifier') {
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
    if (state !== 'active_mouse' && state !== 'active_focus' && state !== 'active_magnifier') return;
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

  // === MESSAGES FROM BACKGROUND / POPUP ===

  browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'toggle_loupe') {
      toggle();
      return;
    }
    if (msg.type === 'start_pending') {
      if (state === 'off') {
        loadZoomSettings();
        enterPendingMode();
      }
      return;
    }
    if (msg.type === 'activate_mouse') {
      if (state === 'off') loadZoomSettings();
      enterActiveMouseMode();
      return;
    }
    if (msg.type === 'activate_focus') {
      if (state === 'off') loadZoomSettings();
      const el = document.activeElement;
      if (el && el !== document.body && el !== document) {
        enterActiveFocusMode(el);
      } else {
        enterPendingMode();
      }
      return;
    }
    if (msg.type === 'deactivate') {
      deactivate();
      return;
    }
    if (msg.type === 'get_state') {
      sendResponse({ state });
      return;
    }
    if (msg.type === 'activate_magnifier') {
      if (state === 'off') {
        loadZoomSettings();
      }
      enterMagnifierMode();
      return;
    }
    if (msg.type === 'update_zoom_setting') {
      const val = msg.value;
      if (msg.key === 'mouseZoom' && val >= MOUSE_ZOOM_MIN && val <= MOUSE_ZOOM_MAX) {
        mouseZoom = val;
        try { localStorage.setItem('__loupe_mouse_zoom', String(val)); } catch (e) {}
        if (state === 'active_mouse') { zoom = mouseZoom; applyLoupeSize(); doCapture(); }
      }
      if (msg.key === 'focusZoom' && val >= FOCUS_ZOOM_MIN && val <= FOCUS_ZOOM_MAX) {
        focusZoom = val;
        try { localStorage.setItem('__loupe_focus_zoom', String(val)); } catch (e) {}
        if (state === 'active_focus') { zoom = focusZoom; applyLoupeSize(); doCapture(); }
      }
      if (msg.key === 'magnifierZoom' && val >= MAGNIFIER_ZOOM_MIN && val <= MAGNIFIER_ZOOM_MAX) {
        magnifierZoom = val;
        try { localStorage.setItem('__loupe_magnifier_zoom', String(val)); } catch (e) {}
        if (state === 'active_magnifier') { zoom = magnifierZoom; applyLoupeSize(); doCapture(); }
      }
      return;
    }
    if (msg.type === 'update_default_zoom') {
      // Legacy support
      try { localStorage.setItem('__loupe_default_zoom', String(msg.zoom)); } catch (e) {}
    }
  });

  // === BEFORE UNLOAD ===

  window.addEventListener('beforeunload', () => {
    if (state !== 'off') {
      try {
        sessionStorage.setItem('__loupe_state', 'pending');
        sessionStorage.setItem('__loupe_zoom', String(zoom));
      } catch (e) {}
    }
  });

  // === INIT ===
  loadZoomSettings();
  restoreState();
})();
