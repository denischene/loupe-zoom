(() => {
  let active = false;
  let loupe = null;
  let mouseX = 0;
  let mouseY = 0;
  let rafId = null;

  const ZOOM = 5;
  const SIZE = 200;

  function createLoupe() {
    if (loupe) return;
    loupe = document.createElement('div');
    loupe.id = 'loupe-overlay';
    document.body.appendChild(loupe);
  }

  function ensureSourceId() {
    // We need an ID on the element to reference with -moz-element()
    if (!document.body.id) {
      document.body.id = 'loupe-page-source';
    }
    return document.body.id;
  }

  function updateLoupe() {
    if (!active || !loupe) return;

    const halfSize = SIZE / 2;
    const originX = mouseX + window.scrollX;
    const originY = mouseY + window.scrollY;
    const sourceId = ensureSourceId();

    loupe.style.left = mouseX + 'px';
    loupe.style.top = mouseY + 'px';
    loupe.style.display = 'block';

    // Firefox-specific: -moz-element() renders a live snapshot of the referenced element
    loupe.style.background = `-moz-element(#${sourceId}) no-repeat`;
    loupe.style.backgroundSize = `${document.body.scrollWidth * ZOOM}px ${document.body.scrollHeight * ZOOM}px`;
    loupe.style.backgroundPosition = `${-originX * ZOOM + halfSize}px ${-originY * ZOOM + halfSize}px`;
  }

  function toggle() {
    active = !active;
    createLoupe();
    if (active) {
      document.body.classList.add('loupe-active');
      updateLoupe();
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
    if (active && !rafId) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateLoupe();
      });
    }
  });

  document.addEventListener('scroll', () => {
    if (active && !rafId) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateLoupe();
      });
    }
  }, true);
})();
