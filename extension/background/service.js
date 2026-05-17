let isCapturing = false;
let currentTabId = null;
let capturedTabId = null;

const OFFSCREEN_DOCUMENT_PATH = "/offscreen/offscreen.html";

function setStatus(status, text) {
  if (capturedTabId) {
    chrome.tabs.sendMessage(capturedTabId, {
      action: "status_update",
      status,
      text,
    }).catch(() => {});
  }
}

function sendToCapturedTab(message) {
  if (!capturedTabId) return;
  chrome.tabs.sendMessage(capturedTabId, message).catch((err) => {
    console.log("Failed to send to tab", capturedTabId, err.message);
  });
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
    setStatus("connecting", "正在初始化...");

    await setupOffscreenDocument();
    console.log("Offscreen document ready");

    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tabId,
    });

    if (!streamId) {
      throw new Error("无法获取标签页音频流 ID");
    }
    console.log("Got streamId:", streamId);

    setStatus("connecting", "正在启动音频捕获...");
    const response = await sendToOffscreen({
      type: "start-capture",
      target: "offscreen",
      streamId,
      serverUrl,
    });

    console.log("Offscreen response:", response);

    if (!response || !response.success) {
      throw new Error(response?.error || "Offscreen 启动失败");
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
    setStatus("online", "正在捕获音频");
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
  setStatus("offline", "已停止");

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
