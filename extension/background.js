importScripts('core.js');

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'ping') {
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === 'check-grammar') {
    chrome.storage.sync.get(['geminiApiKey', 'language', 'nativeLanguage', 'tone'], async (data) => {
      if (!data.geminiApiKey) {
        sendResponse({ error: 'No API key configured. Open extension options to set it.' });
        return;
      }
      try {
        const prompt = buildSystemPrompt(data.language || 'English', data.nativeLanguage, data.tone || 'casual');
        const improved = await callGeminiWithPrompt(msg.text, data.geminiApiKey, prompt);
        sendResponse({ improved });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    });
    return true;
  }

  if (msg.type === 'explain-text') {
    chrome.storage.sync.get(['geminiApiKey', 'nativeLanguage'], async (data) => {
      if (!data.geminiApiKey) {
        sendResponse({ error: 'No API key configured. Open extension options to set it.' });
        return;
      }
      try {
        const prompt = buildExplainPrompt(data.nativeLanguage || 'Portuguese');
        const explanation = await callGeminiWithPrompt(msg.text, data.geminiApiKey, prompt);
        sendResponse({ explanation });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    });
    return true;
  }

  return false;
});
