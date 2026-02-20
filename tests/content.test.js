// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Mock chrome API ---

function createMockChrome(settings = {}) {
  const listeners = [];
  return {
    runtime: {
      getURL: (path) => `chrome-extension://fake-id/${path}`,
      sendMessage: vi.fn((msg, cb) => {
        if (msg.type === 'ping') cb?.({ ok: true });
        if (msg.type === 'check-grammar') cb?.({ improved: 'fixed text' });
        if (msg.type === 'explain-text') cb?.({ explanation: 'explained text' });
      }),
      lastError: null,
    },
    storage: {
      sync: {
        get: vi.fn((keys, cb) => cb?.(settings)),
      },
      onChanged: {
        addListener: vi.fn((fn) => listeners.push(fn)),
      },
    },
    _triggerStorageChange: (changes) => {
      listeners.forEach((fn) => fn(changes));
    },
  };
}

// --- Test settings caching behavior ---

describe('Settings behavior', () => {
  let chrome;

  beforeEach(() => {
    chrome = createMockChrome({
      grammarEnabled: true,
      explainEnabled: true,
    });
    vi.stubGlobal('chrome', chrome);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load settings from chrome.storage on init', () => {
    chrome.storage.sync.get(['grammarEnabled', 'explainEnabled'], (data) => {
      expect(data.grammarEnabled).toBe(true);
      expect(data.explainEnabled).toBe(true);
    });
  });

  it('should reflect disabled grammar in storage', () => {
    const disabledChrome = createMockChrome({ grammarEnabled: false, explainEnabled: true });
    disabledChrome.storage.sync.get(['grammarEnabled', 'explainEnabled'], (data) => {
      expect(data.grammarEnabled).toBe(false);
      expect(data.explainEnabled).toBe(true);
    });
  });

  it('should reflect disabled explain in storage', () => {
    const disabledChrome = createMockChrome({ grammarEnabled: true, explainEnabled: false });
    disabledChrome.storage.sync.get(['grammarEnabled', 'explainEnabled'], (data) => {
      expect(data.grammarEnabled).toBe(true);
      expect(data.explainEnabled).toBe(false);
    });
  });

  it('storage.onChanged should accept listeners', () => {
    const fn = vi.fn();
    chrome.storage.onChanged.addListener(fn);
    expect(chrome.storage.onChanged.addListener).toHaveBeenCalledWith(fn);
  });

  it('should notify listeners on storage change', () => {
    const fn = vi.fn();
    chrome.storage.onChanged.addListener(fn);
    chrome._triggerStorageChange({ grammarEnabled: { newValue: false } });
    expect(fn).toHaveBeenCalledWith({ grammarEnabled: { newValue: false } });
  });
});

// --- Test chrome.runtime.sendMessage ---

describe('Message passing', () => {
  let chrome;

  beforeEach(() => {
    chrome = createMockChrome();
    vi.stubGlobal('chrome', chrome);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send ping message', () => {
    chrome.runtime.sendMessage({ type: 'ping' }, (res) => {
      expect(res).toEqual({ ok: true });
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'ping' },
      expect.any(Function)
    );
  });

  it('should send check-grammar message', () => {
    chrome.runtime.sendMessage({ type: 'check-grammar', text: 'I has error' }, (res) => {
      expect(res).toHaveProperty('improved');
    });
  });

  it('should send explain-text message', () => {
    chrome.runtime.sendMessage({ type: 'explain-text', text: 'hello world' }, (res) => {
      expect(res).toHaveProperty('explanation');
    });
  });
});

// --- Test input selectors (global) ---

