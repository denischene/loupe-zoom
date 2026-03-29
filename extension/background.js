// Track which tabs have loupe active/pending
const activeTabs = new Set();

// Handle capture requests
browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'capture') {
    return browser.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 85 });
  }
  if (msg.type === 'loupe_active' && sender.tab) {
    activeTabs.add(sender.tab.id);
  }
  if (msg.type === 'loupe_off' && sender.tab) {
    activeTabs.delete(sender.tab.id);
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

// When a new tab is opened from a tab with active loupe, start in pending mode
browser.tabs.onCreated.addListener((tab) => {
  if (tab.openerTabId && activeTabs.has(tab.openerTabId)) {
    const sendPending = (attempts) => {
      browser.tabs.sendMessage(tab.id, { type: 'start_pending' }).catch(() => {
        if (attempts < 15) setTimeout(() => sendPending(attempts + 1), 300);
      });
    };
    setTimeout(() => sendPending(0), 500);
  }
});

// Clean up on tab close
browser.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});
