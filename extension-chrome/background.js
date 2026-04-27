// Service worker (MV3) — Chrome / Edge
// Loads the polyfill so we can use `browser.*` like the Firefox version.
importScripts('browser-polyfill.js');

const activeTabs = new Set();

// Apply the toolbar icon based on the requested dark-mode flag.
function applyToolbarIcon(dark) {
  const path = dark ? 'icon-light.png' : 'icon.png';
  try {
    chrome.action.setIcon({ path: { 48: path, 128: path } }, () => void chrome.runtime.lastError);
  } catch (e) {}
}

// Restore the last known theme on service-worker startup so the toolbar icon
// stays correct on internal pages (where no content script runs to refresh it).
try {
  chrome.storage.local.get(['toolbarDark'], (data) => {
    applyToolbarIcon(!!(data && data.toolbarDark));
  });
} catch (e) {}

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
    try { chrome.storage.local.set({ toolbarDark: !!msg.dark }); } catch (e) {}
    applyToolbarIcon(!!msg.dark);
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

// On tab activation, re-query the active tab's color scheme so the icon
// follows the current page's theme as closely as possible.
chrome.tabs.onActivated.addListener(({ tabId }) => {
  try {
    chrome.tabs.sendMessage(tabId, { type: 'query_theme' }, (resp) => {
      void chrome.runtime.lastError;
      if (resp && typeof resp.dark === 'boolean') {
        try { chrome.storage.local.set({ toolbarDark: !!resp.dark }); } catch (e) {}
        applyToolbarIcon(!!resp.dark);
      }
    });
  } catch (e) {}
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