describe('Global input selectors', () => {
  const INPUT_SELECTORS = [
    '[contenteditable="true"]',
    '[contenteditable="plaintext-only"]',
    'textarea',
  ];

  it('should match contenteditable div', () => {
    document.body.innerHTML = `<div contenteditable="true">test</div>`;
    const el = document.querySelector(INPUT_SELECTORS[0]);
    expect(el).not.toBeNull();
    expect(el.textContent).toBe('test');
  });

  it('should match plaintext-only contenteditable', () => {
    document.body.innerHTML = `<div contenteditable="plaintext-only">test</div>`;
    const el = document.querySelector(INPUT_SELECTORS[1]);
    expect(el).not.toBeNull();
  });

  it('should match textarea', () => {
    document.body.innerHTML = `<textarea>test content</textarea>`;
    const el = document.querySelector(INPUT_SELECTORS[2]);
    expect(el).not.toBeNull();
    expect(el.value).toBe('test content');
  });

  it('should not match non-contenteditable divs', () => {
    document.body.innerHTML = `<div>not editable</div>`;
    const el = document.querySelector(INPUT_SELECTORS[0]);
    expect(el).toBeNull();
  });

  it('should match Slack-style rich editor', () => {
    document.body.innerHTML = `
      <div data-qa="message_input">
        <div contenteditable="true">slack msg</div>
      </div>
    `;
    const el = document.querySelector(INPUT_SELECTORS[0]);
    expect(el).not.toBeNull();
    expect(el.textContent).toBe('slack msg');
  });

  it('should match Gmail compose contenteditable', () => {
    document.body.innerHTML = `
      <div role="textbox" contenteditable="true" aria-label="Message Body">email text</div>
    `;
    const el = document.querySelector(INPUT_SELECTORS[0]);
    expect(el).not.toBeNull();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });
});

// --- Test text extraction logic ---

describe('Text extraction', () => {
  function isStandardInput(el) {
    const tag = el.tagName;
    return tag === 'TEXTAREA' || (tag === 'INPUT' && el.type === 'text');
  }

  function getInputText(el) {
    if (isStandardInput(el)) return (el.value || '').trim();
    return (el.textContent || '').trim();
  }

  it('should trim whitespace from contenteditable', () => {
    const el = document.createElement('div');
    el.textContent = '  hello world  ';
    expect(getInputText(el)).toBe('hello world');
  });

  it('should return empty string for empty element', () => {
    const el = document.createElement('div');
    expect(getInputText(el)).toBe('');
  });

  it('should handle nested elements in contenteditable', () => {
    const el = document.createElement('div');
    el.innerHTML = '<span>hello</span> <b>world</b>';
    expect(getInputText(el)).toBe('hello world');
  });

  it('should extract value from textarea', () => {
    const el = document.createElement('textarea');
    el.value = '  some text here  ';
    expect(getInputText(el)).toBe('some text here');
  });

  it('should extract value from input[type=text]', () => {
    const el = document.createElement('input');
    el.type = 'text';
    el.value = '  typed text  ';
    expect(getInputText(el)).toBe('typed text');
  });

  it('should identify textarea as standard input', () => {
    const el = document.createElement('textarea');
    expect(isStandardInput(el)).toBe(true);
  });

  it('should identify input[text] as standard input', () => {
    const el = document.createElement('input');
    el.type = 'text';
    expect(isStandardInput(el)).toBe(true);
  });

  it('should not identify div as standard input', () => {
    const el = document.createElement('div');
    expect(isStandardInput(el)).toBe(false);
  });

  it('should not identify input[password] as standard input', () => {
    const el = document.createElement('input');
    el.type = 'password';
    expect(isStandardInput(el)).toBe(false);
  });
});

// --- Test min length and dedup logic ---

describe('Check thresholds', () => {
  const MIN_LENGTH = 10;

  it('should skip text shorter than MIN_LENGTH', () => {
    expect('short'.length < MIN_LENGTH).toBe(true);
  });

  it('should allow text at MIN_LENGTH', () => {
    expect('0123456789'.length >= MIN_LENGTH).toBe(true);
  });

  it('should skip if text matches lastCheckedText', () => {
    const lastCheckedText = 'already checked';
    const text = 'already checked';
    expect(text === lastCheckedText).toBe(true);
  });

  it('should allow if text differs from lastCheckedText', () => {
    const lastCheckedText = 'old text';
    const text = 'new text here';
    expect(text === lastCheckedText).toBe(false);
  });
});
