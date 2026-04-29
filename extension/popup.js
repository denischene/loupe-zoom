(() => {
  const mouseSelect = document.getElementById('mouse-zoom');
  const focusSelect = document.getElementById('focus-zoom');
  const magnifierSelect = document.getElementById('magnifier-zoom');
  const activateMouseBtn = document.getElementById('activate-mouse');
  const activateFocusBtn = document.getElementById('activate-focus');
  const activateMagnifierBtn = document.getElementById('activate-magnifier');
  const toggleExtensionBtn = document.getElementById('toggle-extension');

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

    toggleExtensionBtn.classList.remove('deactivate', 'neutral');
    toggleExtensionBtn.disabled = false;
    if (state === 'pending') {
      toggleExtensionBtn.textContent = CHECK + 'Désactiver l’extension';
      toggleExtensionBtn.classList.add('deactivate');
    } else if (state === 'active_mouse' || state === 'active_focus' || state === 'active_magnifier') {
      toggleExtensionBtn.textContent = CHECK + 'Extension active';
      toggleExtensionBtn.classList.add('neutral');
      toggleExtensionBtn.disabled = true;
    } else {
      toggleExtensionBtn.textContent = 'Activer l’extension';
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

  async function sendToActiveTab(msg) {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        // If switching from another active mode, deactivate first so the
        // content script properly tears down focus/magnifier state before
        // entering the new mode. (Firefox needs this explicit sequence.)
        if ((msg.type === 'activate_mouse' || msg.type === 'activate_focus' || msg.type === 'activate_magnifier')
            && currentState && currentState !== 'off' && currentState !== msg.type) {
          try { await browser.tabs.sendMessage(tabs[0].id, { type: 'deactivate' }); } catch (e) {}
        }
        try { await browser.tabs.sendMessage(tabs[0].id, msg); } catch (e) {}
      }
    } catch (e) {}
  }

  // Activate buttons
  activateMouseBtn.addEventListener('click', async () => {
    if (currentState === 'active_mouse') {
      await sendToActiveTab({ type: 'deactivate' });
      updateButtons('off');
    } else {
      await sendToActiveTab({ type: 'activate_mouse' });
      updateButtons('active_mouse');
    }
    window.close();
  });

  activateFocusBtn.addEventListener('click', async () => {
    if (currentState === 'active_focus') {
      await sendToActiveTab({ type: 'deactivate' });
      updateButtons('off');
    } else {
      await sendToActiveTab({ type: 'activate_focus' });
      updateButtons('active_focus');
    }
    window.close();
  });

  activateMagnifierBtn.addEventListener('click', async () => {
    if (currentState === 'active_magnifier') {
      await sendToActiveTab({ type: 'deactivate' });
      updateButtons('off');
    } else {
      await sendToActiveTab({ type: 'activate_magnifier' });
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

  toggleExtensionBtn.addEventListener('click', async () => {
    if (currentState === 'active_mouse' || currentState === 'active_focus' || currentState === 'active_magnifier') return;
    if (currentState === 'pending') {
      await sendToActiveTab({ type: 'deactivate' });
      updateButtons('off');
    } else {
      await sendToActiveTab({ type: 'toggle_loupe' });
      updateButtons('pending');
    }
    window.close();
  });
})();
