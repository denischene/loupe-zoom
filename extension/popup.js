(() => {
  const mouseSelect = document.getElementById('mouse-zoom');
  const focusSelect = document.getElementById('focus-zoom');
  const magnifierSelect = document.getElementById('magnifier-zoom');
  const activateMouseBtn = document.getElementById('activate-mouse');
  const activateFocusBtn = document.getElementById('activate-focus');
  const activateMagnifierBtn = document.getElementById('activate-magnifier');

  // Populate selects
  for (let i = 2; i <= 4; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = '\u00d7' + i;
    mouseSelect.appendChild(opt);
  }
  for (let i = 2; i <= 9; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = '\u00d7' + i;
    focusSelect.appendChild(opt);
  }
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

  // Current active state tracking
  let currentState = 'off';

  function updateButtons(state) {
    currentState = state;
    const CHECK = '\u2714 ';

    // Mouse button
    if (state === 'active_mouse') {
      activateMouseBtn.textContent = CHECK + 'Désactiver la Loupe souris';
      activateMouseBtn.classList.add('deactivate');
    } else {
      activateMouseBtn.textContent = 'Activer la Loupe souris';
      activateMouseBtn.classList.remove('deactivate');
    }

    // Focus button
    if (state === 'active_focus') {
      activateFocusBtn.textContent = CHECK + 'Désactiver le Focus-loupe';
      activateFocusBtn.classList.add('deactivate');
    } else {
      activateFocusBtn.textContent = 'Activer le Focus-loupe';
      activateFocusBtn.classList.remove('deactivate');
    }

    // Magnifier button
    if (state === 'active_magnifier') {
      activateMagnifierBtn.textContent = CHECK + "Désactiver l'Agrandisseur";
      activateMagnifierBtn.classList.add('deactivate');
    } else {
      activateMagnifierBtn.textContent = "Activer l'Agrandisseur";
      activateMagnifierBtn.classList.remove('deactivate');
    }
  }

  // Check current state
  browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
    if (tabs[0]) {
      browser.tabs.sendMessage(tabs[0].id, { type: 'get_state' }).then((response) => {
        if (response) updateButtons(response.state);
      }).catch(() => {});
    }
  });

  function sendToActiveTab(msg) {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        browser.tabs.sendMessage(tabs[0].id, msg).catch(() => {});
      }
    });
  }

  // Activate buttons
  activateMouseBtn.addEventListener('click', () => {
    if (currentState === 'active_mouse') {
      sendToActiveTab({ type: 'deactivate' });
      updateButtons('off');
    } else {
      sendToActiveTab({ type: 'activate_mouse' });
      updateButtons('active_mouse');
    }
    window.close();
  });

  activateFocusBtn.addEventListener('click', () => {
    if (currentState === 'active_focus') {
      sendToActiveTab({ type: 'deactivate' });
      updateButtons('off');
    } else {
      sendToActiveTab({ type: 'activate_focus' });
      updateButtons('active_focus');
    }
    window.close();
  });

  activateMagnifierBtn.addEventListener('click', () => {
    if (currentState === 'active_magnifier') {
      sendToActiveTab({ type: 'deactivate' });
      updateButtons('off');
    } else {
      sendToActiveTab({ type: 'activate_magnifier' });
      updateButtons('active_magnifier');
    }
    window.close();
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