(() => {
  const DEBOUNCE_MS = 1500;
  const MIN_LENGTH = 10;
  const AUTO_DISMISS_MS = 10000;
  const ICON_URL = chrome.runtime.getURL('icons/icon16.png');

  let debounceTimer = null;
  let lastCheckedText = '';
  let activeTooltip = null;
  let dismissTimer = null;
  let suppressUntil = 0;

  // --- Settings cache ---

  let textImprovementEnabled = true;
  let fluentifyEnabled = true;
  let explainEnabled = true;
  let siteDisabled = false;
  const currentHostname = window.location.hostname;

  function loadSettings() {
    chrome.storage.sync.get(['textImprovementEnabled', 'fluentifyEnabled', 'explainEnabled', 'disabledSites'], (data) => {
      textImprovementEnabled = data.textImprovementEnabled !== false;
      fluentifyEnabled = data.fluentifyEnabled !== false;
      explainEnabled = data.explainEnabled !== false;
      siteDisabled = (data.disabledSites || []).includes(currentHostname);
      if ((siteDisabled || !textImprovementEnabled) && activeTooltip) { removeTooltip(); }
      if (siteDisabled || !explainEnabled) { removeExplain(); }
    });
  }

  loadSettings();

  // Reload settings when changed (no need to refresh Slack)
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.textImprovementEnabled) textImprovementEnabled = changes.textImprovementEnabled.newValue !== false;
    if (changes.fluentifyEnabled) fluentifyEnabled = changes.fluentifyEnabled.newValue !== false;
    if (changes.explainEnabled) {
      explainEnabled = changes.explainEnabled.newValue !== false;
      if (!explainEnabled) removeExplain();
    }
    if (changes.disabledSites) {
      siteDisabled = (changes.disabledSites.newValue || []).includes(currentHostname);
      if (siteDisabled) { removeTooltip(); removeCheckIcon(); removeExplain(); }
    }
    if ((changes.textImprovementEnabled && !changes.textImprovementEnabled.newValue) ||
        (changes.disabledSites && (changes.disabledSites.newValue || []).includes(currentHostname))) {
      removeTooltip();
    }
  });

  // --- Tooltip ---

  function removeTooltip() {
    if (dismissTimer) clearTimeout(dismissTimer);
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }
  }

  function showLoading(inputEl) {
    removeTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'fluent-tooltip fluent-loading';
    tooltip.innerHTML = `
      <div class="fluent-label">
        <span class="fluent-spinner"></span> Checking grammar...
      </div>
    `;

    positionTooltip(tooltip, inputEl);
    document.body.appendChild(tooltip);
    activeTooltip = tooltip;
  }

  function positionTooltip(tooltip, inputEl) {
    tooltip.style.visibility = 'hidden';
    tooltip.style.top = '0';
    tooltip.style.left = '0';
    document.body.appendChild(tooltip);

    const rect = inputEl.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    const pad = 8;

    let top;
    if (rect.top - tipRect.height - pad > 0) {
      top = window.scrollY + rect.top - tipRect.height - pad;
    } else {
      top = window.scrollY + rect.bottom + pad;
    }

    let left = window.scrollX + rect.left;
    const maxLeft = window.innerWidth - tipRect.width - pad;
    if (left > maxLeft) left = Math.max(pad, maxLeft);

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.visibility = '';

    tooltip.remove();
  }

  function showTooltip(inputEl, improved) {
    removeTooltip();

    const withMentions = hasMentions(inputEl);
    const tooltip = document.createElement('div');
    tooltip.className = 'fluent-tooltip';

    tooltip.innerHTML = `
      <div class="fluent-label">Suggestion</div>
      <div class="fluent-text"></div>
      <div class="fluent-actions">
        <button class="fluent-btn fluent-btn-apply">&#x2705; Apply</button>
        ${withMentions ? '<button class="fluent-btn fluent-btn-copy">&#x1F4CB; Copy</button>' : ''}
        <button class="fluent-btn fluent-btn-dismiss">&#x2716; Dismiss</button>
      </div>
    `;

    tooltip.querySelector('.fluent-text').textContent = improved;

    tooltip.querySelector('.fluent-btn-apply').addEventListener('click', () => {
      lastCheckedText = improved.trim();
      suppressUntil = Date.now() + 3000;
      applyText(inputEl, improved);
      removeTooltip();
    });

    const copyBtn = tooltip.querySelector('.fluent-btn-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(improved).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(removeTooltip, 800);
        });
      });
    }

    tooltip.querySelector('.fluent-btn-dismiss').addEventListener('click', () => {
      removeTooltip();
    });

    positionTooltip(tooltip, inputEl);
    document.body.appendChild(tooltip);
    activeTooltip = tooltip;

    // Auto-dismiss, but pause while hovering
    function startDismissTimer() {
      if (dismissTimer) clearTimeout(dismissTimer);
      dismissTimer = setTimeout(removeTooltip, AUTO_DISMISS_MS);
    }
    tooltip.addEventListener('mouseenter', () => {
      if (dismissTimer) clearTimeout(dismissTimer);
    });
    tooltip.addEventListener('mouseleave', startDismissTimer);
    startDismissTimer();
  }

  // --- Slack mention handling ---

  const MENTION_SELECTORS = [
    '[data-stringify-type="mention"]',
    '[data-mention-id]',
    '.c-member_slug',
    '.c-channel_entity',
  ].join(',');

  function hasMentions(el) {
    return el.querySelector(MENTION_SELECTORS) !== null;
  }

  function applyText(el, text) {
    el.focus();

    // Standard inputs (textarea, input[type=text])
    if (isStandardInput(el)) {
      // Use execCommand for undo support, with native setter as fallback
      el.select();
      if (!document.execCommand('insertText', false, text)) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
          'value'
        ).set;
        nativeSetter.call(el, text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    if (!hasMentions(el)) {
      // Simple case: no mentions, replace everything
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, text);
      return;
    }

    // With mentions: only select and replace text AFTER the last mention
    const mentions = [...el.querySelectorAll(MENTION_SELECTORS)];
    const lastMention = mentions[mentions.length - 1];

    // Strip mention texts from corrected text to get the non-mention part
    let nonMentionText = text;
    for (const m of mentions) {
      nonMentionText = nonMentionText.replace(m.textContent.trim(), '');
    }
    nonMentionText = nonMentionText.trim();

    // Select range from after last mention to end of editor
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStartAfter(lastMention);

    // Find the end boundary
    const last = el.lastChild;
    if (last) {
      if (last.nodeType === Node.TEXT_NODE) {
        range.setEnd(last, last.length);
      } else {
        range.setEndAfter(last);
      }
    }

    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('insertText', false, ' ' + nonMentionText);
  }

  // --- Text extraction ---

  function isStandardInput(el) {
    const tag = el.tagName;
    return tag === 'TEXTAREA' || (tag === 'INPUT' && el.type === 'text');
  }

  function getInputText(el) {
    if (isStandardInput(el)) {
      return (el.value || '').trim();
    }
    // For contenteditable, preserve line breaks
    const clone = el.cloneNode(true);
    const lines = [];

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        lines.push(node.textContent);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase();
        // Treat block elements and <br> as line breaks
        if (tagName === 'br' || ['p', 'div', 'li', 'blockquote'].includes(tagName)) {
          if (lines.length > 0 && !lines[lines.length - 1].endsWith('\n')) {
            lines.push('\n');
          }
        }
        for (const child of node.childNodes) {
          walk(child);
        }
        if (tagName === 'p' || tagName === 'div' || tagName === 'li' || tagName === 'blockquote') {
          if (lines.length > 0 && !lines[lines.length - 1].endsWith('\n')) {
            lines.push('\n');
          }
        }
      }
    };

    walk(clone);
    return lines.join('').trim();
  }

  // --- Core check ---

  function scheduleCheck(inputEl, immediate = false) {
    if (!textImprovementEnabled || siteDisabled) return;
    if (debounceTimer) clearTimeout(debounceTimer);

    if (Date.now() < suppressUntil) return;

    const delay = immediate ? 0 : DEBOUNCE_MS;
    debounceTimer = setTimeout(() => {
      const text = getInputText(inputEl);

      if (text.length < MIN_LENGTH) return;
      if (text === lastCheckedText) return;

      lastCheckedText = text;
      removeCheckIcon(inputEl);
      showLoading(inputEl);

      chrome.runtime.sendMessage({ type: 'ping' }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[Fluent] Service worker unavailable:', chrome.runtime.lastError.message);
          removeTooltip();
          return;
        }
      });

      chrome.runtime.sendMessage({ type: 'check-grammar', text }, (res) => {
        if (chrome.runtime.lastError) {
          console.warn('[Fluent]', chrome.runtime.lastError.message);
          removeTooltip();
          return;
        }
        if (res?.error) {
          console.warn('[Fluent]', res.error);
          removeTooltip();
          return;
        }
        if (!res?.improved) { removeTooltip(); return; }

        if (res.improved.trim() === text.trim()) { removeTooltip(); return; }

        showTooltip(inputEl, res.improved);
      });
    }, delay);
  }

  // --- Dismiss with Escape ---

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      removeTooltip();
      removeExplain();
    }
  });

  // --- Fluent check trigger icon ---

  function showCheckIcon(inputEl) {
    removeCheckIcon(inputEl);
    const text = getInputText(inputEl);
    if (text.length < MIN_LENGTH) return;

    const icon = document.createElement('div');
    icon.className = 'fluent-action-btn';
    icon.title = 'Fluentify this text';
    icon.innerHTML = `
      <img src="${ICON_URL}" class="fluent-action-icon" />
      <span>Fluentify</span>
    `;

    icon.style.position = 'absolute';
    icon.style.zIndex = '999998';

    icon.addEventListener('click', (e) => {
      e.stopPropagation();
      lastCheckedText = ''; // force re-check
      scheduleCheck(inputEl, true);
    });

    document.body.appendChild(icon);

    // Get caret/text-end position for smart positioning
    requestAnimationFrame(() => {
      let anchorRect;

      if (isStandardInput(inputEl)) {
        // textarea/input — use the input rect but approximate caret at bottom-right of text
        anchorRect = inputEl.getBoundingClientRect();
      } else {
        // contenteditable — try to get caret rect or last text node rect
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const caretRect = range.getBoundingClientRect();
          if (caretRect.width > 0 || caretRect.height > 0) {
            anchorRect = caretRect;
          }
        }
        // Fallback: use the last child element or the input itself
        if (!anchorRect) {
          const lastChild = inputEl.lastElementChild || inputEl;
          anchorRect = lastChild.getBoundingClientRect();
        }
      }

      const btnRect = icon.getBoundingClientRect();
      const pad = 6;
      const rightSpace = window.innerWidth - anchorRect.right;
      const topSpace = anchorRect.top;

      let top, left;

      if (rightSpace >= btnRect.width + pad) {
        // Right of anchor
        top = window.scrollY + anchorRect.top + (anchorRect.height / 2) - (btnRect.height / 2);
        left = window.scrollX + anchorRect.right + pad;
      } else if (topSpace >= btnRect.height + pad) {
        // Diagonal top
        top = window.scrollY + anchorRect.top - btnRect.height - pad;
        left = window.scrollX + anchorRect.right - btnRect.width;
      } else {
        // Below
        top = window.scrollY + anchorRect.bottom + pad;
        left = window.scrollX + anchorRect.left;
      }

      // Clamp to viewport
      if (left < pad) left = pad;
      if (left + btnRect.width > window.innerWidth - pad) {
        left = window.innerWidth - btnRect.width - pad;
      }

      icon.style.top = `${top}px`;
      icon.style.left = `${left}px`;
    });

    inputEl._fluentCheckIcon = icon;
  }

  function removeCheckIcon(el) {
    if (el._fluentCheckIcon) {
      el._fluentCheckIcon.remove();
      el._fluentCheckIcon = null;
    }
  }

  function updateCheckIcon(inputEl) {
    if (!textImprovementEnabled || !fluentifyEnabled || siteDisabled) return;
    const text = getInputText(inputEl);
    if (text.length >= MIN_LENGTH && text !== lastCheckedText) {
      showCheckIcon(inputEl);
    } else {
      removeCheckIcon(inputEl);
    }
  }

  // --- Attach listeners to inputs ---

  const observedInputs = new WeakSet();

  // Skip inputs that are too small (search bars, etc.)
  function shouldAttach(el) {
    if (el.closest('.fluent-tooltip, .fluent-explain-bubble, .fluent-check-icon')) return false;
    if (isStandardInput(el)) {
      // Skip short inputs (search, url, etc.) — only attach to larger text fields
      if (el.tagName === 'INPUT') return false; // skip single-line inputs
      return true; // textarea
    }
    // contenteditable — skip if it's just a one-liner (like a search box)
    return true;
  }

  function attachToInput(el) {
    if (observedInputs.has(el)) return;
    if (!shouldAttach(el)) return;
    observedInputs.add(el);

    el.addEventListener('input', () => {
      scheduleCheck(el);
      updateCheckIcon(el);
    });
    el.addEventListener('paste', () => {
      // Some apps intercept paste — delay to let content settle
      setTimeout(() => {
        lastCheckedText = ''; // force check after paste
        updateCheckIcon(el);
      }, 300);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        removeTooltip();
        removeCheckIcon(el);
        lastCheckedText = '';
      }
    });
    el.addEventListener('focus', () => updateCheckIcon(el));
    el.addEventListener('blur', () => {
      setTimeout(() => removeCheckIcon(el), 200);
    });
  }

  // --- Find all editable inputs ---

  const INPUT_SELECTORS = [
    // Contenteditable (Slack, Discord, Teams, Gmail, etc.)
    '[contenteditable="true"]',
    '[contenteditable="plaintext-only"]',
    // Standard form elements
    'textarea',
  ];

  function findAndAttach() {
    for (const sel of INPUT_SELECTORS) {
      document.querySelectorAll(sel).forEach(attachToInput);
    }
  }

  // --- Explain feature (text selection) ---

  let explainBubble = null;
  let explainTooltip = null;

  function removeExplain() {
    if (explainBubble) { explainBubble.remove(); explainBubble = null; }
    if (explainTooltip) { explainTooltip.remove(); explainTooltip = null; }
  }

  function showExplainBubble(selectedText, rect) {
    removeExplain();

    const bubble = document.createElement('div');
    bubble.className = 'fluent-explain-bubble';
    bubble.innerHTML = `
      <img src="${ICON_URL}" class="fluent-explain-icon" />
      <span>Explain</span>
    `;

    bubble.style.position = 'absolute';
    document.body.appendChild(bubble);

    const pad = 6;
    const bubbleRect = bubble.getBoundingClientRect();
    const rightSpace = window.innerWidth - rect.right;
    const topSpace = rect.top;

    let top, left;

    if (rightSpace >= bubbleRect.width + pad) {
      // Preferred: to the right of selection
      top = window.scrollY + rect.top + (rect.height / 2) - (bubbleRect.height / 2);
      left = window.scrollX + rect.right + pad;
    } else if (topSpace >= bubbleRect.height + pad) {
      // Fallback: diagonal top-left
      top = window.scrollY + rect.top - bubbleRect.height - pad;
      left = window.scrollX + rect.right - bubbleRect.width;
    } else {
      // Last resort: below selection
      top = window.scrollY + rect.bottom + pad;
      left = window.scrollX + rect.left;
    }

    // Clamp to viewport
    if (left < pad) left = pad;
    if (left + bubbleRect.width > window.innerWidth - pad) {
      left = window.innerWidth - bubbleRect.width - pad;
    }

    bubble.style.top = `${top}px`;
    bubble.style.left = `${left}px`;

    bubble.addEventListener('click', () => {
      requestExplanation(selectedText, rect);
    });

    explainBubble = bubble;
  }

  function requestExplanation(text, rect) {
    if (explainBubble) { explainBubble.remove(); explainBubble = null; }

    const tooltip = document.createElement('div');
    tooltip.className = 'fluent-tooltip fluent-loading fluent-explain-tooltip';
    tooltip.innerHTML = `
      <div class="fluent-label">
        <span class="fluent-spinner"></span> Explaining...
      </div>
    `;
    tooltip.style.position = 'absolute';
    const pad = 8;
    tooltip.style.top = `${window.scrollY + rect.bottom + pad}px`;
    tooltip.style.left = `${window.scrollX + rect.left}px`;
    document.body.appendChild(tooltip);
    explainTooltip = tooltip;

    chrome.runtime.sendMessage({ type: 'explain-text', text }, (res) => {
      if (chrome.runtime.lastError || res?.error || !res?.explanation) {
        const errMsg = chrome.runtime.lastError?.message || res?.error || 'No response';
        console.warn('[Fluent] Explain error:', errMsg);
        if (explainTooltip) explainTooltip.remove();
        explainTooltip = null;
        return;
      }

      if (explainTooltip) explainTooltip.remove();

      const tip = document.createElement('div');
      tip.className = 'fluent-tooltip fluent-explain-tooltip';
      tip.innerHTML = `
        <div class="fluent-label">Explanation</div>
        <div class="fluent-text"></div>
        <div class="fluent-actions">
          <button class="fluent-btn fluent-btn-dismiss">&#x2716; Close</button>
        </div>
      `;
      tip.querySelector('.fluent-text').textContent = res.explanation;
      tip.querySelector('.fluent-btn-dismiss').addEventListener('click', removeExplain);

      tip.style.position = 'absolute';
      tip.style.top = `${window.scrollY + rect.bottom + pad}px`;
      tip.style.left = `${window.scrollX + rect.left}px`;
      tip.style.maxWidth = '400px';
      document.body.appendChild(tip);
      explainTooltip = tip;

      // Auto-dismiss, but pause while hovering
      let explainDismiss;
      function startExplainDismiss() {
        if (explainDismiss) clearTimeout(explainDismiss);
        explainDismiss = setTimeout(() => {
          if (explainTooltip === tip) removeExplain();
        }, 15000);
      }
      tip.addEventListener('mouseenter', () => {
        if (explainDismiss) clearTimeout(explainDismiss);
      });
      tip.addEventListener('mouseleave', startExplainDismiss);
      startExplainDismiss();
    });
  }

  document.addEventListener('mouseup', () => {
    if (!explainEnabled || siteDisabled) return;

    setTimeout(() => {
      const sel = window.getSelection();
      const text = (sel?.toString() || '').trim();

      if (text.length < 3) {
        removeExplain();
        return;
      }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showExplainBubble(text, rect);
    }, 50);
  });

  document.addEventListener('mousedown', (e) => {
    if (explainBubble && !explainBubble.contains(e.target) &&
        (!explainTooltip || !explainTooltip.contains(e.target))) {
      removeExplain();
    }
  });

  // --- MutationObserver for SPA navigation ---

  const observer = new MutationObserver(() => {
    findAndAttach();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Initial scan
  findAndAttach();
})();
