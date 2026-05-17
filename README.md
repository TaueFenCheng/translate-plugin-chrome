# 🎌 日语实时翻译字幕 Chrome 插件

捕获网页中的日语音频，实时识别并翻译成中文，以双语字幕形式展示。

## 功能特性

- 🎙️ **实时音频捕获** - 使用 Chrome tabCapture API + Offscreen Document 模式
- 🤖 **混合语音识别** - 本地 Faster-Whisper 优先，云端 API 自动降级
- 🌐 **AI 翻译** - 支持 DeepSeek / OpenAI 切换，流式翻译输出
- 📝 **双语字幕** - 日文原文 + 中文翻译同时显示，支持流式光标效果
- 🎨 **可定制 UI** - 字幕位置可调，支持拖拽移动

## 项目结构

```
jp-to-zh-translator/
├── extension/                          # Chrome 扩展 (Manifest V3)
│   ├── manifest.json                   # 扩展配置
│   ├── popup/                          # 弹窗控制面板
│   │   ├── popup.html                  # 控制面板 UI
│   │   ├── popup.css                   # 控制面板样式
│   │   └── popup.js                    # 控制面板逻辑
│   ├── content/                        # 字幕展示脚本
│   │   ├── content.js                  # 注入字幕 UI，接收翻译结果
│   │   └── subtitle.css                # 字幕样式（内联样式为主）
│   ├── background/                     # Service Worker
│   │   └── service.js                  # 音频捕获调度、消息转发
│   ├── offscreen/                      # Offscreen Document (Chrome 116+)
│   │   ├── offscreen.html              # 离屏文档容器
│   │   └── offscreen.js                # 实际音频捕获 + WebSocket 连接
│   └── assets/                         # 扩展图标
│
└── backend/                            # Python FastAPI 后端
    ├── pyproject.toml                  # uv 包管理配置
    ├── .env.example                    # 环境变量模板
    ├── .env                            # 实际环境变量（不提交）
    ├── main.py                         # FastAPI 入口 + WebSocket 路由
    ├── config.py                       # 配置管理 (pydantic-settings)
    ├── audio/
    │   ├── vad.py                      # WebRTC VAD 语音活动检测
    │   └── stream.py                   # 音频流缓冲与分块
    ├── asr/
    │   ├── engine.py                   # 混合 ASR 引擎调度器
    │   ├── local_whisper.py            # 本地 Faster-Whisper
    │   └── cloud_api.py                # 云端 ASR fallback (OpenAI/Azure)
    ├── translate/
    │   ├── translator_factory.py       # 翻译服务工厂（DeepSeek/OpenAI 切换）
    │   ├── anthropic_translator.py     # DeepSeek (Anthropic API 兼容)
    │   └── openai_translator.py        # OpenAI/ChatGPT
    └── websocket/
        └── handler.py                  # WebSocket 会话管理 + 流式翻译
```

## 快速开始

### 1. 启动后端服务

```bash
cd backend

# 使用 uv 创建虚拟环境并安装依赖
uv venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
uv sync

# 配置环境变量
cp .env.example .env
# 编辑 .env 配置翻译服务（默认使用 DeepSeek）

# 启动服务
uv run python main.py
```

服务默认运行在 `ws://localhost:8000/ws`

### 2. 加载 Chrome 扩展

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `extension/` 目录

### 3. 使用

1. 打开需要翻译的日语视频/直播页面（**不能是 Chrome 内部页面**）
2. 点击扩展图标，配置后端地址（默认 `ws://localhost:8000/ws`）
3. 点击「开始翻译」
4. 字幕将显示在页面右下角，带流式光标效果

## 配置说明

### 环境变量完整列表 (.env)

