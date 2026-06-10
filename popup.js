const statusElement = document.getElementById("status");
const scoreElement = document.getElementById("score");
const scoreValueElement = document.getElementById("scoreValue");
const rescanButton = document.getElementById("rescanButton");
const restartButton = document.getElementById("restartButton");

let activeTabId = null;
let isLinkedInJobsPage = false;

document.addEventListener("DOMContentLoaded", init);
rescanButton.addEventListener("click", () => sendCommand("rescan"));
restartButton.addEventListener("click", () => sendCommand("restart"));

function init() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    activeTabId = tab?.id || null;
    isLinkedInJobsPage = /^https:\/\/www\.linkedin\.com\/jobs\//.test(tab?.url || "");

    if (!activeTabId || !isLinkedInJobsPage) {
      setUnavailable();
      return;
    }

    setStatus("LinkedIn Jobs detected");
    sendCommand("status");
  });
}

function sendCommand(type, retryAfterInject = true) {
  if (!activeTabId || !isLinkedInJobsPage) {
    setUnavailable();
    return;
  }

  setButtonsDisabled(true);
  chrome.tabs.sendMessage(activeTabId, { source: "ljmk-popup", type }, (response) => {
    if (chrome.runtime.lastError || !response?.ok) {
      if (retryAfterInject) {
        injectWidget(() => sendCommand(type, false));
        return;
      }

      setButtonsDisabled(false);
      setStatus("Widget is not responding");
      scoreElement.hidden = true;
      return;
    }

    setButtonsDisabled(false);
    if (type === "restart") {
      setStatus("Widget restarted");
      scoreElement.hidden = true;
      window.setTimeout(() => sendCommand("status"), 350);
      return;
    }

    setStatus(response.status || "LinkedIn Jobs detected");
    if (typeof response.score === "number") {
      scoreValueElement.textContent = `${response.score}%`;
      scoreElement.hidden = false;
    }
  });
}

function injectWidget(callback) {
  setStatus("Starting widget...");
  chrome.scripting.insertCSS({ target: { tabId: activeTabId }, files: ["styles.css"] }, () => {
    chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ["content.js"] }, () => {
      if (chrome.runtime.lastError) {
        setButtonsDisabled(false);
        setStatus("Could not start widget");
        return;
      }

      callback();
    });
  });
}

function setUnavailable() {
  setStatus("Open a LinkedIn Jobs page");
  scoreElement.hidden = true;
  setButtonsDisabled(true);
}

function setStatus(value) {
  statusElement.textContent = value;
}

function setButtonsDisabled(disabled) {
  rescanButton.disabled = disabled;
  restartButton.disabled = disabled;
}
