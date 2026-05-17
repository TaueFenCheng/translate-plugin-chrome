let audioContext = null;
let mediaStream = null;
let audioProcessor = null;
let sequenceNumber = 0;
let ws = null;
let isCapturing = false;
let currentServerUrl = null;

const SAMPLE_RATE = 16000;

console.log("[Offscreen] Script loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Offscreen] Received:", JSON.stringify(message));
  
  if (message.target !== "offscreen") {
    return;
  }

  if (message.type === "start-capture") {
    console.log("[Offscreen] Starting capture");
    startCapture(message.streamId, message.serverUrl)
      .then(() => sendResponse({ success: true }))
      .catch((err) => {
        console.error("[Offscreen] Error:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (message.type === "stop-capture") {
    console.log("[Offscreen] Stopping capture");
    stopCapture();
    sendResponse({ success: true });
    return true;
  }
});

async function startCapture(streamId, serverUrl) {
  console.log("[Offscreen] startCapture called");
  
  if (isCapturing) return;
  currentServerUrl = serverUrl;

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: streamId,
        },
      },
      video: false,
    });

    console.log("[Offscreen] Got mediaStream");

    audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioContext.createMediaStreamSource(mediaStream);
    const destination = audioContext.createMediaStreamDestination();
    
    audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
    audioProcessor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const pcm = floatTo16BitPCM(input);
      const base64 = arrayBufferToBase64(pcm.buffer);

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "audio_chunk",
          data: base64,
          seq: sequenceNumber++,
        }));
      }
    };

    source.connect(audioProcessor);
    audioProcessor.connect(destination);
    audioProcessor.connect(audioContext.destination);

    console.log("[Offscreen] Audio connected");
    connectWebSocket(serverUrl);
    isCapturing = true;

    chrome.runtime.sendMessage({
      action: "status_update",
      status: "online",
      text: "正在捕获音频",
    });
  } catch (err) {
    console.error("[Offscreen] Capture error:", err);
    chrome.runtime.sendMessage({
      action: "capture_error",
      error: err.message,
    });
    throw err;
  }
}

function connectWebSocket(serverUrl) {
  console.log("[Offscreen] Connecting to:", serverUrl);
  ws = new WebSocket(serverUrl);

  ws.onopen = () => {
    console.log("[Offscreen] WebSocket connected");
    chrome.runtime.sendMessage({
      action: "status_update",
      status: "online",
      text: "已连接",
    });
    ws.send(JSON.stringify({
      type: "init",
      config: { source_lang: "ja", target_lang: "zh" },
    }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "partial" || data.type === "final") {
        console.log("[Offscreen] Subtitle:", data.text_jp, "->", data.text_zh);
        chrome.runtime.sendMessage({
          action: "subtitle_update",
          data: {
            text_jp: data.text_jp || "",
            text_zh: data.text_zh || "",
            isPartial: data.type === "partial",
            id: data.id || Date.now(),
          },
        });
      } else if (data.type === "error") {
        console.error("[Offscreen] Server error:", data.message);
      }
    } catch (e) {
      console.error("[Offscreen] Parse error:", e);
    }
  };

  ws.onclose = () => {
    console.log("[Offscreen] WebSocket closed");
    chrome.runtime.sendMessage({
      action: "status_update",
      status: "offline",
      text: "连接断开",
    });
    ws = null;
    if (isCapturing) {
      setTimeout(() => {
        if (isCapturing && ws === null) connectWebSocket(currentServerUrl);
      }, 3000);
    }
  };

  ws.onerror = (err) => {
    console.error("[Offscreen] WebSocket error:", err);
  };
}

function stopCapture() {
  isCapturing = false;

  if (audioProcessor) audioProcessor.disconnect();
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  if (audioContext) audioContext.close();
  if (ws) ws.close();

  audioProcessor = null;
  mediaStream = null;
  audioContext = null;
  ws = null;

  chrome.runtime.sendMessage({ action: "subtitle_clear" });
  chrome.runtime.sendMessage({
    action: "status_update",
    status: "offline",
    text: "已停止",
  });
}

function floatTo16BitPCM(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Int16Array(buffer);
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
