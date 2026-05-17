let isCapturing = false;
let currentTabId = null;
let capturedTabId = null;

const OFFSCREEN_DOCUMENT_PATH = "/offscreen/offscreen.html";

const STATUS_TEXTS = {
  connecting: "Connecting...",
  online: "Connected",
  offline: "Stopped",
  error: "Error",
};

function setStatus(status, text) {
  if (capturedTabId) {
    chrome.tabs.sendMessage(capturedTabId, {
      action: "status_update",
      status,
      text: text || STATUS_TEXTS[status] || status,
    }).catch(() => {});
  }
}

function sendToCapturedTab(message) {
  if (!capturedTabId) return;
  chrome.tabs.sendMessage(capturedTabId, message).catch((err) => {
    console.log("Failed to send to tab", capturedTabId, err.message);
  });
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/content.js"],
    });
    console.log("Content script injected into tab:", tabId);
  } catch (err) {
    console.log("Could not inject content script:", err.message);
  }
}

async function hasOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
  });
  return existingContexts.length > 0;
}

async function setupOffscreenDocument() {
  const hasOffscreen = await hasOffscreenDocument();
  
  if (!hasOffscreen) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["USER_MEDIA"],
      justification: "Capture tab audio for real-time translation",
    });
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function sendToOffscreen(message) {
  const offscreenReady = await hasOffscreenDocument();
  if (!offscreenReady) {
    throw new Error("Offscreen document not ready");
  }
  
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

async function startCapture(tabId, serverUrl, showOriginal, subtitlePosition) {
  if (isCapturing) return;

  try {
    console.log("Starting capture for tab:", tabId, "serverUrl:", serverUrl);

    const tab = await chrome.tabs.get(tabId);
    console.log("Tab URL:", tab.url);

    if (tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://") || tab.url.startsWith("edge://")) {
      throw new Error("Cannot use on Chrome internal pages. Please switch to a regular webpage (e.g., YouTube)");
    }

    await injectContentScript(tabId);
    await new Promise(resolve => setTimeout(resolve, 300));

    setStatus("connecting", "Initializing...");

    await setupOffscreenDocument();
    console.log("Offscreen document ready");

    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId,
    });

    if (!streamId) {
      throw new Error("Failed to get tab audio stream ID");
    }
    console.log("Got streamId:", streamId);

    setStatus("connecting", "Starting audio capture...");
    const response = await sendToOffscreen({
      type: "start-capture",
      target: "offscreen",
      streamId,
      serverUrl,
    });

    console.log("Offscreen response:", response);

    if (!response || !response.success) {
      throw new Error(response?.error || "Offscreen failed to start");
    }

    isCapturing = true;
    currentTabId = tabId;
    capturedTabId = tabId;

    sendToCapturedTab({
      action: "update_position",
      position: subtitlePosition,
    });

    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#3498db" });
    setStatus("online", "Capturing audio");
  } catch (err) {
    console.error("Capture error:", err);
    sendToCapturedTab({
      action: "capture_error",
      error: err.message,
    });
    setStatus("error", err.message);
  }
}

function stopCapture() {
  if (!isCapturing) return;

  sendToOffscreen({
    type: "stop-capture",
    target: "offscreen",
  }).catch(() => {});

  sendToCapturedTab({ action: "subtitle_clear" });

  isCapturing = false;
  currentTabId = null;
  capturedTabId = null;

  chrome.action.setBadgeText({ text: "" });
  setStatus("offline", "Stopped");

  chrome.offscreen.closeDocument().catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received:", JSON.stringify(message), "from:", sender.origin);

  if (message.action === "start_capture") {
    startCapture(
      message.tabId,
      message.serverUrl,
      message.showOriginal,
      message.subtitlePosition
    );
  }
  if (message.action === "stop_capture") {
    stopCapture();
  }

  if (message.action === "status_update") {
    setStatus(message.status, message.text);
  }

  if (message.action === "capture_error") {
    sendToCapturedTab({
      action: "capture_error",
      error: message.error,
    });
  }

  if (message.action === "subtitle_update") {
    sendToCapturedTab({
      action: "subtitle_update",
      data: message.data,
    });
  }

  if (message.action === "subtitle_clear") {
    sendToCapturedTab({ action: "subtitle_clear" });
  }
});
