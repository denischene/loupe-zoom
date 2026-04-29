(() => {
  // Refresh the toolbar icon based on the popup's color scheme. The popup
  // honors the system theme even on internal Edge pages where no content
  // script can report it.
  try {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    chrome.runtime.sendMessage({ type: 'set_theme_icon', dark });
  } catch (e) {}

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

  function sendToActiveTab(msg) {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (!tabs[0]) return;
      const tabId = tabs[0].id;
      const url = tabs[0].url || '';
      const isViewer = url.indexOf(chrome.runtime.getURL('pdfjs/web/viewer.html')) === 0;
      const isPdf = !isViewer && (/\.pdf($|\?|#)/i.test(url) || url.startsWith('file://'));
      const send = () => browser.tabs.sendMessage(tabId, msg).catch(() => {});
      if (isPdf && chrome.scripting) {
        // Force-inject for PDF pages where content_scripts may not auto-load.
        chrome.scripting.insertCSS({ target: { tabId }, files: ['loupe.css'] }).catch(() => {});
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['browser-polyfill.js', 'content.js']
        }).then(send, send);
      } else {
        send();
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

  // Debug mode toggle
  const toggleDebugBtn = document.getElementById('toggle-debug');
  let debugOn = false;
  function updateDebugBtn() {
    if (debugOn) {
      toggleDebugBtn.textContent = '🐞 ✔ Désactiver le mode débogage';
      toggleDebugBtn.classList.add('deactivate');
    } else {
      toggleDebugBtn.textContent = '🐞 Activer le mode débogage';
      toggleDebugBtn.classList.remove('deactivate');
    }
  }
  browser.storage.local.get(['loupeDebug']).then((d) => {
    debugOn = !!(d && d.loupeDebug);
    updateDebugBtn();
  });
  toggleDebugBtn.addEventListener('click', () => {
    debugOn = !debugOn;
    updateDebugBtn();
    try { browser.storage.local.set({ loupeDebug: debugOn }); } catch (e) {}
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        browser.tabs.sendMessage(tabs[0].id, { type: 'set_debug', value: debugOn }).catch(() => {});
      }
    });
  });
})();
