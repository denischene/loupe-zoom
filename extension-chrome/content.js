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
  const ARROW_PAN_STEP_FINE = 5;
  const MAGNIFIER_PAN_STEP = 30;
  const MAGNIFIER_PAN_STEP_FINE = 8;

  // Page-edge bumper indicators (top/bottom/left/right thick bars)
  let pageEdgeBars = null;

  // Magnifier state
  let magnifierPanX = 0, magnifierPanY = 0;
  let magnifierLastElement = null;

  // Cursor ring animation
  let cursorRing = null;

  // Suppress focusin-driven mode transitions briefly (e.g. after right-click)
  let suppressFocusTransitionUntil = 0;

  // Browser-level page zoom (applied via document.body.style.zoom)
  // initialBrowserZoom = the user's browser zoom captured at first activation.
  // All mode-transition zoom bumps are computed relative to this baseline so
  // that a user already at e.g. 110% gets +10pp / +30pp on top of THEIR zoom.
  let initialBrowserZoom = null; // null until captured
  function getCurrentPageZoomPercent() {
    try {
      const z = document.body && document.body.style && document.body.style.zoom;
      if (!z) {
        // Fallback: derive from devicePixelRatio approximation is unreliable; use 100.
        return 100;
      }
      if (typeof z === 'string' && z.endsWith('%')) return parseFloat(z) || 100;
      const n = parseFloat(z);
      return isNaN(n) ? 100 : n * 100;
    } catch (e) { return 100; }
  }
  function setPageZoomPercent(percent) {
    try {
      if (!document.body) return;
      document.body.style.zoom = (percent / 100).toString();
    } catch (e) {}
  }
  function ensurePageZoomAtLeast(percent) {
    if (getCurrentPageZoomPercent() < percent) setPageZoomPercent(percent);
  }
  // Capture the user's initial browser zoom on first activation. If body.style.zoom
  // is unset, default baseline to 110% (per spec).
  function captureInitialBrowserZoom() {
    if (initialBrowserZoom != null) return;
    try {
      const raw = document.body && document.body.style && document.body.style.zoom;
      if (raw) {
        initialBrowserZoom = getCurrentPageZoomPercent();
      } else {
        initialBrowserZoom = 110;
      }
    } catch (e) { initialBrowserZoom = 110; }
  }
  function baseZoom() {
    return initialBrowserZoom != null ? initialBrowserZoom : 110;
  }

  // Arrow hint indicators (shown around focus-loupe when manual nav is needed)
  let arrowHints = null;

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

  // === ARROW HINTS (shown around focus-loupe to suggest keyboard nav) ===

  function ensureArrowHints() {
    if (arrowHints) return arrowHints;
    arrowHints = {};
    const dirs = ['up', 'down', 'left', 'right'];
    const glyphs = { up: '\u25B2', down: '\u25BC', left: '\u25C0', right: '\u25B6' };
    dirs.forEach((d) => {
      const el = document.createElement('div');
      el.className = 'loupe-arrow-hint loupe-arrow-' + d;
      el.textContent = glyphs[d];
      el.style.display = 'none';
      document.body.appendChild(el);
      arrowHints[d] = el;
    });
    return arrowHints;
  }

  function showArrowHints() {
    if (!loupe || state !== 'active_focus') return;
    ensureArrowHints();
    const rect = loupe.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    // Position arrows directly on the borders (centers of each side)
    arrowHints.up.style.left = cx + 'px';
    arrowHints.up.style.top = rect.top + 'px';
    arrowHints.down.style.left = cx + 'px';
    arrowHints.down.style.top = rect.bottom + 'px';
    arrowHints.left.style.left = rect.left + 'px';
    arrowHints.left.style.top = cy + 'px';
    arrowHints.right.style.left = rect.right + 'px';
    arrowHints.right.style.top = cy + 'px';
    Object.values(arrowHints).forEach((el) => { el.style.display = 'block'; });
  }

  function hideArrowHints() {
    if (!arrowHints) return;
    Object.values(arrowHints).forEach((el) => { el.style.display = 'none'; });
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

  // === MAGNIFIER EVENT-DRIVEN CAPTURE ===
  // In magnifier mode, periodic capture causes a visible flicker (the loupe
  // hides itself briefly to expose the page). To minimize flicker, we capture
  // ONLY when something actually changed in the page: focus moved, scroll
  // happened, an element was activated, or DOM mutated significantly (e.g.
  // listbox/menu opened).
  let magnifierCaptureTimer = null;
  let magnifierMutationObserver = null;
  let magnifierEventListeners = null;

  function scheduleMagnifierCapture(delay) {
    if (state !== 'active_magnifier') return;
    if (magnifierCaptureTimer) clearTimeout(magnifierCaptureTimer);
    magnifierCaptureTimer = setTimeout(() => {
      magnifierCaptureTimer = null;
      if (state === 'active_magnifier') doCapture();
    }, delay || 120);
  }

  function startMagnifierEventCapture() {
    stopMagnifierEventCapture();
    magnifierEventListeners = [];
    const onFocus = () => scheduleMagnifierCapture(80);
    const onScroll = () => scheduleMagnifierCapture(120);
    const onClick = () => scheduleMagnifierCapture(150);
    const onChange = () => scheduleMagnifierCapture(120);
    document.addEventListener('focusin', onFocus, true);
    window.addEventListener('scroll', onScroll, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('change', onChange, true);
    magnifierEventListeners.push(
      ['focusin', onFocus, true, document],
      ['scroll', onScroll, true, window],
      ['click', onClick, true, document],
      ['change', onChange, true, document]
    );
    try {
      // IDs/classes that belong to the loupe overlay itself — mutations on these
      // must NOT trigger a recapture (otherwise capture → hide loupe → mutation
      // → recapture creates an infinite flicker loop).
      const isOurNode = (node) => {
        if (!node || node.nodeType !== 1) return false;
        const id = node.id || '';
        if (id === 'loupe-overlay' || id === 'loupe-zoom-label' ||
            id === 'loupe-pending-icon' || id === 'loupe-cursor-ring') return true;
        const cls = (node.className && typeof node.className === 'string') ? node.className : '';
        if (cls.indexOf('loupe-') !== -1) return true;
        if (node.closest && node.closest('#loupe-overlay, .loupe-page-edge-bar, .loupe-arrow-hint')) return true;
        return false;
      };
      magnifierMutationObserver = new MutationObserver((mutations) => {
        // Ignore mutations that come from our own overlay/indicator nodes.
        for (const m of mutations) {
          if (isOurNode(m.target)) continue;
          // Also ignore body class toggles we add ourselves (loupe-active/pending)
          if (m.type === 'attributes' && m.target === document.body && m.attributeName === 'class') continue;
          scheduleMagnifierCapture(200);
          return;
        }
      });
      magnifierMutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'aria-expanded', 'aria-hidden', 'open', 'hidden']
      });
    } catch (e) {}
  }

  function stopMagnifierEventCapture() {
    if (magnifierCaptureTimer) { clearTimeout(magnifierCaptureTimer); magnifierCaptureTimer = null; }
    if (magnifierMutationObserver) { try { magnifierMutationObserver.disconnect(); } catch (e) {} magnifierMutationObserver = null; }
    if (magnifierEventListeners) {
      magnifierEventListeners.forEach(([ev, fn, capture, target]) => {
        try { target.removeEventListener(ev, fn, capture); } catch (e) {}
      });
      magnifierEventListeners = null;
    }
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

    const base = baseZoom();

    // --- Upward transitions ---
    if (delta > 0) {
      if (state === 'active_mouse' && newZoom > MOUSE_ZOOM_MAX) {
        // Mouse ×4 → Focus ×5: bump browser zoom to base + 10 (if lower)
        ensurePageZoomAtLeast(base + 10);
        focusZoom = newZoom;
        zoom = newZoom;
        // Find a focusable element near the mouse position
        let elAtMouse = document.elementFromPoint(mouseX, mouseY);
        let focusable = elAtMouse;
        while (focusable && focusable !== document.body && !isActivatableElement(focusable)) {
          focusable = focusable.parentElement;
        }
        if (!focusable || focusable === document.body) focusable = elAtMouse;
        if (focusable && focusable !== document.body) {
          try {
            if (!focusable.hasAttribute('tabindex') &&
                !['A','BUTTON','INPUT','SELECT','TEXTAREA'].includes(focusable.tagName)) {
              focusable.setAttribute('tabindex', '-1');
            }
            focusable.focus({ preventScroll: true });
          } catch (e) {}
        }
        enterActiveFocusMode(focusable || document.activeElement);
        showZoomIndicator();
        return;
      }
      if (state === 'active_focus' && newZoom > FOCUS_ZOOM_MAX) {
        // Focus ×9 → Magnifier ×10: bump browser zoom to base + 30 (if lower)
        ensurePageZoomAtLeast(base + 30);
        magnifierZoom = newZoom;
        zoom = newZoom;
        magnifierPanX = Math.max(0, (state === 'active_focus' ? focusX : mouseX) - window.innerWidth / (2 * newZoom));
        magnifierPanY = Math.max(0, (state === 'active_focus' ? focusY : mouseY) - window.innerHeight / (2 * newZoom));
        enterMagnifierMode();
        zoom = newZoom;
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
        // Magnifier ×8 → Focus ×7: set browser zoom to base + 10
        setPageZoomPercent(base + 10);
        focusZoom = newZoom;
        zoom = newZoom;
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
      if (state === 'active_focus' && newZoom < FOCUS_ZOOM_MIN) {
        // Focus ×2 → Mouse ×... we cap at FOCUS_ZOOM_MIN already; this branch unused.
      }
      if (state === 'active_focus' && newZoom <= MOUSE_ZOOM_MAX - 1) {
        // Focus ×4 → Mouse ×3: restore browser zoom to base (initial)
        setPageZoomPercent(base);
        mouseZoom = newZoom;
        zoom = newZoom;
        // Position mouse near the focused element so the loupe appears there
        if (focusTarget) {
          try {
            const rect = focusTarget.getBoundingClientRect();
            mouseX = rect.left + rect.width / 2;
            mouseY = rect.top + rect.height / 2;
          } catch (e) {}
        }
        enterActiveMouseMode();
        zoom = newZoom;
        mouseZoom = newZoom;
        applyLoupeSize();
        showZoomIndicator();
        return;
      }
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

  // Cleanup residual state from any previous mode before switching to a new one.
  // Used when the user activates a different mode while one is already active.
  function clearPreviousModeArtifacts() {
    clearFocusTimers();
    hideArrowHints();
    hidePendingIndicator();
    stopMagnifierEventCapture();
    if (mouseMoveTimer) { clearTimeout(mouseMoveTimer); mouseMoveTimer = null; }
    focusLoupeOverride = null;
    focusTarget = null;
    magnifierPanX = 0;
    magnifierPanY = 0;
  }

  function enterActiveMouseMode() {
    captureInitialBrowserZoom();
    const wasFocus = state === 'active_focus';
    const wasMagnifier = state === 'active_magnifier';
    clearPreviousModeArtifacts();
    suppressFocusTransitionUntil = Date.now() + 1000;
    try {
      const ae = document.activeElement;
      if (ae && ae !== document.body && typeof ae.blur === 'function') ae.blur();
    } catch (e) {}
    if (wasFocus && typeof focusX === 'number' && typeof focusY === 'number' && focusX > 0 && focusY > 0) {
      mouseX = focusX;
      mouseY = focusY;
    } else if (wasMagnifier) {
      mouseX = magnifierPanX + window.innerWidth / (2 * zoom);
      mouseY = magnifierPanY + window.innerHeight / (2 * zoom);
    } else if (!mouseX && !mouseY) {
      mouseX = Math.floor(window.innerWidth / 2);
      mouseY = Math.floor(window.innerHeight / 2);
    }
    state = 'active_mouse';
    zoom = mouseZoom;
    createLoupe();
    applyLoupeSize();
    document.body.classList.remove('loupe-pending');
    document.body.classList.add('loupe-active');
    hidePendingIndicator();
    currentImg = null;
    doCapture(() => { updateLoupe(); });
    startSlowCapture();
    notifyBackground(true);
    persistState();
  }

  function enterActiveFocusMode(el) {
    captureInitialBrowserZoom();
    clearPreviousModeArtifacts();
    state = 'active_focus';
    zoom = focusZoom;
    focusTarget = el || document.activeElement;
    createLoupe();
    applyLoupeSize();
    document.body.classList.remove('loupe-pending');
    document.body.classList.add('loupe-active');
    hidePendingIndicator();
    if (focusTarget) startFocusOnElement(focusTarget);
    notifyBackground(true);
    persistState();
  }

  function enterMagnifierMode() {
    captureInitialBrowserZoom();
    clearPreviousModeArtifacts();
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

    // Focus the first focusable element of the page
    const firstFocusable = findFirstFocusableElement();
    if (firstFocusable) {
      try { firstFocusable.focus({ preventScroll: true }); } catch (e) {
        try { firstFocusable.focus(); } catch (_) {}
      }
      magnifierLastElement = firstFocusable;
    } else {
      magnifierLastElement = document.activeElement || null;
    }

    currentImg = null;
    doCapture(() => {
      updateLoupe();
      // After initial render, move focus to any activable element at the
      // visible center of the magnifier viewport (if present).
      focusActivableAtMagnifierCenter();
    });
    startMagnifierEventCapture();
    notifyBackground(true);
    persistState();
  }

  // Find the first interactive/focusable element in document order.
  function findFirstFocusableElement() {
    const sel = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
    const list = document.querySelectorAll(sel);
    for (const el of list) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
    return list[0] || null;
  }

  function isActivableElement(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (['a', 'button', 'input', 'select', 'textarea', 'summary'].includes(tag)) return true;
    if (el.hasAttribute && (el.hasAttribute('tabindex') || el.hasAttribute('onclick'))) return true;
    const role = el.getAttribute && el.getAttribute('role');
    if (role && ['button', 'link', 'menuitem', 'option', 'tab', 'checkbox', 'radio'].includes(role)) return true;
    return false;
  }

  function focusActivableAtMagnifierCenter() {
    if (state !== 'active_magnifier') return;
    const cx = Math.min(window.innerWidth / (2 * zoom) + magnifierPanX, window.innerWidth - 1);
    const cy = Math.min(window.innerHeight / (2 * zoom) + magnifierPanY, window.innerHeight - 1);
    let el = document.elementFromPoint(cx, cy);
    // Walk up to find an activable ancestor
    let cursor = el;
    while (cursor && cursor !== document.body) {
      if (isActivableElement(cursor)) {
        try { cursor.focus({ preventScroll: true }); } catch (e) {
          try { cursor.focus(); } catch (_) {}
        }
        magnifierLastElement = cursor;
        return;
      }
      cursor = cursor.parentElement;
    }
    if (el) magnifierLastElement = el;
  }

  function enterPendingMode() {
    const wasFocus = state === 'active_focus';
    const wasMagnifier = state === 'active_magnifier';
    const focusEl = wasFocus ? focusTarget : null;
    state = 'pending';
    clearFocusTimers();
    stopSlowCapture();
    stopMagnifierEventCapture();
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

  let lastUsedMode = null;

  function deactivate() {
    if (state === 'active_mouse' || state === 'active_focus' || state === 'active_magnifier' || state === 'pending') {
      lastUsedMode = state;
      try { sessionStorage.setItem('__loupe_last_mode', state); } catch (e) {}
    }
    state = 'off';
    clearFocusTimers();
    stopSlowCapture();
    stopMagnifierEventCapture();
    if (mouseMoveTimer) { clearTimeout(mouseMoveTimer); mouseMoveTimer = null; }
    document.body.classList.remove('loupe-active', 'loupe-pending');
    if (loupe) loupe.style.display = 'none';
    hidePendingIndicator();
    currentImg = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    // Restore the browser zoom to the user's original level (captured on first
    // activation). If unknown, fall back to 100%.
    setPageZoomPercent(initialBrowserZoom != null ? initialBrowserZoom : 100);
    initialBrowserZoom = null;
    notifyBackground(false);
    try { sessionStorage.removeItem('__loupe_state'); } catch (e) {}
    try { sessionStorage.removeItem('__loupe_zoom'); } catch (e) {}
  }

  function toggle() {
    if (state === 'off') {
      loadZoomSettings();
      let mode = lastUsedMode;
      if (!mode) {
        try { mode = sessionStorage.getItem('__loupe_last_mode'); } catch (e) {}
      }
      if (mode === 'active_focus') enterActiveFocusMode();
      else if (mode === 'active_magnifier') enterMagnifierMode();
      else enterActiveMouseMode(); // default Loupe souris
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
    hideArrowHints();
  }

  function enterManualScroll() {
    if (manualScrollMode) return;
    manualScrollMode = true;
    if (focusScrollRaf) { cancelAnimationFrame(focusScrollRaf); focusScrollRaf = null; }
    hideArrowHints();
    startFocusInactivityTimer();
  }

  let edgeScrollCaptureTimer = null;
  function scheduleEdgeScrollCapture() {
    if (edgeScrollCaptureTimer) clearTimeout(edgeScrollCaptureTimer);
    // Wait briefly for scroll to settle, then capture. If a capture is already
    // in flight, retry shortly after to guarantee a refresh within ~1s.
    const attempt = (tries) => {
      if (state !== 'active_magnifier') return;
      if (!captureInFlight) {
        doCapture();
      } else if (tries > 0) {
        edgeScrollCaptureTimer = setTimeout(() => attempt(tries - 1), 200);
      }
    };
    edgeScrollCaptureTimer = setTimeout(() => attempt(5), 150);
  }

  function handleArrowPan(direction, fine) {
    if (state === 'active_focus') {
      enterManualScroll();
      startFocusInactivityTimer();
      const step = fine ? ARROW_PAN_STEP_FINE : ARROW_PAN_STEP;
      switch (direction) {
        case 'left':  focusScrollOffset -= step; break;
        case 'right': focusScrollOffset += step; break;
        case 'up':    focusVerticalOffset -= step; break;
        case 'down':  focusVerticalOffset += step; break;
      }
      if (focusScrollOffset < 0) focusScrollOffset = 0;
      if (focusVerticalOffset < 0) focusVerticalOffset = 0;
      updateLoupe();
    } else if (state === 'active_magnifier') {
      const step = fine ? MAGNIFIER_PAN_STEP_FINE : MAGNIFIER_PAN_STEP;
      const viewW = window.innerWidth / zoom;
      const viewH = window.innerHeight / zoom;
      const maxPanX = Math.max(0, window.innerWidth - viewW);
      const maxPanY = Math.max(0, window.innerHeight - viewH);

      let hitEdge = null;
      // When the magnifier view reaches the window edge, each additional arrow
      // press scrolls the page by the SAME small "step" amount, so movement
      // stays smooth and progressive (no large jump). After scrolling, the
      // pan offset stays at the edge so the view keeps tracking the new page area.
      switch (direction) {
        case 'left':
          if (magnifierPanX <= 0) {
            const before = window.scrollX;
            window.scrollBy({ left: -step, behavior: 'auto' });
            if (window.scrollX === before) hitEdge = 'left';
            else { scheduleEdgeScrollCapture(); }
          } else {
            magnifierPanX -= step;
          }
          break;
        case 'right':
          if (magnifierPanX >= maxPanX) {
            const before = window.scrollX;
            window.scrollBy({ left: step, behavior: 'auto' });
            if (window.scrollX === before) hitEdge = 'right';
            else { scheduleEdgeScrollCapture(); }
          } else {
            magnifierPanX += step;
          }
          break;
        case 'up':
          if (magnifierPanY <= 0) {
            const before = window.scrollY;
            window.scrollBy({ top: -step, behavior: 'auto' });
            if (window.scrollY === before) hitEdge = 'top';
            else { scheduleEdgeScrollCapture(); }
          } else {
            magnifierPanY -= step;
          }
          break;
        case 'down':
          if (magnifierPanY >= maxPanY) {
            const before = window.scrollY;
            window.scrollBy({ top: step, behavior: 'auto' });
            if (window.scrollY === before) hitEdge = 'bottom';
            else { scheduleEdgeScrollCapture(); }
          } else {
            magnifierPanY += step;
          }
          break;
      }
      magnifierPanX = Math.max(0, Math.min(maxPanX, magnifierPanX));
      magnifierPanY = Math.max(0, Math.min(maxPanY, magnifierPanY));

      if (hitEdge) showPageEdgeBar(hitEdge);

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

  // === PAGE-EDGE BUMPER BARS ===

  function isAtPageEdge(side) {
    const doc = document.documentElement;
    switch (side) {
      case 'top':    return window.scrollY <= 0;
      case 'bottom': return window.scrollY + window.innerHeight >= doc.scrollHeight - 1;
      case 'left':   return window.scrollX <= 0;
      case 'right':  return window.scrollX + window.innerWidth >= doc.scrollWidth - 1;
    }
    return false;
  }

  function ensurePageEdgeBars() {
    if (pageEdgeBars) return pageEdgeBars;
    pageEdgeBars = {};
    ['top', 'bottom', 'left', 'right'].forEach((side) => {
      const el = document.createElement('div');
      el.className = 'loupe-page-edge-bar loupe-page-edge-' + side;
      el.style.display = 'none';
      document.body.appendChild(el);
      pageEdgeBars[side] = el;
    });
    return pageEdgeBars;
  }

  function showPageEdgeBar(side) {
    if (!isAtPageEdge(side)) return;
    ensurePageEdgeBars();
    const el = pageEdgeBars[side];
    if (!el) return;
    el.style.display = 'block';
    el.style.opacity = '1';
    if (el._hideTimer) clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => { el.style.display = 'none'; }, 400);
    }, 700);
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

      // If vertical scrolling would be needed, do NOT scroll vertically.
      // Align the top of the element to the top of the loupe view so the user
      // can read the start of the content; vertical exploration will be done
      // manually via arrow keys (hints shown after the horizontal demo).
      if (needsVScroll) {
        focusY = rect.top + actualVisibleH / 2;
        updateLoupe();
      }

      if (needsHScroll) {
        // Both H-only and H+V cases: only animate horizontally.
        setTimeout(() => { startFocusHScrollOnly(rect, actualVisibleW, needsVScroll); }, 1000);
      } else if (needsVScroll) {
        // Vertical needed but no horizontal: show arrow hints right away.
        showArrowHints();
        startFocusInactivityTimer();
      } else {
        startFocusInactivityTimer();
      }
    });
  }

  function startFocusHScrollOnly(rect, visibleWidth, showHintsAfter) {
    if (state !== 'active_focus') return;
    const maxHScroll = rect.width - visibleWidth;
    focusScrollOffset = 0;
    const scrollSpeed = 0.5;

    function finish() {
      // Always show arrows after the single round-trip ends at the left edge
      focusScrollOffset = 0;
      updateLoupe();
      showArrowHints();
      startFocusInactivityTimer();
    }

    function hStep() {
      if (state !== 'active_focus' || manualScrollMode) { finish(); return; }
      focusScrollOffset += scrollSpeed;
      if (focusScrollOffset >= maxHScroll) {
        focusScrollOffset = maxHScroll;
        updateLoupe();
        setTimeout(() => {
          if (state !== 'active_focus' || manualScrollMode) { finish(); return; }
          scrollBackLeft(maxHScroll, () => { finish(); });
        }, 1500);
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
    if (Date.now() < suppressFocusTransitionUntil) return;
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
      // Prevent any focusin triggered by the right-click from switching to focus mode
      suppressFocusTransitionUntil = Date.now() + 600;
      enterPendingMode();
    }
  }, true);

  // Also block focus moves caused by mousedown of the right button
  document.addEventListener('mousedown', (e) => {
    if (e.button === 2) {
      suppressFocusTransitionUntil = Date.now() + 600;
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
    // In magnifier mode, left-click activates the element under the visible center
    if (state === 'active_magnifier') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      activateMagnifierElement();
      return;
    }
    if (state === 'active_mouse' || state === 'active_focus') {
      setTimeout(() => { doCapture(); }, 100);
    }
  }, true);

  // Block the underlying left mousedown in magnifier so the page does not
  // receive an unintended click at the cursor location.
  document.addEventListener('mousedown', (e) => {
    if (e.button === 0 && state === 'active_magnifier') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }, true);

  function findActivableAncestor(el) {
    let cur = el;
    let depth = 0;
    while (cur && cur.nodeType === 1 && depth < 8) {
      const tag = (cur.tagName || '').toLowerCase();
      if (tag === 'a' && cur.href) return cur;
      if (tag === 'button') return cur;
      if (tag === 'input') {
        const t = (cur.type || '').toLowerCase();
        if (t === 'submit' || t === 'button' || t === 'reset' || t === 'checkbox' || t === 'radio' || t === 'image') return cur;
      }
      if (tag === 'select' || tag === 'textarea' || tag === 'summary' || tag === 'label') return cur;
      const role = cur.getAttribute && cur.getAttribute('role');
      if (role && ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio', 'switch', 'option'].indexOf(role) !== -1) return cur;
      if (cur.hasAttribute && cur.hasAttribute('onclick')) return cur;
      cur = cur.parentElement;
      depth++;
    }
    return null;
  }

  function activateMagnifierElement() {
    // Page coordinate at the visible center of the magnifier viewport
    const cx = magnifierPanX + window.innerWidth / (2 * zoom);
    const cy = magnifierPanY + window.innerHeight / (2 * zoom);
    const x = Math.max(0, Math.min(window.innerWidth - 1, cx));
    const y = Math.max(0, Math.min(window.innerHeight - 1, cy));
    // Temporarily hide the loupe so elementFromPoint sees the underlying page
    const prevDisplay = loupe ? loupe.style.display : '';
    if (loupe) loupe.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    if (loupe) loupe.style.display = prevDisplay;
    if (!el) return;
    magnifierLastElement = el;
    const target = findActivableAncestor(el) || el;
    try { if (typeof target.focus === 'function') target.focus({ preventScroll: true }); } catch (err) {}

    const tag = (target.tagName || '').toLowerCase();
    const eventInit = {
      bubbles: true, cancelable: true, composed: true, view: window,
      button: 0, buttons: 1, clientX: x, clientY: y
    };

    try {
      // Full pointer/mouse sequence so frameworks (React, etc.) and native handlers fire
      try { target.dispatchEvent(new PointerEvent('pointerdown', { ...eventInit, pointerId: 1, pointerType: 'mouse' })); } catch (e) {}
      target.dispatchEvent(new MouseEvent('mousedown', eventInit));
      try { target.dispatchEvent(new PointerEvent('pointerup', { ...eventInit, pointerId: 1, pointerType: 'mouse' })); } catch (e) {}
      target.dispatchEvent(new MouseEvent('mouseup', eventInit));

      // Use native .click() when available — it triggers the default action for
      // buttons, inputs, and follows links for <a>.
      if (typeof target.click === 'function') {
        target.click();
      } else {
        target.dispatchEvent(new MouseEvent('click', eventInit));
      }

      // Safety net for plain anchors that didn't navigate (e.g. handler swallowed click)
      if (tag === 'a' && target.href) {
        // Defer slightly so any SPA router has a chance to handle the click first
        const hrefBefore = window.location.href;
        setTimeout(() => {
          if (window.location.href === hrefBefore) {
            const targetAttr = target.getAttribute('target');
            if (targetAttr && targetAttr !== '_self') {
              window.open(target.href, targetAttr);
            } else {
              window.location.href = target.href;
            }
          }
        }, 100);
      }
    } catch (err) {}

    // Recapture after activation in case the page changed
    setTimeout(() => { doCapture(); }, 200);
  }

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

    // Enter in magnifier → activate the centered element
    if (e.key === 'Enter' && state === 'active_magnifier') {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      activateMagnifierElement();
      return;
    }

    // Enter in active modes → capture after activation
    if (e.key === 'Enter' && (state === 'active_mouse' || state === 'active_focus')) {
      setTimeout(() => { doCapture(); }, 100);
    }

    // Arrow keys: focus-loupe or magnifier panning (Ctrl = fine step)
    if (state === 'active_focus' || state === 'active_magnifier') {
      const fine = !!e.ctrlKey;
      if (e.key === 'ArrowLeft') { e.preventDefault(); handleArrowPan('left', fine); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleArrowPan('right', fine); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); handleArrowPan('up', fine); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); handleArrowPan('down', fine); return; }
    }

    // Home key in magnifier mode → reset view to top-left of the page
    if (state === 'active_magnifier' && e.key === 'Home') {
      e.preventDefault();
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      magnifierPanX = 0;
      magnifierPanY = 0;
      setTimeout(() => { doCapture(); updateLoupe(); }, 50);
      return;
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

  // === GLOBAL KEYBOARD SHORTCUT (fallback for Ctrl+Shift+Z) ===
  // Firefox réserve souvent Ctrl+Shift+Z pour "Rétablir" → on capte la combinaison
  // directement dans la page (en phase capture) pour garantir le toggle.
  function isEditableTarget(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  window.addEventListener('keydown', (e) => {
    // Ctrl+Shift+Z (ou Cmd+Shift+Z) — éviter les champs éditables pour ne pas
    // casser le "Redo" natif de l'utilisateur en saisie.
    const isToggleCombo =
      (e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'Z' || e.key === 'z' || e.code === 'KeyZ');
    if (!isToggleCombo) return;
    if (isEditableTarget(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    try { toggle(); } catch (err) {}
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
      let el = document.activeElement;
      if (!el || el === document.body || el === document || el === document.documentElement) {
        // Simulate a Tab press: focus the first focusable element in the page
        const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
        const candidates = Array.from(document.querySelectorAll(focusableSelector)).filter((node) => {
          if (!(node instanceof HTMLElement)) return false;
          if (node.offsetParent === null && node.tagName !== 'BODY') return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        if (candidates.length > 0) {
          try { candidates[0].focus({ preventScroll: false }); } catch (err) {}
          el = document.activeElement;
        }
      }
      if (el && el !== document.body && el !== document && el !== document.documentElement) {
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

  // === THEME → TOOLBAR ICON (Chromium only) ===
  // Chromium MV3 ignores manifest "theme_icons", so notify the background to
  // switch icon.png (dark-on-light) ↔ icon-light.png (light-on-dark).
  try {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const sendTheme = () => {
      try { browser.runtime.sendMessage({ type: 'set_theme_icon', dark: mql.matches }); } catch (e) {}
    };
    sendTheme();
    if (mql.addEventListener) mql.addEventListener('change', sendTheme);
    else if (mql.addListener) mql.addListener(sendTheme);
  } catch (e) {}
})();
