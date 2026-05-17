const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusIndicator = document.getElementById("statusIndicator");
const statusText = document.getElementById("statusText");
const serverUrlInput = document.getElementById("serverUrl");
const showOriginalCheckbox = document.getElementById("showOriginal");
const subtitlePositionSelect = document.getElementById("subtitlePosition");
const captureInfo = document.getElementById("captureInfo");

let isCapturing = false;

async function loadSettings() {
  const result = await chrome.storage.local.get([
    "serverUrl",
    "showOriginal",
    "subtitlePosition",
  ]);
  if (result.serverUrl) serverUrlInput.value = result.serverUrl;
  if (result.showOriginal !== undefined)
    showOriginalCheckbox.checked = result.showOriginal;
  if (result.subtitlePosition)
    subtitlePositionSelect.value = result.subtitlePosition;
}

async function saveSettings() {
  await chrome.storage.local.set({
    serverUrl: serverUrlInput.value,
    showOriginal: showOriginalCheckbox.checked,
    subtitlePosition: subtitlePositionSelect.value,
  });
}

function setStatus(status, text) {
  statusIndicator.className = "status-dot " + status;
  statusText.textContent = text;
}

async function startCapture() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) {
      captureInfo.textContent = "无法获取当前标签页";
      return;
    }

    console.log("Starting capture for tab:", tab.id);
    setStatus("connecting", "Connecting...");
    captureInfo.textContent = "Capturing: " + tab.title;

    chrome.runtime.sendMessage({
      action: "start_capture",
      tabId: tab.id,
      serverUrl: serverUrlInput.value,
      showOriginal: showOriginalCheckbox.checked,
      subtitlePosition: subtitlePositionSelect.value,
    });

    startBtn.disabled = true;
    stopBtn.disabled = false;
    isCapturing = true;
  } catch (err) {
    console.error("Start error:", err);
    setStatus("error", "Start failed");
    captureInfo.textContent = err.message;
  }
}

function stopCapture() {
  console.log("Stopping capture");
  chrome.runtime.sendMessage({ action: "stop_capture" });
  startBtn.disabled = false;
  stopBtn.disabled = true;
  isCapturing = false;
  setStatus("offline", "Stopped");
}

startBtn.addEventListener("click", startCapture);
stopBtn.addEventListener("click", stopCapture);
serverUrlInput.addEventListener("change", saveSettings);
showOriginalCheckbox.addEventListener("change", saveSettings);
subtitlePositionSelect.addEventListener("change", saveSettings);

chrome.runtime.onMessage.addListener((message) => {
  console.log("Popup received:", message);
  if (message.action === "status_update") {
    setStatus(message.status, message.text);
  }
  if (message.action === "capture_error") {
    setStatus("error", message.error);
    startBtn.disabled = false;
    stopBtn.disabled = true;
    isCapturing = false;
  }
});

loadSettings();
