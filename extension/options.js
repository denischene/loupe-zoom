(() => {
  const select = document.getElementById('default-zoom');
  const savedMsg = document.getElementById('saved-msg');

  for (let i = 2; i <= 15; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = '\u00d7' + i;
    select.appendChild(opt);
  }

  browser.storage.local.get('defaultZoom').then((data) => {
    select.value = data.defaultZoom || 5;
  });

  select.addEventListener('change', () => {
    const val = parseInt(select.value, 10);
    browser.storage.local.set({ defaultZoom: val });

    // Notify all content scripts
    browser.tabs.query({}).then((tabs) => {
      tabs.forEach((tab) => {
        browser.tabs.sendMessage(tab.id, { type: 'update_default_zoom', zoom: val }).catch(() => {});
      });
    });

    savedMsg.classList.add('show');
    setTimeout(() => savedMsg.classList.remove('show'), 1500);
  });
})();
