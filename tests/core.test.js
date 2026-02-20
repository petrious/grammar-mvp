import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  GEMINI_MODEL,
  TONE_INSTRUCTIONS,
  buildSystemPrompt,
  buildExplainPrompt,
  buildGeminiRequestBody,
  getGeminiUrl,
  extractGeminiResult,
  callGeminiWithPrompt,
} = require('../extension/core.js');

// --- TONE_INSTRUCTIONS ---

describe('TONE_INSTRUCTIONS', () => {
  it('should have casual, professional and executive tones', () => {
    expect(TONE_INSTRUCTIONS).toHaveProperty('casual');
    expect(TONE_INSTRUCTIONS).toHaveProperty('professional');
    expect(TONE_INSTRUCTIONS).toHaveProperty('executive');
  });

  it('each tone should have description and rules', () => {
    for (const tone of Object.values(TONE_INSTRUCTIONS)) {
      expect(tone).toHaveProperty('description');
      expect(tone).toHaveProperty('rules');
      expect(tone.description.length).toBeGreaterThan(0);
      expect(tone.rules.length).toBeGreaterThan(0);
    }
  });
});

// --- buildSystemPrompt ---

describe('buildSystemPrompt', () => {
  it('should include the writing language', () => {
    const prompt = buildSystemPrompt('English', 'Portuguese');
    expect(prompt).toContain('English');
  });

  it('should include the native language', () => {
    const prompt = buildSystemPrompt('English', 'Portuguese');
    expect(prompt).toContain('Portuguese');
  });

  it('should instruct to always output in the writing language', () => {
    const prompt = buildSystemPrompt('English', 'Portuguese');
    expect(prompt).toContain('MUST ALWAYS be in English');
  });

  it('should instruct to translate from native language', () => {
    const prompt = buildSystemPrompt('English', 'Portuguese');
    expect(prompt).toContain('If the input is in Portuguese');
    expect(prompt).toContain('translate it to English');
  });

  it('should handle mixed language input rule', () => {
    const prompt = buildSystemPrompt('English', 'Portuguese');
    expect(prompt).toContain('mixes languages');
    expect(prompt).toContain('translate everything to English');
  });

  it('should default to casual tone', () => {
    const prompt = buildSystemPrompt('English', 'Portuguese');
    expect(prompt).toContain('casual');
    expect(prompt).toContain('contractions');
  });

  it('should support professional tone', () => {
    const prompt = buildSystemPrompt('English', 'Portuguese', 'professional');
    expect(prompt).toContain('professional');
    expect(prompt).toContain('I believe');
    expect(prompt).toContain('comma splices');
  });

  it('should support executive tone', () => {
    const prompt = buildSystemPrompt('English', 'Portuguese', 'executive');
    expect(prompt).toContain('executive');
    expect(prompt).toContain('strategic');
    expect(prompt).toContain('Never use "I think"');
  });

  it('should fallback to casual for unknown tone', () => {
    const prompt = buildSystemPrompt('English', 'Portuguese', 'unknown');
    expect(prompt).toContain('casual');
  });

  it('should instruct to preserve @mentions', () => {
    const prompt = buildSystemPrompt('English', 'Portuguese');
    expect(prompt).toContain('PRESERVE all @mentions');
  });

  it('should fallback when nativeLanguage is undefined', () => {
    const prompt = buildSystemPrompt('English', undefined);
    expect(prompt).toContain('another language');
    expect(prompt).not.toContain('undefined');
  });

  it('should work with non-latin languages', () => {
    const prompt = buildSystemPrompt('Japanese', 'English');
    expect(prompt).toContain('MUST ALWAYS be in Japanese');
    expect(prompt).toContain('If the input is in English');
  });
});

// --- buildExplainPrompt ---

describe('buildExplainPrompt', () => {
  it('should include the native language', () => {
    const prompt = buildExplainPrompt('Portuguese');
    expect(prompt).toContain('Portuguese');
  });

  it('should instruct to explain in native language', () => {
    const prompt = buildExplainPrompt('Portuguese');
    expect(prompt).toContain('Explain the meaning');
    expect(prompt).toContain('Reply ONLY in Portuguese');
  });

  it('should mention idioms and slang', () => {
    const prompt = buildExplainPrompt('Spanish');
    expect(prompt).toContain('idioms');
    expect(prompt).toContain('slang');
  });
});

