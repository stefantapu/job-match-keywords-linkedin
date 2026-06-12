(function () {
  const ROOT_ID = "ljmk-root";
  const INSTANCE_ID = `${Date.now()}-${Math.random()}`;
  const STORAGE_KEYS = {
    veryPositive: "ljmkVeryPositiveKeywords",
    positive: "ljmkPositiveKeywords",
    negative: "ljmkNegativeKeywords",
    side: "ljmkPanelSide",
    collapsed: "ljmkPanelCollapsed"
  };

  const JOB_TEXT_SELECTORS = [
    '[componentkey^="JobDetails_AboutTheJob_"] [data-testid="expandable-text-box"]',
    '[data-sdui-component*="aboutTheJob"] [data-testid="expandable-text-box"]',
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
    /^\s*See less\s*$/gim,
    /…\s*more\s*$/gim
  ];

  const state = {
    veryPositiveInput: "",
    positiveInput: "",
    negativeInput: "",
    editing: false,
    collapsed: false,
    side: "right",
    expandedCategories: {},
    active: false,
    keywordsLoaded: false,
    result: createEmptyResult("Scanning..."),
    lastUrl: location.href,
    lastJobId: getCurrentJobId(),
    observers: [],
    timers: []
  };

  let root;
  let lifecycleTimer;

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
    if (!isLinkedInJobsPage()) {
      destroyWidget();
      return;
    }

    const existing = document.getElementById(ROOT_ID);
    if (existing) existing.remove();

    root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("data-editing", "false");
    document.documentElement.appendChild(root);
    state.active = true;
    state.editing = false;
    state.lastUrl = location.href;
    state.lastJobId = getCurrentJobId();

    render();
    ensureKeywordsLoaded().then(() => {
      if (!state.active || !isLinkedInJobsPage()) return;
      scanAndRender();
      watchLinkedInChanges();
    });
  }

  function destroy() {
    stopLifecycleWatcher();
    destroyWidget();
  }

  function destroyWidget() {
    state.observers.forEach((observer) => observer.disconnect());
    state.timers.forEach((timer) => clearInterval(timer));
    state.observers = [];
    state.timers = [];
    state.active = false;
    state.editing = false;
    const existing = document.getElementById(ROOT_ID);
    if (existing) existing.remove();
    root = null;
  }

  function restart() {
    destroyWidget();
    init();
  }

  function ensureKeywordsLoaded() {
    if (state.keywordsLoaded) return Promise.resolve();

    return new Promise((resolve) => {
      chrome.storage.sync.get(
        [
          STORAGE_KEYS.veryPositive,
          STORAGE_KEYS.positive,
          STORAGE_KEYS.negative,
          STORAGE_KEYS.side,
          STORAGE_KEYS.collapsed
        ],
        (items) => {
        state.veryPositiveInput = items[STORAGE_KEYS.veryPositive] || "";
        state.positiveInput = items[STORAGE_KEYS.positive] || "";
        state.negativeInput = items[STORAGE_KEYS.negative] || "";
        state.side = items[STORAGE_KEYS.side] === "left" ? "left" : "right";
        state.collapsed = items[STORAGE_KEYS.collapsed] === true;
        state.keywordsLoaded = true;
        resolve();
      }
      );
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
    let bestText = "";

    for (const selector of JOB_TEXT_SELECTORS) {
      const elements = Array.from(document.querySelectorAll(selector));

      elements.forEach((element) => {
        if (!isElementVisible(element)) return;

        const text = cleanJobText(element.innerText || element.textContent || "");
        if (text.length > bestText.length) bestText = text;
      });

      if (bestText.length > 80) return bestText;
    }

    return bestText;
  }

  function isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function cleanJobText(value) {
    let text = String(value || "");
    UI_NOISE_PATTERNS.forEach((pattern) => {
      text = text.replace(pattern, "");
    });
    return text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  }

  function scanAndRender() {
    if (!isLinkedInJobsPage()) {
      destroyWidget();
      return;
    }

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

  function isLinkedInJobsPage() {
    return location.hostname === "www.linkedin.com" && location.pathname.startsWith("/jobs");
  }

  function syncPageLifecycle() {
    const shouldRun = isLinkedInJobsPage();

    if (!shouldRun) {
      if (state.active || document.getElementById(ROOT_ID)) destroyWidget();
      state.lastUrl = location.href;
      state.lastJobId = getCurrentJobId();
      return;
    }

    if (!state.active || !document.getElementById(ROOT_ID)) {
      init();
      return;
    }

    const nextUrl = location.href;
    const nextJobId = getCurrentJobId();
    if (nextUrl !== state.lastUrl || nextJobId !== state.lastJobId) {
      state.lastUrl = nextUrl;
      state.lastJobId = nextJobId;
      rescan();
    }
  }

  function startLifecycleWatcher() {
    stopLifecycleWatcher();
    lifecycleTimer = setInterval(syncPageLifecycle, 700);
  }

  function stopLifecycleWatcher() {
    if (lifecycleTimer) {
      clearInterval(lifecycleTimer);
      lifecycleTimer = null;
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
        debounceRescan();
      }
    }, 700);
    state.timers.push(urlTimer);
  }

  function rescan() {
    if (!isLinkedInJobsPage()) {
      destroyWidget();
      return;
    }

    state.result = createEmptyResult("Scanning...");
    render();

    [0, 350, 900, 1600].forEach((delay) => {
      const timer = window.setTimeout(() => {
        if (isLinkedInJobsPage()) scanAndRender();
      }, delay);
      state.timers.push(timer);
    });
  }

  const debounceRescan = debounce(() => rescan(), 450);

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
    root.setAttribute("data-editing", String(state.editing));
    root.setAttribute("data-collapsed", String(state.collapsed));
    root.setAttribute("data-side", state.side);
    root.setAttribute("data-tone", tone);

    root.innerHTML = `
      <div class="ljmk-shell">
        <button class="ljmk-tab" type="button" data-action="toggle-collapsed" title="${state.collapsed ? "Show match panel" : "Hide match panel"}" aria-label="${state.collapsed ? "Show match panel" : "Hide match panel"}">
          ${chevronIcon()}
        </button>

        <aside class="ljmk-panel" aria-label="Job match keywords panel">
          <header class="ljmk-header">
            <div class="ljmk-title-wrap">
              <span class="ljmk-status-dot" aria-hidden="true"></span>
              <span class="ljmk-title">Job Match</span>
            </div>
            <div class="ljmk-header-actions">
              <button class="ljmk-side-button ${state.side === "left" ? "is-active" : ""}" type="button" data-action="set-side" data-side="left" aria-label="Move panel left" title="Move left">
                ${sideIcon("left")}
              </button>
              <button class="ljmk-side-button ${state.side === "right" ? "is-active" : ""}" type="button" data-action="set-side" data-side="right" aria-label="Move panel right" title="Move right">
                ${sideIcon("right")}
              </button>
            </div>
          </header>

          ${state.editing ? renderEditor() : renderDashboard(result)}
        </aside>
      </div>
    `;

    bindEvents();
  }

  function renderDashboard(result) {
    const categories = getCategoryViewModels(result);
    const foundTotal = categories.reduce((total, category) => total + category.foundCount, 0);
    const keywordTotal = categories.reduce((total, category) => total + category.total, 0);

    return `
      <section class="ljmk-score-section">
        ${renderGauge(result.score)}
        <div class="ljmk-score-lines">
          ${categories.map(renderScoreLine).join("")}
          <div class="ljmk-divider"></div>
          <div class="ljmk-score-line ljmk-score-line-total">
            <span class="ljmk-score-dot is-empty"></span>
            <span class="ljmk-score-label">Total</span>
            <span class="ljmk-score-count">${foundTotal}/${keywordTotal}</span>
          </div>
        </div>
      </section>

      <div class="ljmk-divider ljmk-divider-wide"></div>

      <section class="ljmk-keywords">
        <div class="ljmk-section-head">
          <span>Keywords</span>
          <button class="ljmk-edit-button" type="button" data-action="edit" aria-label="Edit keywords" title="Edit keywords">
            ${pencilIcon()}
          </button>
        </div>
        <div class="ljmk-category-list">
          ${categories.map(renderCategoryCard).join("")}
        </div>
      </section>
    `;
  }

  function renderEditor() {
    return `
      <section class="ljmk-editor">
        <div class="ljmk-editor-head">
          <div>
            <div class="ljmk-editor-title">Edit keywords</div>
            <div class="ljmk-editor-subtitle">Comma-separated words or phrases</div>
          </div>
          <button class="ljmk-icon-button" type="button" data-action="cancel-edit" aria-label="Close editor" title="Close editor">
            ${closeIcon()}
          </button>
        </div>
        <label class="ljmk-field">
          <span>Very positive</span>
          <textarea data-field="very-positive" rows="3" spellcheck="false" placeholder="React, TypeScript">${escapeHtml(state.veryPositiveInput)}</textarea>
        </label>
        <label class="ljmk-field">
          <span>Positive</span>
          <textarea data-field="positive" rows="4" spellcheck="false" placeholder="Frontend, SaaS, remote work">${escapeHtml(state.positiveInput)}</textarea>
        </label>
        <label class="ljmk-field">
          <span>Negative</span>
          <textarea data-field="negative" rows="4" spellcheck="false" placeholder="PHP, unpaid, onsite only">${escapeHtml(state.negativeInput)}</textarea>
        </label>
        <div class="ljmk-editor-actions">
          <button class="ljmk-button ljmk-button-secondary" type="button" data-action="cancel-edit">Cancel</button>
          <button class="ljmk-button ljmk-button-primary" type="button" data-action="save">Save</button>
        </div>
      </section>
    `;
  }

  function getCategoryViewModels(result) {
    return [
      {
        key: "very-positive",
        label: "Very Positive",
        foundCount: result.veryPositive.foundCount,
        total: result.veryPositive.total,
        found: result.veryPositive.found
      },
      {
        key: "positive",
        label: "Positive",
        foundCount: result.positive.foundCount,
        total: result.positive.total,
        found: result.positive.found
      },
      {
        key: "negative",
        label: "Negative",
        foundCount: result.negative.foundCount,
        total: result.negative.total,
        found: result.negative.found
      }
    ];
  }

  function renderGauge(score) {
    const size = 80;
    const strokeWidth = 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const filled = (score / 100) * circumference;
    const gap = circumference - filled;

    return `
      <div class="ljmk-gauge" aria-label="Current match ${score}%">
        <svg class="ljmk-gauge-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
          <circle class="ljmk-gauge-track" cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke-width="${strokeWidth}"></circle>
          <circle class="ljmk-gauge-fill" cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke-width="${strokeWidth}" stroke-dasharray="${filled} ${gap}"></circle>
        </svg>
        <div class="ljmk-gauge-value">
          <span>${score}</span><span>%</span>
        </div>
      </div>
    `;
  }

  function renderScoreLine(category) {
    return `
      <div class="ljmk-score-line ljmk-${category.key}">
        <span class="ljmk-score-dot"></span>
        <span class="ljmk-score-label">${escapeHtml(category.label)}</span>
        <span class="ljmk-score-count">${category.foundCount}/${category.total}</span>
      </div>
    `;
  }

  function renderCategoryCard(category) {
    const expanded = state.expandedCategories[category.key] === true;
    const words = category.found.length
      ? category.found.map((item) => `<span class="ljmk-chip ljmk-chip-${category.key}">${escapeHtml(`${item.label} x${item.count}`)}</span>`).join("")
      : `<span class="ljmk-empty">None found</span>`;

    return `
      <article class="ljmk-category-card ljmk-${category.key}">
        <button class="ljmk-category-button" type="button" data-action="toggle-category" data-category="${category.key}" aria-expanded="${expanded}" aria-label="${escapeHtml(category.label)} keywords">
          <span class="ljmk-category-bubble">${category.foundCount}</span>
          <span class="ljmk-category-copy">
            <span class="ljmk-category-label">${escapeHtml(category.label)}</span>
            <span class="ljmk-category-meta">${category.foundCount} out of ${category.total}</span>
          </span>
          <span class="ljmk-category-chevron">${chevronDownIcon()}</span>
        </button>
        <div class="ljmk-category-words" ${expanded ? "" : "hidden"}>
          ${words}
        </div>
      </article>
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

    if (action === "toggle-collapsed") {
      state.collapsed = !state.collapsed;
      saveLayoutPreference({ [STORAGE_KEYS.collapsed]: state.collapsed });
      render();
      return;
    }

    if (action === "set-side") {
      const side = event.currentTarget.getAttribute("data-side");
      state.side = side === "left" ? "left" : "right";
      saveLayoutPreference({ [STORAGE_KEYS.side]: state.side });
      render();
      return;
    }

    if (action === "toggle-category") {
      const category = event.currentTarget.getAttribute("data-category");
      state.expandedCategories[category] = state.expandedCategories[category] !== true;
      render();
      return;
    }

    if (action === "edit") {
      state.collapsed = false;
      saveLayoutPreference({ [STORAGE_KEYS.collapsed]: state.collapsed });
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
      rescan();
    }
  }

  function saveLayoutPreference(values) {
    chrome.storage.sync.set(values);
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

  function chevronIcon() {
    return `
      <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false">
        <path d="M7 2 3 5l4 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  function chevronDownIcon() {
    return `
      <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
        <path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
  }

  function sideIcon(side) {
    const path = side === "left" ? "M6.8 3 3.2 6.5 6.8 10M3.5 6.5h7.3" : "M5.2 3l3.6 3.5L5.2 10M3.2 6.5h7.3";
    return `
      <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
        <path d="${path}" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>
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
    if (window.__ljmkInstanceId !== INSTANCE_ID) return false;
    if (!message || message.source !== "ljmk-popup") return false;

    if (message.type === "rescan") {
      rescan();
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

  window.__ljmkInstanceId = INSTANCE_ID;
  window.__ljmkWidget = {
    destroy,
    restart,
    scan: rescan
  };

  startLifecycleWatcher();
  syncPageLifecycle();
})();
