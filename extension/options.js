const apiKeyInput = document.getElementById('apiKey');
const toneSelect = document.getElementById('tone');
const languageSelect = document.getElementById('language');
const nativeLanguageSelect = document.getElementById('nativeLanguage');
const textImprovementToggle = document.getElementById('textImprovementEnabled');
const fluentifyToggle = document.getElementById('fluentifyEnabled');
const explainToggle = document.getElementById('explainEnabled');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');

function updateDisabledStates() {
  const textImprovementOn = textImprovementToggle.checked;
  languageSelect.disabled = !textImprovementOn;
  toneSelect.disabled = !textImprovementOn;
  nativeLanguageSelect.disabled = !explainToggle.checked;
}

textImprovementToggle.addEventListener('change', updateDisabledStates);
fluentifyToggle.addEventListener('change', updateDisabledStates);
explainToggle.addEventListener('change', updateDisabledStates);

chrome.storage.sync.get(
  ['geminiApiKey', 'language', 'nativeLanguage', 'textImprovementEnabled', 'fluentifyEnabled', 'explainEnabled', 'tone'],
  (data) => {
    if (data.geminiApiKey) apiKeyInput.value = data.geminiApiKey;
    if (data.language) languageSelect.value = data.language;
    if (data.nativeLanguage) nativeLanguageSelect.value = data.nativeLanguage;
    if (data.tone) toneSelect.value = data.tone;
    textImprovementToggle.checked = data.textImprovementEnabled !== false;
    fluentifyToggle.checked = data.fluentifyEnabled !== false;
    explainToggle.checked = data.explainEnabled !== false;
    updateDisabledStates();
  }
);

saveBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    statusEl.textContent = 'Please enter a valid API key.';
    statusEl.style.color = '#e74c3c';
    return;
  }
  chrome.storage.sync.set({
    geminiApiKey: key,
    tone: toneSelect.value,
    language: languageSelect.value,
    nativeLanguage: nativeLanguageSelect.value,
    textImprovementEnabled: textImprovementToggle.checked,
    fluentifyEnabled: fluentifyToggle.checked,
    explainEnabled: explainToggle.checked,
  }, () => {
    statusEl.textContent = 'Saved!';
    statusEl.style.color = '#4ecca3';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  });
});
