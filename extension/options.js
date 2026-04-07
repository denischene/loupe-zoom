(() => {
  const mouseSelect = document.getElementById('mouse-zoom');
  const focusSelect = document.getElementById('focus-zoom');
  const magnifierSelect = document.getElementById('magnifier-zoom');
  const savedMsg = document.getElementById('saved-msg');

  // Loupe souris: ×2 to ×4
  for (let i = 2; i <= 4; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = '\u00d7' + i;
    mouseSelect.appendChild(opt);
  }

  // Focus-loupe: ×2 to ×9
  for (let i = 2; i <= 9; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = '\u00d7' + i;
    focusSelect.appendChild(opt);
  }

  // Agrandisseur: ×8 to ×20
  for (let i = 8; i <= 20; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = '\u00d7' + i;
    magnifierSelect.appendChild(opt);
  }

  browser.storage.local.get(['mouseZoom', 'focusZoom', 'magnifierZoom']).then((data) => {
    mouseSelect.value = data.mouseZoom || 2;
    focusSelect.value = data.focusZoom || 5;
    magnifierSelect.value = data.magnifierZoom || 8;
  });

  function saveAndBroadcast(key, value) {
    const obj = {};
    obj[key] = value;
    browser.storage.local.set(obj);

    browser.tabs.query({}).then((tabs) => {
      tabs.forEach((tab) => {
        browser.tabs.sendMessage(tab.id, { type: 'update_zoom_setting', key, value }).catch(() => {});
      });
    });

    savedMsg.classList.add('show');
    setTimeout(() => savedMsg.classList.remove('show'), 1500);
  }

  mouseSelect.addEventListener('change', () => {
    saveAndBroadcast('mouseZoom', parseInt(mouseSelect.value, 10));
  });

  focusSelect.addEventListener('change', () => {
    saveAndBroadcast('focusZoom', parseInt(focusSelect.value, 10));
  });

  magnifierSelect.addEventListener('change', () => {
    saveAndBroadcast('magnifierZoom', parseInt(magnifierSelect.value, 10));
  });
})();
