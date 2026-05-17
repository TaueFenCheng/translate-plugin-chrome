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
          <button id="jp-translator-close" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:16px;">×</button>
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
      existing.querySelector(".jp-text").textContent = text_jp || "";
      existing.querySelector(".zh-text").textContent = text_zh || "";
      existing.style.opacity = isPartial ? "0.6" : "1";
      return;
    }

    const item = document.createElement("div");
    item.dataset.id = id;
    item.style.cssText = "padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.1);";
    item.innerHTML = `
      <div class="jp-text" style="font-size:12px;color:#999;margin-bottom:2px;">${text_jp || ""}</div>
      <div class="zh-text" style="font-size:14px;color:#fff;font-weight:500;">${text_zh || ""}</div>
    `;

    subtitleList.appendChild(item);
    subtitleItems.push(item);

    while (subtitleItems.length > MAX_SUBTITLES) {
      const old = subtitleItems.shift();
      old.remove();
    }

    subtitleList.scrollTop = subtitleList.scrollHeight;
  }

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
