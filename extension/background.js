// Track which tabs have loupe active/pending
const activeTabs = new Set();

// === PDF interception ===
// Redirect PDF requests to our bundled PDF.js viewer so the loupe can run on
// a regular HTML/canvas page (the native pdf.js viewer in Firefox lives under
// `resource://` and does not allow content scripts).
const VIEWER_URL = browser.runtime.getURL('pdfjs/web/viewer.html');

function isPdfRequest(details) {
  try {
    if (!details || !details.url) return false;
    const url = details.url;
    if (url.startsWith(VIEWER_URL)) return false; // already in viewer
    // Skip range requests (PDF.js itself fetches the file in chunks)
    if (details.requestHeaders) {
      for (const h of details.requestHeaders) {
        if (h.name && h.name.toLowerCase() === 'range') return false;
      }
    }
    // Heuristics: extension in URL, or top-level frame on a .pdf
    if (/\.pdf($|\?|#)/i.test(url)) return true;
  } catch (_) {}
  return false;
}

try {
  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.type !== 'main_frame' && details.type !== 'sub_frame') return {};
      if (!isPdfRequest(details)) return {};
      // Avoid loops
      if (details.url.indexOf(VIEWER_URL) === 0) return {};
      const target = VIEWER_URL + '?file=' + encodeURIComponent(details.url);
      return { redirectUrl: target };
    },
    { urls: ['<all_urls>'], types: ['main_frame', 'sub_frame'] },
    ['blocking']
  );
} catch (e) {
  console.warn('Loupe: webRequest unavailable', e);
}

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