// --- buildGeminiRequestBody ---

describe('buildGeminiRequestBody', () => {
  it('should build correct request structure', () => {
    const body = buildGeminiRequestBody('hello world', 'You are an assistant.');
    expect(body).toEqual({
      system_instruction: { parts: [{ text: 'You are an assistant.' }] },
      contents: [{ parts: [{ text: 'hello world' }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 512,
      },
    });
  });

  it('should preserve special characters in text', () => {
    const body = buildGeminiRequestBody('I\'m 25 anos de idade', 'prompt');
    expect(body.contents[0].parts[0].text).toBe('I\'m 25 anos de idade');
  });

  it('should preserve unicode in text', () => {
    const body = buildGeminiRequestBody('日本語テスト', 'prompt');
    expect(body.contents[0].parts[0].text).toBe('日本語テスト');
  });
});

// --- getGeminiUrl ---

describe('getGeminiUrl', () => {
  it('should include the API key', () => {
    const url = getGeminiUrl('test-key-123');
    expect(url).toContain('key=test-key-123');
  });

  it('should use the correct model', () => {
    const url = getGeminiUrl('key');
    expect(url).toContain(GEMINI_MODEL);
  });

  it('should point to the Gemini API', () => {
    const url = getGeminiUrl('key');
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain('generateContent');
  });
});

// --- extractGeminiResult ---

describe('extractGeminiResult', () => {
  it('should extract text from valid response', () => {
    const data = {
      candidates: [{ content: { parts: [{ text: '  Hello world  ' }] } }],
    };
    expect(extractGeminiResult(data)).toBe('Hello world');
  });

  it('should return null for empty candidates', () => {
    expect(extractGeminiResult({ candidates: [] })).toBeNull();
  });

  it('should return null for missing parts', () => {
    expect(extractGeminiResult({ candidates: [{ content: {} }] })).toBeNull();
  });

  it('should return null for null data', () => {
    expect(extractGeminiResult(null)).toBeNull();
  });

  it('should return null for undefined data', () => {
    expect(extractGeminiResult(undefined)).toBeNull();
  });

  it('should return null for empty text', () => {
    const data = {
      candidates: [{ content: { parts: [{ text: '   ' }] } }],
    };
    expect(extractGeminiResult(data)).toBeNull();
  });
});

// --- callGeminiWithPrompt ---

describe('callGeminiWithPrompt', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return improved text on success', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: 'I am 25 years old' }] } }],
      }),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const result = await callGeminiWithPrompt('I has 25 years', 'key', 'prompt');
    expect(result).toBe('I am 25 years old');
  });

  it('should send correct request body', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: 'ok' }] } }],
      }),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    await callGeminiWithPrompt('test text', 'my-key', 'system prompt');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('key=my-key'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.system_instruction.parts[0].text).toBe('system prompt');
    expect(body.contents[0].parts[0].text).toBe('test text');
  });

  it('should retry on 429 rate limit', async () => {
    const rateLimitResponse = {
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited'),
    };
    const successResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: 'success' }] } }],
      }),
    };

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(successResponse)
    );

    const result = await callGeminiWithPrompt('test', 'key', 'prompt', 2);
    expect(result).toBe('success');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should throw after exhausting retries on 429', async () => {
    const rateLimitResponse = {
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited'),
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(rateLimitResponse));

    await expect(
      callGeminiWithPrompt('test', 'key', 'prompt', 1)
    ).rejects.toThrow('Gemini API 429');
  });

  it('should throw on non-429 error', async () => {
    const errorResponse = {
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse));

    await expect(
      callGeminiWithPrompt('test', 'key', 'prompt', 0)
    ).rejects.toThrow('Gemini API 403: Forbidden');
  });

  it('should throw on empty response from Gemini', async () => {
    const emptyResponse = {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ candidates: [] }),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(emptyResponse));

    await expect(
      callGeminiWithPrompt('test', 'key', 'prompt', 0)
    ).rejects.toThrow('Empty response from Gemini');
  });

  it('should throw on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    await expect(
      callGeminiWithPrompt('test', 'key', 'prompt', 0)
    ).rejects.toThrow('Network error');
  });
});
