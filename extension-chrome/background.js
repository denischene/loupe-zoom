// Service worker (MV3) — Chrome / Edge
// Loads the polyfill so we can use `browser.*` like the Firefox version.
importScripts('browser-polyfill.js');

const activeTabs = new Set();

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'capture') {
    // Use chrome API directly to return a promise-like via sendResponse.
    chrome.tabs.captureVisibleTab(undefined, { format: 'jpeg', quality: 85 }, (dataUrl) => {
      sendResponse(dataUrl);
    });
    return true; // async response
  }
  if (msg && msg.type === 'loupe_active' && sender.tab) {
    activeTabs.add(sender.tab.id);
  }
  if (msg && msg.type === 'loupe_off' && sender.tab) {
    activeTabs.delete(sender.tab.id);
  }
  if (msg && msg.type === 'set_theme_icon') {
    // Chromium MV3 does not support manifest "theme_icons", so we switch the
    // toolbar icon dynamically based on the page's prefers-color-scheme.
    const path = msg.dark ? 'icon-light.png' : 'icon.png';
    try {
      chrome.action.setIcon({ path: { 48: path, 128: path } }, () => void chrome.runtime.lastError);
    } catch (e) {}
  }
  return false;
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-loupe') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'toggle_loupe' }, () => void chrome.runtime.lastError);
      }
    });
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.openerTabId && activeTabs.has(tab.openerTabId)) {
    const sendPending = (attempts) => {
      chrome.tabs.sendMessage(tab.id, { type: 'start_pending' }, () => {
        if (chrome.runtime.lastError && attempts < 15) {
          setTimeout(() => sendPending(attempts + 1), 300);
        }
      });
    };
    setTimeout(() => sendPending(0), 500);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});
