(function () {
  if (document.getElementById("jp-translator-subtitle-container")) {
    return;
  }

  console.log("[JP Translator] Injecting subtitle container");

  const container = document.createElement("div");
  container.id = "jp-translator-subtitle-container";
  container.className = "position-bottom-right";
  container.style.cssText = "position:fixed;bottom:20px;right:20px;z-index:2147483647;pointer-events:auto;font-family:sans-serif;";
  container.innerHTML = `
    <div style="background:rgba(0,0,0,0.8);border-radius:8px;padding:12px;min-width:280px;max-width:400px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <span style="color:#aaa;font-size:11px;">日语翻译字幕</span>
        <div>
          <button id="jp-translator-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:16px;padding:0 4px;">×</button>
        </div>
      </div>
      <div id="jp-translator-subtitle-list" style="max-height:300px;overflow-y:auto;"></div>
    </div>
  `;
  document.body.appendChild(container);

  console.log("[JP Translator] Container created");

  const subtitleList = container.querySelector("#jp-translator-subtitle-list");
  const closeBtn = container.querySelector("#jp-translator-close");
  let subtitleItems = [];
  const MAX_SUBTITLES = 5;

  closeBtn.addEventListener("click", () => {
    container.remove();
  });

  function addSubtitle(data) {
    console.log("[JP Translator] addSubtitle:", JSON.stringify(data));
    const { text_jp, text_zh, isPartial, id } = data;

    const existing = subtitleList.querySelector(`[data-id="${id}"]`);
    
    if (existing) {
      const jpEl = existing.querySelector(".jp-text");
      const zhEl = existing.querySelector(".zh-text");
      
      // 更新日文
      if (text_jp && jpEl.textContent !== text_jp) {
        jpEl.textContent = text_jp;
      }
      
      // 更新中文（流式效果）
      if (text_zh && zhEl.textContent !== text_zh) {
        zhEl.textContent = text_zh;
        
        // 流式效果：添加光标闪烁
        if (isPartial) {
          zhEl.classList.add("streaming");
          zhEl.classList.remove("final");
        } else {
          zhEl.classList.remove("streaming");
          zhEl.classList.add("final");
        }
      }
      return;
    }

    // 创建新字幕项
    const item = document.createElement("div");
    item.dataset.id = id;
    item.style.cssText = "padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.1);animation:fadeIn 0.3s ease;";
    item.innerHTML = `
      <div class="jp-text" style="font-size:12px;color:#999;margin-bottom:2px;min-height:16px;">${text_jp || ""}</div>
      <div class="zh-text${isPartial ? " streaming" : " final"}" style="font-size:14px;color:#fff;font-weight:500;min-height:20px;">${text_zh || ""}</div>
    `;

    subtitleList.appendChild(item);
    subtitleItems.push(item);

    // 移除旧字幕
    while (subtitleItems.length > MAX_SUBTITLES) {
      const old = subtitleItems.shift();
      old.style.opacity = "0";
      old.style.transition = "opacity 0.3s";
      setTimeout(() => old.remove(), 300);
    }

    subtitleList.scrollTop = subtitleList.scrollHeight;
  }

  // 添加流式动画样式
  const style = document.createElement("style");
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .zh-text.streaming {
      position: relative;
    }
    
    .zh-text.streaming::after {
      content: "|";
      animation: blink 0.8s infinite;
      color: #3498db;
      margin-left: 2px;
    }
    
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    
    .zh-text.final {
      animation: none;
    }
  `;
  document.head.appendChild(style);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[JP Translator] Received:", JSON.stringify(message));
    
    if (message.action === "subtitle_update") {
      addSubtitle(message.data);
    }
    if (message.action === "subtitle_clear") {
      subtitleList.innerHTML = "";
      subtitleItems = [];
    }
  });
})();
