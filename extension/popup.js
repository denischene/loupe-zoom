(() => {
  const toggleBtn = document.getElementById('toggle');
  const mouseSelect = document.getElementById('mouse-zoom');
  const focusSelect = document.getElementById('focus-zoom');
  const magnifierSelect = document.getElementById('magnifier-zoom');

  // Populate selects
  // Loupe souris: ×2 to ×4, default ×2
  for (let i = 2; i <= 4; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = '\u00d7' + i;
    mouseSelect.appendChild(opt);
  }

  // Focus-loupe: ×2 to ×9, default ×5
  for (let i = 2; i <= 9; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = '\u00d7' + i;
    focusSelect.appendChild(opt);
  }

  // Agrandisseur: ×8 to ×20, default ×8
  for (let i = 8; i <= 20; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = '\u00d7' + i;
    magnifierSelect.appendChild(opt);
  }

  // Load saved values
  browser.storage.local.get(['mouseZoom', 'focusZoom', 'magnifierZoom']).then((data) => {
    mouseSelect.value = data.mouseZoom || 2;
    focusSelect.value = data.focusZoom || 5;
    magnifierSelect.value = data.magnifierZoom || 8;
  });

  // Check current state from active tab
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    if (tabs[0]) {
      browser.tabs.sendMessage(tabs[0].id, { type: 'get_state' }).then((response) => {
        if (response && response.state !== 'off') {
          toggleBtn.textContent = 'Activé';
          toggleBtn.className = 'toggle-btn on';
        }
      }).catch(() => {});
    }
  });

  // Toggle
  toggleBtn.addEventListener('click', () => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        browser.tabs.sendMessage(tabs[0].id, { type: 'toggle_loupe' }).catch(() => {});
      }
    });
    // Toggle visual
    if (toggleBtn.classList.contains('off')) {
      toggleBtn.textContent = 'Activé';
      toggleBtn.className = 'toggle-btn on';
    } else {
      toggleBtn.textContent = 'Désactivé';
      toggleBtn.className = 'toggle-btn off';
    }
  });

  // Save and broadcast zoom changes
  function saveAndBroadcast(key, value) {
    const obj = {};
    obj[key] = value;
    browser.storage.local.set(obj);
    browser.tabs.query({}).then((tabs) => {
      tabs.forEach((tab) => {
        browser.tabs.sendMessage(tab.id, { type: 'update_zoom_setting', key, value }).catch(() => {});
      });
    });
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
