// Handle capture requests
browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'capture') {
    return browser.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 85 });
  }
  return false;
});

// Toolbar button click toggles loupe
browser.browserAction.onClicked.addListener((tab) => {
  browser.tabs.sendMessage(tab.id, { type: 'toggle_loupe' }).catch(() => {});
});

// Keyboard command from Firefox shortcut management
browser.commands.onCommand.addListener((command) => {
  if (command === 'toggle-loupe') {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        browser.tabs.sendMessage(tabs[0].id, { type: 'toggle_loupe' }).catch(() => {});
      }
    });
  }
});
