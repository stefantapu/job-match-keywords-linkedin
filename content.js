(function () {
  const ROOT_ID = "ljmk-root";
  const STORAGE_KEYS = {
    veryPositive: "ljmkVeryPositiveKeywords",
    positive: "ljmkPositiveKeywords",
    negative: "ljmkNegativeKeywords"
  };

  const JOB_TEXT_SELECTORS = [
    "#job-details",
    ".jobs-description-content__text--stretch",
    ".jobs-description .jobs-box__html-content",
    ".jobs-description",
    ".jobs-search__job-details--container"
  ];

  const UI_NOISE_PATTERNS = [
    /^\s*About the job\s*$/gim,
    /^\s*Copy description\s*$/gim,
    /^\s*Show more\s*$/gim,
    /^\s*Show less\s*$/gim,
    /^\s*See more\s*$/gim,
    /^\s*See less\s*$/gim
  ];

  const state = {
    veryPositiveInput: "",
    positiveInput: "",
    negativeInput: "",
    expanded: false,
    editing: false,
    result: createEmptyResult("Scanning..."),
    lastUrl: location.href,
    lastJobId: getCurrentJobId(),
    observers: [],
    timers: []
  };

  let root;

  function createEmptyResult(status) {
    return {
      status,
      textLength: 0,
      score: 0,
      positive: {
        total: 0,
        foundCount: 0,
        found: [],
        missing: []
      },
      veryPositive: {
        total: 0,
        foundCount: 0,
        found: [],
        missing: []
      },
      negative: {
        total: 0,
        foundCount: 0,
        found: [],
        missing: []
      }
    };
  }

  function init() {
    const existing = document.getElementById(ROOT_ID);
    if (existing) existing.remove();

    root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("data-expanded", "false");
    root.setAttribute("data-editing", "false");
    document.documentElement.appendChild(root);

    render();
    loadKeywords().then(() => {
      scanAndRender();
      watchLinkedInChanges();
    });
  }

  function destroy() {
    state.observers.forEach((observer) => observer.disconnect());
    state.timers.forEach((timer) => clearInterval(timer));
    state.observers = [];
    state.timers = [];
    const existing = document.getElementById(ROOT_ID);
    if (existing) existing.remove();
  }

  function restart() {
    destroy();
    init();
  }

  function loadKeywords() {
    return new Promise((resolve) => {
      chrome.storage.sync.get([STORAGE_KEYS.veryPositive, STORAGE_KEYS.positive, STORAGE_KEYS.negative], (items) => {
        state.veryPositiveInput = items[STORAGE_KEYS.veryPositive] || "";
        state.positiveInput = items[STORAGE_KEYS.positive] || "";
        state.negativeInput = items[STORAGE_KEYS.negative] || "";
        resolve();
      });
    });
  }

  function saveKeywords(veryPositiveInput, positiveInput, negativeInput) {
    state.veryPositiveInput = sanitizeKeywordInput(veryPositiveInput);
    state.positiveInput = sanitizeKeywordInput(positiveInput);
    state.negativeInput = sanitizeKeywordInput(negativeInput);

    chrome.storage.sync.set(
      {
        [STORAGE_KEYS.veryPositive]: state.veryPositiveInput,
        [STORAGE_KEYS.positive]: state.positiveInput,
        [STORAGE_KEYS.negative]: state.negativeInput
      },
      () => {
        state.editing = false;
        scanAndRender();
      }
    );
  }

  function sanitizeKeywordInput(value) {
    return String(value || "")
      .replace(/\r?\n/g, " ")
      .split(",")
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(", ");
  }

  function parseKeywords(value) {
    const seen = new Set();
    const keywords = [];

    String(value || "")
      .split(",")
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .forEach((label) => {
        const key = normalizeForSearch(label);
        if (!seen.has(key)) {
          seen.add(key);
          keywords.push({ label, key });
        }
      });

    return keywords;
  }

  function normalizeForSearch(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[’‘`]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getJobText() {
    for (const selector of JOB_TEXT_SELECTORS) {
      const element = document.querySelector(selector);
      if (!element) continue;

      const text = cleanJobText(element.innerText || element.textContent || "");
      if (text.length > 80) {
        return text;
      }
    }

    return "";
  }

  function cleanJobText(value) {
    let text = String(value || "");
    UI_NOISE_PATTERNS.forEach((pattern) => {
      text = text.replace(pattern, "");
    });
    return text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  }

  function scanAndRender() {
    const text = getJobText();
    const veryPositiveKeywords = parseKeywords(state.veryPositiveInput);
    const positiveKeywords = parseKeywords(state.positiveInput);
    const negativeKeywords = parseKeywords(state.negativeInput);

    if (!text) {
      state.result = createEmptyResult("Job text not found");
      state.result.veryPositive.total = veryPositiveKeywords.length;
      state.result.positive.total = positiveKeywords.length;
      state.result.negative.total = negativeKeywords.length;
      render();
      return;
    }

    const normalizedText = normalizeForSearch(text);
    const veryPositive = analyzeKeywords(normalizedText, veryPositiveKeywords);
    const positive = analyzeKeywords(normalizedText, positiveKeywords);
    const negative = analyzeKeywords(normalizedText, negativeKeywords);
    const score = calculateWeightedScore(veryPositive, positive, negative);

    state.result = {
      status: "Job text found",
      textLength: text.length,
      score,
      veryPositive,
      positive,
      negative
    };
    render();
  }

  function calculateWeightedScore(veryPositive, positive, negative) {
    const positiveSignal = Math.min(90, veryPositive.foundCount * 35 + positive.foundCount * 8);
    const cleanBonus = positiveSignal > 0 && negative.foundCount === 0 ? 10 : 0;
    const negativePenalty = Math.min(35, negative.foundCount * 7);

    return clamp(Math.round(positiveSignal + cleanBonus - negativePenalty), 0, 100);
  }

  function analyzeKeywords(normalizedText, keywords) {
    const found = [];
    const missing = [];

    keywords.forEach((keyword) => {
      const occurrences = countOccurrences(normalizedText, keyword.key);
      if (occurrences > 0) {
        found.push({ label: keyword.label, count: occurrences });
      } else {
        missing.push(keyword.label);
      }
    });

    return {
      total: keywords.length,
      foundCount: found.length,
      found,
      missing
    };
  }

  function countOccurrences(normalizedText, normalizedKeyword) {
    if (!normalizedKeyword) return 0;

    const pattern = normalizedKeyword
      .split(" ")
      .map(escapeRegExp)
      .join("\\s+");
    const regex = new RegExp(`(^|[^a-z0-9])(${pattern})(?=$|[^a-z0-9])`, "g");
    let count = 0;
    let match;

    while ((match = regex.exec(normalizedText)) !== null) {
      count += 1;
      regex.lastIndex = match.index + match[0].length;
    }

    return count;
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getScoreTone(score) {
    if (score >= 70) return "good";
    if (score >= 40) return "ok";
    return "low";
  }

  function getCurrentJobId() {
    try {
      return new URL(location.href).searchParams.get("currentJobId") || "";
    } catch (_error) {
      return "";
    }
  }

  function watchLinkedInChanges() {
    const observer = new MutationObserver(debounce(() => {
      scanAndRender();
    }, 500));

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
    state.observers.push(observer);

    const urlTimer = setInterval(() => {
      const nextUrl = location.href;
      const nextJobId = getCurrentJobId();
      if (nextUrl !== state.lastUrl || nextJobId !== state.lastJobId) {
        state.lastUrl = nextUrl;
        state.lastJobId = nextJobId;
        debounceScan();
      }
    }, 700);
    state.timers.push(urlTimer);
  }

  const debounceScan = debounce(() => scanAndRender(), 450);

  function debounce(callback, wait) {
    let timer;
    return function debounced() {
      window.clearTimeout(timer);
      timer = window.setTimeout(callback, wait);
    };
  }

  function render() {
    if (!root) return;

    const result = state.result;
    const tone = getScoreTone(result.score);
    root.setAttribute("data-expanded", String(state.expanded));
    root.setAttribute("data-editing", String(state.editing));
    root.setAttribute("data-tone", tone);

    root.innerHTML = `
      <div class="ljmk-shell">
        <div class="ljmk-panel-stack">
          <div class="ljmk-rail" aria-label="Job match summary">
            <button class="ljmk-rail-main" type="button" data-action="toggle" aria-label="${state.expanded ? "Collapse match panel" : "Open match panel"}">
              <span class="ljmk-rail-score">${result.score}%</span>
              <span class="ljmk-rail-count ljmk-very-positive">V${result.veryPositive.foundCount}</span>
              <span class="ljmk-rail-count ljmk-positive">+${result.positive.foundCount}</span>
              <span class="ljmk-rail-count ljmk-negative">-${result.negative.foundCount}</span>
            </button>
          </div>

          <section class="ljmk-mini-panel" aria-label="Job match found keywords">
            <button class="ljmk-mini-header" type="button" data-action="toggle">
              <span class="ljmk-mini-score">${result.score}%</span>
            </button>
            <div class="ljmk-mini-results">
              ${renderMiniKeywordSection("Very positive", result.veryPositive.found, "very-positive")}
              ${renderMiniKeywordSection("Positive", result.positive.found, "positive")}
              ${renderMiniKeywordSection("Negative", result.negative.found, "negative")}
            </div>
            <button class="ljmk-mini-edit" type="button" data-action="edit">
              ${pencilIcon()}
              <span>Edit</span>
            </button>
          </section>

          <aside class="ljmk-panel" aria-label="Job match keywords panel">
          <header class="ljmk-header">
            <div>
              <div class="ljmk-title">Match</div>
              <div class="ljmk-status">${escapeHtml(result.status)}</div>
            </div>
            <div class="ljmk-header-actions">
              <button class="ljmk-icon-button" type="button" data-action="rescan" aria-label="Rescan job" title="Rescan job">
                ${refreshIcon()}
              </button>
              <button class="ljmk-icon-button" type="button" data-action="collapse" aria-label="Collapse panel" title="Collapse panel">
                ${closeIcon()}
              </button>
            </div>
          </header>

          <section class="ljmk-score-card">
            <div class="ljmk-score-value">${result.score}%</div>
            <div class="ljmk-score-meta">
              <span class="ljmk-pill ljmk-very-positive">V${result.veryPositive.foundCount}/${result.veryPositive.total}</span>
              <span class="ljmk-pill ljmk-positive">+${result.positive.foundCount}/${result.positive.total}</span>
              <span class="ljmk-pill ljmk-negative">-${result.negative.foundCount}/${result.negative.total}</span>
            </div>
          </section>

          <section class="ljmk-results" ${state.editing ? "hidden" : ""}>
            ${renderKeywordSection("Very positive found", result.veryPositive.found, "very-positive", true)}
            ${renderKeywordSection("Very positive missing", result.veryPositive.missing, "muted", false)}
            ${renderKeywordSection("Positive found", result.positive.found, "positive", true)}
            ${renderKeywordSection("Positive missing", result.positive.missing, "muted", false)}
            ${renderKeywordSection("Negative found", result.negative.found, "negative", true)}
            ${renderKeywordSection("Negative missing", result.negative.missing, "muted", false)}
          </section>

          <section class="ljmk-editor" ${state.editing ? "" : "hidden"}>
            <label class="ljmk-field">
              <span>Very positive keywords</span>
              <textarea data-field="very-positive" rows="2" spellcheck="false" placeholder="React, TypeScript">${escapeHtml(state.veryPositiveInput)}</textarea>
            </label>
            <label class="ljmk-field">
              <span>Positive keywords</span>
              <textarea data-field="positive" rows="3" spellcheck="false" placeholder="Frontend, SaaS, remote work">${escapeHtml(state.positiveInput)}</textarea>
            </label>
            <label class="ljmk-field">
              <span>Negative keywords</span>
              <textarea data-field="negative" rows="3" spellcheck="false" placeholder="PHP, unpaid, onsite only">${escapeHtml(state.negativeInput)}</textarea>
            </label>
            <div class="ljmk-editor-actions">
              <button class="ljmk-button ljmk-button-secondary" type="button" data-action="cancel-edit">Cancel</button>
              <button class="ljmk-button ljmk-button-primary" type="button" data-action="save">Save</button>
            </div>
          </section>

          <footer class="ljmk-footer">
            <button class="ljmk-edit-link" type="button" data-action="edit">
              ${pencilIcon()}
              <span>Edit keywords</span>
            </button>
          </footer>
          </aside>
        </div>
      </div>
    `;

    bindEvents();
  }

  function renderKeywordSection(title, items, tone, hasCounts) {
    const content = items.length
      ? items.map((item) => {
          const label = hasCounts ? `${item.label} x${item.count}` : item;
          return `<span class="ljmk-chip ljmk-chip-${tone}">${escapeHtml(label)}</span>`;
        }).join("")
      : `<span class="ljmk-empty">None</span>`;

    return `
      <div class="ljmk-keyword-section">
        <div class="ljmk-section-title">${escapeHtml(title)}</div>
        <div class="ljmk-chip-list">${content}</div>
      </div>
    `;
  }

  function renderMiniKeywordSection(title, items, tone) {
    const visibleItems = items.slice(0, 5);
    const hiddenCount = Math.max(0, items.length - visibleItems.length);
    const content = visibleItems.length
      ? visibleItems.map((item) => `<span class="ljmk-chip ljmk-chip-${tone}">${escapeHtml(`${item.label} x${item.count}`)}</span>`).join("")
      : `<span class="ljmk-empty">None</span>`;
    const more = hiddenCount > 0 ? `<span class="ljmk-chip ljmk-chip-muted">+${hiddenCount} more</span>` : "";

    return `
      <div class="ljmk-mini-section">
        <div class="ljmk-mini-title">${escapeHtml(title)}</div>
        <div class="ljmk-mini-chips">${content}${more}</div>
      </div>
    `;
  }

  function bindEvents() {
    root.querySelectorAll("[data-action]").forEach((element) => {
      element.addEventListener("click", handleAction);
    });

    root.querySelectorAll("textarea").forEach((element) => {
      element.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
        }
      });
    });
  }

  function handleAction(event) {
    const action = event.currentTarget.getAttribute("data-action");

    if (action === "toggle") {
      state.expanded = !state.expanded;
      render();
      return;
    }

    if (action === "collapse") {
      state.expanded = false;
      state.editing = false;
      render();
      return;
    }

    if (action === "edit") {
      state.expanded = true;
      state.editing = true;
      render();
      const field = root.querySelector('[data-field="very-positive"]');
      if (field) field.focus();
      return;
    }

    if (action === "cancel-edit") {
      state.editing = false;
      render();
      return;
    }

    if (action === "save") {
      const veryPositiveInput = root.querySelector('[data-field="very-positive"]')?.value || "";
      const positiveInput = root.querySelector('[data-field="positive"]')?.value || "";
      const negativeInput = root.querySelector('[data-field="negative"]')?.value || "";
      saveKeywords(veryPositiveInput, positiveInput, negativeInput);
      return;
    }

    if (action === "rescan") {
      scanAndRender();
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function pencilIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 20h4.4L19.7 8.7a2.1 2.1 0 0 0 0-3L18.3 4.3a2.1 2.1 0 0 0-3 0L4 15.6V20Zm3.6-2H6v-1.6l8.7-8.7 1.6 1.6L7.6 18Zm10.1-10.1-1.6-1.6.6-.6 1.6 1.6-.6.6Z"/>
      </svg>
    `;
  }

  function refreshIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M17.7 6.3A8 8 0 0 0 4.3 10H2a10 10 0 0 1 16.9-5.1L21 2.8V9h-6.2l2.9-2.7ZM6.3 17.7A8 8 0 0 0 19.7 14H22A10 10 0 0 1 5.1 19.1L3 21.2V15h6.2l-2.9 2.7Z"/>
      </svg>
    `;
  }

  function closeIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z"/>
      </svg>
    `;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.source !== "ljmk-popup") return false;

    if (message.type === "rescan") {
      scanAndRender();
      sendResponse({ ok: true, status: state.result.status, score: state.result.score });
      return true;
    }

    if (message.type === "restart") {
      restart();
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "status") {
      sendResponse({ ok: true, status: state.result.status, score: state.result.score });
      return true;
    }

    return false;
  });

  if (window.__ljmkWidget) {
    window.__ljmkWidget.destroy();
  }

  window.__ljmkWidget = {
    destroy,
    restart,
    scan: scanAndRender
  };

  init();
})();