| 变量 | 说明 | 默认值 | 必填 |
|------|------|--------|------|
| `TRANSLATION_PROVIDER` | 翻译服务提供商 | `deepseek` | 否 |
| `TRANSLATION_API_KEY` | 翻译服务 API Key | - | 是 |
| `TRANSLATION_BASE_URL` | 翻译服务 API 地址 | `https://api.deepseek.com/anthropic` | 否 |
| `TRANSLATION_MODEL` | 翻译模型名称 | `deepseek-chat` | 否 |
| `OPENAI_API_KEY` | OpenAI API Key | - | 否 |
| `OPENAI_BASE_URL` | OpenAI API 地址 | `https://api.openai.com/v1` | 否 |
| `OPENAI_MODEL` | OpenAI 模型 | `gpt-4o-mini` | 否 |
| `LOCAL_ASR_MODEL` | 本地 Whisper 模型 | `small` | 否 |
| `LOCAL_ASR_DEVICE` | Whisper 运行设备 | `auto` | 否 |
| `CLOUD_ASR_PROVIDER` | 云端 ASR 提供商 | 空 | 否 |
| `CLOUD_ASR_API_KEY` | 云端 ASR API Key | - | 否 |
| `HOST` | 服务监听地址 | `0.0.0.0` | 否 |
| `PORT` | 服务端口 | `8000` | 否 |
| `LOG_LEVEL` | 日志级别 | `info` | 否 |

### 翻译服务切换

**使用 DeepSeek（默认）**：
```env
TRANSLATION_PROVIDER=deepseek
TRANSLATION_API_KEY=sk-your-deepseek-key
TRANSLATION_BASE_URL=https://api.deepseek.com/anthropic
TRANSLATION_MODEL=deepseek-chat
```

**使用 OpenAI/ChatGPT**：
```env
TRANSLATION_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o-mini
```

### 字幕位置

- `bottom-right` - 右下角（默认）
- `bottom-center` - 底部居中
- `top-right` - 右上角

