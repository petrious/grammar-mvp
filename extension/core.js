const GEMINI_MODEL = 'gemini-2.0-flash-lite';

const TONE_INSTRUCTIONS = {
  casual: {
    description: 'casual everyday chat',
    rules:
      `Use a natural, casual and friendly tone. This is everyday chat.\n` +
      `Use contractions (I'm, don't, I'll, they're). Avoid stiff/formal phrasing.\n` +
      `Keep it concise and conversational.`,
  },
  professional: {
    description: 'professional workplace communication',
    rules:
      `Use a professional but approachable tone. Suitable for workplace emails, Slack with managers, and team communication.\n` +
      `Use "I believe" instead of "I think". Use "What are your thoughts?" instead of "What do you think?".\n` +
      `Avoid comma splices — use proper sentence separation.\n` +
      `Sound competent and clear. Avoid filler words and redundancy.\n` +
      `Contractions are OK (it's, don't) but don't overuse them.`,
  },
  executive: {
    description: 'senior-level executive communication',
    rules:
      `Use a polished, confident and strategic tone. This is executive-level communication.\n` +
      `Use "I believe", "I'd recommend", "There's an opportunity to". Never use "I think".\n` +
      `Prefer active voice and decisive language. Sound like a senior leader.\n` +
      `Be precise and structured. Every word should add value.\n` +
      `Avoid contractions when possible. Use full forms (do not, I would, we will).\n` +
      `Avoid comma splices — use proper punctuation and sentence structure.`,
  },
};

function buildSystemPrompt(language, nativeLanguage, tone = 'casual') {
  const toneConfig = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.casual;
  return `You are a ${language} writing assistant for ${toneConfig.description}.\n` +
    `RULES:\n` +
    `1. The output MUST ALWAYS be in ${language}, no matter what language the input is in.\n` +
    `2. If the input is in ${nativeLanguage || 'another language'} or any other language, translate it to ${language}.\n` +
    `3. If the input is already in ${language}, just fix grammar and spelling.\n` +
    `4. If the input mixes languages, translate everything to ${language} and fix grammar.\n` +
    `5. ${toneConfig.rules}\n` +
    `6. Keep the original meaning and intent.\n` +
    `7. PRESERVE all @mentions exactly as they appear (e.g. @john, @channel, @here). Never translate, remove or modify them.\n` +
    `8. PRESERVE line breaks, paragraph structure, and formatting (use \\n for line breaks).\n` +
    `9. Reply ONLY with the improved ${language} text, nothing else.`;
}

function buildExplainPrompt(nativeLanguage) {
  return `You are a translator. The user selected text and wants to understand it in ${nativeLanguage}.\n` +
    `IMPORTANT: Your task is to TRANSLATE or EXPLAIN the selected text in ${nativeLanguage} ONLY.\n` +
    `Do NOT respond conversationally. Do NOT answer questions conversationally.\n` +
    `If the text is a question, translate it as a question, do not answer it.\n` +
    `If the text is a statement, translate or explain it. Be concise and natural.\n` +
    `If it contains idioms or slang, explain them briefly in ${nativeLanguage}.\n` +
    `Reply ONLY in ${nativeLanguage}. Nothing else.`;
}

function buildGeminiRequestBody(text, systemPrompt) {
  return {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 512,
    },
  };
}

function getGeminiUrl(apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
}

function extractGeminiResult(data) {
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

async function callGeminiWithPrompt(text, apiKey, systemPrompt, retries = 2) {
  const url = getGeminiUrl(apiKey);
  const body = buildGeminiRequestBody(text, systemPrompt);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 429 && attempt < retries) {
        const wait = 1000 * (attempt + 1);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API ${res.status}: ${err}`);
      }

      const data = await res.json();
      const result = extractGeminiResult(data);
      if (!result) throw new Error('Empty response from Gemini');
      return result;
    } catch (e) {
      if (attempt === retries) throw e;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GEMINI_MODEL,
    TONE_INSTRUCTIONS,
    buildSystemPrompt,
    buildExplainPrompt,
    buildGeminiRequestBody,
    getGeminiUrl,
    extractGeminiResult,
    callGeminiWithPrompt,
  };
}
