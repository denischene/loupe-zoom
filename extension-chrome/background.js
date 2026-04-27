// Service worker (MV3) — Chrome / Edge
// Loads the polyfill so we can use `browser.*` like the Firefox version.
importScripts('browser-polyfill.js');

const activeTabs = new Set();

// === PDF interception via declarativeNetRequest ===
// Redirect HTTP(S) and file:// PDF requests to our bundled PDF.js viewer so
// the loupe can run on a real HTML/canvas page (Chromium's native PDF plugin
// is out-of-process and not capturable via captureVisibleTab).
const VIEWER_URL = chrome.runtime.getURL('pdfjs/web/viewer.html');

async function registerPdfRedirect() {
  try {
    const rules = [
      {
        id: 1,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: { regexSubstitution: VIEWER_URL + '?file=\\0' }
        },
        condition: {
          regexFilter: '^https?://.*\\.pdf(\\?.*)?$',
          resourceTypes: ['main_frame', 'sub_frame']
        }
      },
      {
        id: 2,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: { regexSubstitution: VIEWER_URL + '?file=\\0' }
        },
        condition: {
          regexFilter: '^file://.*\\.pdf$',
          resourceTypes: ['main_frame', 'sub_frame']
        }
      }
    ];
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [1, 2],
      addRules: rules
    });
  } catch (e) {
    console.warn('Loupe: DNR registration failed', e);
  }
}
chrome.runtime.onInstalled.addListener(registerPdfRedirect);
chrome.runtime.onStartup.addListener(registerPdfRedirect);
registerPdfRedirect();


// Apply the toolbar icon based on the requested dark-mode flag.
// We render the PNG into an OffscreenCanvas → ImageData because Edge MV3
// sometimes ignores `setIcon({ path: ... })` updates from a service worker
// (the image stays at the manifest default). ImageData updates are reliable.
async function applyToolbarIcon(dark) {
  const file = dark ? 'icon-light.png' : 'icon.png';
  try {
    const url = chrome.runtime.getURL(file);
    const sizes = [16, 32, 48, 128];
    const imageData = {};
    const blob = await (await fetch(url)).blob();
    const bitmap = await createImageBitmap(blob);
    for (const size of sizes) {
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(bitmap, 0, 0, size, size);
      imageData[size] = ctx.getImageData(0, 0, size, size);
    }
    await new Promise((resolve) => {
      chrome.action.setIcon({ imageData }, () => { void chrome.runtime.lastError; resolve(); });
    });
  } catch (e) {
    // Fallback to path-based call.
    try {
      chrome.action.setIcon({ path: { 16: file, 32: file, 48: file, 128: file } }, () => void chrome.runtime.lastError);
    } catch (e2) {}
  }
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

// Force-inject the content script + CSS into a tab. Used for PDF pages where
// the static `content_scripts` declaration may not auto-inject.
async function ensureInjected(tabId) {
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['loupe.css'] });
  } catch (e) { /* may already be injected */ }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['browser-polyfill.js', 'content.js']
    });
  } catch (e) { /* may already be injected or be a restricted page */ }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-loupe') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]) return;
      const tabId = tabs[0].id;
      const url = tabs[0].url || '';
      const isPdf = /\.pdf($|\?|#)/i.test(url) || url.startsWith('file://');
      if (isPdf) await ensureInjected(tabId);
      chrome.tabs.sendMessage(tabId, { type: 'toggle_loupe' }, () => void chrome.runtime.lastError);
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

// Also re-query when a tab finishes loading (handles internal/new pages).
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete' || !tab.active) return;
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
