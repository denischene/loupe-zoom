(() => {
  let active = false;
  let loupe = null;
  let crosshair = null;
  let mouseX = 0;
  let mouseY = 0;
  let rafId = null;
  let captureImg = null;
  let captureTime = 0;

  let zoom = 5;
  const SIZE = 180;
  const CAPTURE_INTERVAL = 100;
  const MIN_ZOOM = 2;
  const MAX_ZOOM = 20;

  function createLoupe() {
    if (loupe) return;
    loupe = document.createElement('div');
    loupe.id = 'loupe-overlay';

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

    loupe.style.left = mouseX + 'px';
    loupe.style.top = mouseY + 'px';
    loupe.style.display = 'block';

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    const bgW = vpW * zoom;
    const bgH = vpH * zoom;

    const bgX = -mouseX * zoom + halfSize;
    const bgY = -mouseY * zoom + halfSize;

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

  function adjustZoom(delta) {
    if (!active) return;
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));
    updateLoupe();
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
      return;
    }
    if (active) {
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        adjustZoom(1);
      } else if (e.key === '-') {
        e.preventDefault();
        adjustZoom(-1);
      }
    }
  }, true);

  document.addEventListener('wheel', (e) => {
    if (!active) return;
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
})();
