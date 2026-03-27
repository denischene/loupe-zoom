browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'capture') {
    return browser.tabs.captureVisibleTab(null, { format: 'png' });
  }
});
