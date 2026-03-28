browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'capture') {
    return browser.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 80 });
  }
  return false;
});
