/*
 * Minimal cross-browser polyfill: exposes `browser.*` mapped to `chrome.*`
 * with promise-returning APIs used by Loupe Zoom.
 *
 * Covers only the surface used by this extension:
 * - browser.runtime.sendMessage / onMessage
 * - browser.tabs.query / sendMessage / captureVisibleTab / onCreated / onRemoved
 * - browser.storage.local.get / set
 * - browser.commands.onCommand
 */
(function () {
  if (typeof globalThis.browser !== 'undefined' && globalThis.browser && globalThis.browser.runtime && globalThis.browser.runtime.id) {
    return; // real Firefox API present
  }
  if (typeof chrome === 'undefined') return;

  function promisify(fn, ctx) {
    return function (...args) {
      return new Promise((resolve, reject) => {
        try {
          fn.call(ctx, ...args, (result) => {
            const err = chrome.runtime && chrome.runtime.lastError;
            if (err) reject(new Error(err.message || String(err)));
            else resolve(result);
          });
        } catch (e) { reject(e); }
      });
    };
  }

  const b = {
    runtime: {
      sendMessage: promisify(chrome.runtime.sendMessage, chrome.runtime),
      onMessage: {
        addListener(listener) {
          chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            const result = listener(msg, sender, sendResponse);
            if (result && typeof result.then === 'function') {
              result.then((r) => { try { sendResponse(r); } catch (e) {} },
                          (e) => { try { sendResponse(undefined); } catch (_) {} });
              return true; // keep channel open for async response
            }
            return result;
          });
        },
        removeListener(l) { chrome.runtime.onMessage.removeListener(l); }
      },
      get id() { return chrome.runtime && chrome.runtime.id; },
      get lastError() { return chrome.runtime && chrome.runtime.lastError; }
    },
    tabs: {
      query: promisify(chrome.tabs && chrome.tabs.query, chrome.tabs),
      sendMessage: function (tabId, msg) {
        return new Promise((resolve, reject) => {
          try {
            chrome.tabs.sendMessage(tabId, msg, (response) => {
              const err = chrome.runtime && chrome.runtime.lastError;
              if (err) reject(new Error(err.message || String(err)));
              else resolve(response);
            });
          } catch (e) { reject(e); }
        });
      },
      captureVisibleTab: function (windowId, options) {
        return new Promise((resolve, reject) => {
          try {
            const cb = (dataUrl) => {
              const err = chrome.runtime && chrome.runtime.lastError;
              if (err) reject(new Error(err.message || String(err)));
              else resolve(dataUrl);
            };
            // chrome.tabs.captureVisibleTab signature: (windowId?, options?, callback)
            if (windowId == null) chrome.tabs.captureVisibleTab(options || {}, cb);
            else chrome.tabs.captureVisibleTab(windowId, options || {}, cb);
          } catch (e) { reject(e); }
        });
      },
      onCreated: chrome.tabs && chrome.tabs.onCreated,
      onRemoved: chrome.tabs && chrome.tabs.onRemoved
    },
    storage: {
      local: {
        get: function (keys) {
          return new Promise((resolve, reject) => {
            try {
              chrome.storage.local.get(keys, (items) => {
                const err = chrome.runtime && chrome.runtime.lastError;
                if (err) reject(new Error(err.message || String(err)));
                else resolve(items);
              });
            } catch (e) { reject(e); }
          });
        },
        set: function (items) {
          return new Promise((resolve, reject) => {
            try {
              chrome.storage.local.set(items, () => {
                const err = chrome.runtime && chrome.runtime.lastError;
                if (err) reject(new Error(err.message || String(err)));
                else resolve();
              });
            } catch (e) { reject(e); }
          });
        }
      }
    },
    commands: chrome.commands ? {
      onCommand: chrome.commands.onCommand
    } : undefined
  };

  globalThis.browser = b;
})();
