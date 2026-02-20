let currentHostname = null;

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  const siteNameEl = document.getElementById('siteName');
  const toggleTextImprovement = document.getElementById('toggleTextImprovement');
  const toggleFluentify = document.getElementById('toggleFluentify');
  const toggleExplain = document.getElementById('toggleExplain');

  // Get hostname
  if (!tab?.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    siteNameEl.textContent = 'N/A (system page)';
    toggleTextImprovement.disabled = true;
    toggleFluentify.disabled = true;
    toggleExplain.disabled = true;
    return;
  }

  try {
    currentHostname = new URL(tab.url).hostname;
    siteNameEl.textContent = currentHostname;
  } catch (e) {
    siteNameEl.textContent = 'Unknown site';
    toggleTextImprovement.disabled = true;
    toggleFluentify.disabled = true;
    toggleExplain.disabled = true;
    return;
  }

  // Load disabled features for this site
  chrome.storage.sync.get(['disabledFeatures'], (data) => {
    const disabledFeatures = data.disabledFeatures || {};
    const disabledForSite = disabledFeatures[currentHostname] || [];

    toggleTextImprovement.checked = !disabledForSite.includes('textImprovement');
    toggleFluentify.checked = !disabledForSite.includes('fluentify');
    toggleExplain.checked = !disabledForSite.includes('explain');

    // Attach event listeners
    attachToggleListener(toggleTextImprovement, 'textImprovement', disabledFeatures);
    attachToggleListener(toggleFluentify, 'fluentify', disabledFeatures);
    attachToggleListener(toggleExplain, 'explain', disabledFeatures);
  });
});

function attachToggleListener(toggleEl, featureName, disabledFeatures) {
  toggleEl.addEventListener('change', () => {
    // Rebuild disabled features for this site
    let disabledForSite = disabledFeatures[currentHostname] || [];

    if (!toggleEl.checked) {
      // Feature is being disabled — add to list
      if (!disabledForSite.includes(featureName)) {
        disabledForSite.push(featureName);
      }
    } else {
      // Feature is being enabled — remove from list
      disabledForSite = disabledForSite.filter(f => f !== featureName);
    }

    // Update disabledFeatures
    disabledFeatures[currentHostname] = disabledForSite;
    chrome.storage.sync.set({ disabledFeatures }, () => {
      console.log(`Updated ${featureName} for ${currentHostname}`);
    });
  });
}

document.getElementById('openSettings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

