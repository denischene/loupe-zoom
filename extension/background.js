browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'capture') {
    return browser.tabs.captureVisibleTab(null, { format: 'png' });
  }
  // When a link opens a new tab while loupe is active, activate loupe there
  if (msg.type === 'loupe_new_tab') {
    const zoomLevel = msg.zoom || 5;
    // Listen for new tabs and inject loupe state
    const listener = (tab) => {
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onCreated.removeListener(listener);
    };
    // We store the zoom to pass along; the content script restores via sessionStorage
    // For cross-origin new tabs, we rely on the content script's own restoreState
    return Promise.resolve();
  }
});
