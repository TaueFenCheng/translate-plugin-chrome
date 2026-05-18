# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

### 后端 (Python FastAPI)

```bash
cd backend

# 安装依赖
uv sync

# 启动开发服务器 (带热重载)
uv run python main.py

# 运行测试
uv run pytest
uv run pytest -s              # 显示输出
uv run pytest path/to/test.py  # 运行单个测试文件

# 类型检查
uv run mypy .

# 环境变量配置
cp .env.example .env   # 然后编辑 .env
```

### Chrome 扩展

扩展为纯原生 JS，无需构建。在 Chrome 中加载 `extension/` 目录即可。

## 架构概览

### 整体管线

```
Chrome Extension (音频捕获 + WebSocket 客户端)
  → WebSocket (ws://localhost:8000/ws)
    → Python 后端 (VAD → ASR → 翻译 → 流式返回)
```

### 后端处理链路 (backend/)

`main.py` 是 FastAPI 入口，WebSocket 端点为 `/ws`。每个 WebSocket 连接创建独立的 `SessionHandler`。

处理管线由 `websocket/handler.py` 中的 `SessionHandler` 编排：

1. **VAD** (`audio/vad.py`) — 基于 webrtcvad，30ms 帧，需要 40% 的帧检测到语音才判定为有效
2. **Buffer** (`audio/stream.py`) — 16000Hz 采样率的 deque，320ms 分块，最大 5 秒缓冲
3. **ASR** (`asr/engine.py`) — `HybridASREngine` 优先使用本地 Faster-Whisper，连续失败 3 次后自动降级到云端 API。`asr/local_whisper.py` 加载可配置大小的模型（默认 small），`asr/cloud_api.py` 支持 OpenAI Whisper 和 Azure
4. **Translation** (`translate/translator_factory.py`) — 工厂函数根据 `TRANSLATION_PROVIDER` 环境变量选择 `AnthropicTranslator`（用于 DeepSeek API）或 `OpenAITranslator`。两者均支持流式 (`translate_stream`) 和非流式 (`translate`) 输出

配置通过 `config.py` 中的 pydantic-settings 管理，从 `.env` 文件读取。

### 扩展组件 (extension/)

扩展使用 Manifest V3 架构，组件通过 `chrome.runtime.sendMessage` 通信：

1. **Popup** (`popup/`) — 用户控制面板，保存设置到 `chrome.storage.local`，向 Service Worker 发送 `start_capture`/`stop_capture` 消息
2. **Service Worker** (`background/service.js`) — 核心调度器：将 Content Script 注入目标标签页，创建 Offscreen Document，通过 `chrome.tabCapture.getMediaStreamId()` 获取音频流 ID
3. **Offscreen Document** (`offscreen/offscreen.js`) — 实际音频捕获：使用 `getUserMedia({chromeMediaSource: "tab"})` 获取音频流，通过 `ScriptProcessorNode` (4096 样本缓冲区) 处理，重采样到 16kHz 单声道，以 base64 PCM 形式通过 WebSocket 发送到后端。还处理自动重连（3 秒延迟）
4. **Content Script** (`content/content.js`) — 使用防重复注入守卫，将字幕容器注入页面 DOM。监听 `subtitle_update` 消息以渲染字幕，支持流式光标动画（`streaming`/`final` CSS 类），最多保留 5 条字幕

### WebSocket 消息协议

- **客户端 → 服务端**: `{type: "init", config: {source_lang, target_lang}}`，`{type: "audio_chunk", data: "<base64>", seq: N}`
- **服务端 → 客户端**: `{type: "partial", text_jp, text_zh, id}`（流式中间结果），`{type: "final", text_jp, text_zh, id}`（完整结果），`{type: "error", message}`
