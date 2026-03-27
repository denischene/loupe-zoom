(() => {
  let active = false;
  let loupe = null;
  let crosshair = null;
  let mouseX = 0;
  let mouseY = 0;
  let rafId = null;
  let captureImg = null;
  let captureTime = 0;

  const ZOOM = 5;
  const SIZE = 180;
  const CAPTURE_INTERVAL = 100; // ms between recaptures

  function createLoupe() {
    if (loupe) return;
    loupe = document.createElement('div');
    loupe.id = 'loupe-overlay';

    // Crosshair
    crosshair = document.createElement('div');
    crosshair.id = 'loupe-crosshair';
    loupe.appendChild(crosshair);

    document.body.appendChild(loupe);
  }

  function capture() {
    const now = Date.now();
    if (now - captureTime < CAPTURE_INTERVAL) return;
    captureTime = now;
    browser.runtime.sendMessage({ type: 'capture' }).then((dataUrl) => {
      if (dataUrl) {
        captureImg = dataUrl;
        updateLoupe();
      }
    }).catch(() => {});
  }

  function updateLoupe() {
    if (!active || !loupe || !captureImg) return;

    const halfSize = SIZE / 2;
    const dpr = window.devicePixelRatio || 1;

    // Position loupe at cursor
    loupe.style.left = mouseX + 'px';
    loupe.style.top = mouseY + 'px';
    loupe.style.display = 'block';

    // The captured image represents the viewport at device resolution
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    // Scale the screenshot by ZOOM
    const bgW = vpW * ZOOM;
    const bgH = vpH * ZOOM;

    // Offset so the cursor point is centered in the loupe
    const bgX = -mouseX * ZOOM + halfSize;
    const bgY = -mouseY * ZOOM + halfSize;

    loupe.style.backgroundImage = `url(${captureImg})`;
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

  function toggle() {
    active = !active;
    createLoupe();
    if (active) {
      document.body.classList.add('loupe-active');
      capture();
    } else {
      document.body.classList.remove('loupe-active');
      loupe.style.display = 'none';
      captureImg = null;
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
})();
