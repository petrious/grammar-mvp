chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const siteNameEl = document.getElementById('siteName');
  const siteToggle = document.getElementById('siteToggle');

  if (!tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    siteNameEl.textContent = 'N/A (system page)';
    siteToggle.disabled = true;
    return;
  }

  let hostname;
  try {
    hostname = new URL(tab.url).hostname;
  } catch {
    siteNameEl.textContent = 'Unknown site';
    siteToggle.disabled = true;
    return;
  }

  siteNameEl.textContent = hostname;

  chrome.storage.sync.get(['disabledSites'], (data) => {
    const disabledSites = data.disabledSites || [];
    siteToggle.checked = !disabledSites.includes(hostname);
  });

  siteToggle.addEventListener('change', () => {
    chrome.storage.sync.get(['disabledSites'], (data) => {
      let disabledSites = data.disabledSites || [];
      if (siteToggle.checked) {
        disabledSites = disabledSites.filter(s => s !== hostname);
      } else {
        if (!disabledSites.includes(hostname)) {
          disabledSites.push(hostname);
        }
      }
      chrome.storage.sync.set({ disabledSites });
    });
  });
});

document.getElementById('openSettings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