## 技术架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Chrome Extension                         │
│                                                                 │
│  ┌──────────┐    ┌──────────────────────────────────────────┐  │
│  │  Popup   │───>│          Service Worker                   │  │
│  │ (UI)     │    │  - 消息调度                               │  │
│  └──────────┘    │  - Content Script 注入                    │  │
│                  │  - Offscreen Document 管理                │  │
│                  └──────────────────┬───────────────────────┘  │
│                                     │                          │
│                  ┌──────────────────▼───────────────────────┐  │
│                  │         Offscreen Document                │  │
│                  │  - chrome.tabCapture.getMediaStreamId()   │  │
│                  │  - getUserMedia({chromeMediaSource:tab})  │  │
│                  │  - AudioContext 音频路由                  │  │
│                  │  - WebSocket 客户端                       │  │
│                  └──────────────────┬───────────────────────┘  │
│                                     │ WebSocket                │
│                  ┌──────────────────▼───────────────────────┐  │
│                  │          Content Script                   │  │
│                  │  - 字幕 UI 渲染                           │  │
│                  │  - 流式显示效果（光标闪烁）               │  │
│                  └──────────────────────────────────────────┘  │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ WebSocket (ws://localhost:8000/ws)
┌─────────────────────────────────▼───────────────────────────────┐
│                        Backend Server                           │
│                                                                 │
│  ┌────────────┐    ┌────────────┐    ┌──────────────────────┐  │
│  │  WebSocket │───>│   VAD +    │───>│   Hybrid ASR Engine  │  │
│  │  Handler   │    │  Buffer    │    │  - Local Whisper     │  │
│  │            │    │            │    │  - Cloud Fallback    │  │
│  └─────┬──────┘    └────────────┘    └──────────┬───────────┘  │
│        │                                        │              │
│        │  ┌─────────────────────────────────────┘              │
│        │  │                                                    │
│        │  ▼                                                    │
│        │  ┌─────────────────────────────────────────────────┐  │
│        │  │         Translator Factory                       │  │
│        │  │  ┌─────────────────┐    ┌─────────────────────┐ │  │
│        └──┤  DeepSeek         │    │  OpenAI             │ │  │
│           │  (Anthropic API)  │    │  (OpenAI API)       │ │  │
│           │  Streaming        │    │  Streaming           │ │  │
│           └─────────────────┘    └─────────────────────┘ │  │
│           └─────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 数据流

```
1. 用户点击「开始翻译」
   ↓
2. Popup → Service Worker (start_capture 消息)
   ↓
3. Service Worker 注入 Content Script 到目标标签页
   ↓
4. Service Worker 创建 Offscreen Document
   ↓
5. Service Worker 调用 chrome.tabCapture.getMediaStreamId() 获取 streamId
   ↓
6. Service Worker 发送 streamId 到 Offscreen Document
   ↓
7. Offscreen Document 使用 getUserMedia() 获取音频流
   ↓
8. Offscreen Document 通过 AudioContext 处理音频，同时播放给用户
   ↓
9. Offscreen Document 将音频分块 (320ms PCM) 通过 WebSocket 发送到后端
   ↓
10. 后端 VAD 检测语音活动
    ↓
11. 后端 ASR 识别日文文本
    ↓
12. 后端 Translator 流式翻译为中文
    ↓
13. 后端通过 WebSocket 发送翻译结果 (partial → final)
    ↓
14. Offscreen Document 接收结果，转发给 Service Worker
    ↓
15. Service Worker 转发给 Content Script
    ↓
16. Content Script 更新字幕 UI（流式显示效果）
```

### 音频处理流程

```
音频流 (48kHz 立体声)
    ↓
AudioContext (重采样到 16kHz 单声道)
    ↓
ScriptProcessorNode (4096 样本缓冲区)
    ↓
├──→ destination (播放给用户，保持音频不静音)
└──→ floatTo16BitPCM → base64 → WebSocket → 后端
```

### 流式翻译

```
日文识别完成 → 发送 partial (text_jp + "翻译中...")
    ↓
翻译逐字输出 → 持续发送 partial (text_jp + 累积的中文)
    ↓
翻译完成 → 发送 final (text_jp + 完整中文)
```

### WebSocket 消息协议

**客户端 → 服务端**:
```json
// 初始化
{"type": "init", "config": {"source_lang": "ja", "target_lang": "zh"}}

// 音频数据
{"type": "audio_chunk", "data": "<base64 PCM>", "seq": 0}
```

**服务端 → 客户端**:
```json
// 部分结果（流式）
{"type": "partial", "text_jp": "こんにちは", "text_zh": "你好", "id": 1}

// 最终结果
{"type": "final", "text_jp": "こんにちは", "text_zh": "你好，我是...", "id": 1}

// 错误
{"type": "error", "message": "识别失败"}
```

## 依赖说明

### 前端依赖
- Chrome 116+ (支持 Offscreen Document API)
- Manifest V3

### 后端依赖
- Python 3.10+
- uv (包管理)
- fastapi, uvicorn (Web 框架)
- faster-whisper (本地 ASR)
- webrtcvad (语音活动检测)
- anthropic (DeepSeek 兼容 API)
- openai (OpenAI API)

## 常见问题

### Q: 为什么音频被静音了？
A: 确保 Offscreen Document 中正确配置了音频路由：
```javascript
source.connect(audioProcessor);
audioProcessor.connect(audioContext.destination);
source.connect(audioContext.destination);  // 关键：直接连接输出
```

### Q: 字幕没有显示？
A: 检查以下几点：
1. 目标页面不是 Chrome 内部页面（`chrome://` 等）
2. Content Script 是否正确注入（查看页面 Console）
3. WebSocket 是否连接成功（查看后端日志）

### Q: 翻译延迟高？
A: 流式翻译已启用，首字延迟约 0.5 秒。如果仍感觉慢：
1. 检查网络连接
2. 尝试使用更快的模型（如 `deepseek-chat`）
3. 检查后端日志确认 VAD 是否正常工作

### Q: 如何查看调试日志？
A: 
- **前端**: 打开目标页面的 DevTools Console
- **Service Worker**: `chrome://extensions/` → 扩展详情 → "Service Worker" 链接
- **Offscreen Document**: 在 DevTools 中选择 Offscreen Document 上下文
- **后端**: `tail -f /tmp/backend.log`

## 开发计划

- [ ] TTS 语音输出（中文朗读翻译结果）
- [ ] 字幕历史记录与导出
- [ ] 多语言支持（英→中、韩→中等）
- [ ] 本地翻译模型（NLLB）
- [ ] 字幕样式自定义面板
- [ ] 音频波形可视化

## License

MIT

## 📚 相关文档

- [翻译延迟优化方案](docs/optimization.md) - 详细的延迟分析和 6 个优化方案
