# 🎌 日语实时翻译字幕 Chrome 插件

捕获网页中的日语音频，实时识别并翻译成中文，以双语字幕形式展示。

## 功能特性

- 🎙️ **实时音频捕获** - 使用 Chrome tabCapture API 捕获标签页音频
- 🤖 **混合语音识别** - 本地 Faster-Whisper 优先，云端 API 自动降级
- 🌐 **AI 翻译** - 支持 DeepSeek / OpenAI 切换
- 📝 **双语字幕** - 日文原文 + 中文翻译同时显示
- 🎨 **可定制 UI** - 字幕位置可调，支持拖拽移动

## 项目结构

```
jp-to-zh-translator/
├── extension/              # Chrome 扩展
│   ├── manifest.json       # 扩展配置
│   ├── popup/              # 弹窗控制面板
│   ├── content/            # 字幕展示脚本
│   ├── background/         # Service Worker (音频捕获)
│   └── assets/             # 图标资源
└── backend/                # Python 后端
    ├── pyproject.toml      # uv 包管理配置
    ├── main.py             # FastAPI 入口
    ├── config.py           # 配置管理
    ├── audio/              # 音频处理 (VAD, 流缓冲)
    ├── asr/                # 语音识别 (本地+云端)
    ├── translate/          # 翻译服务 (OpenAI + DeepSeek)
    └── websocket/          # WebSocket 处理
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

1. 打开需要翻译的日语视频/直播页面
2. 点击扩展图标，配置后端地址（默认 `ws://localhost:8000/ws`）
3. 点击「开始翻译」
4. 字幕将显示在页面右下角

## 配置说明

### 翻译服务切换 (.env)

**使用 DeepSeek（默认）**：
```
TRANSLATION_PROVIDER=deepseek
TRANSLATION_API_KEY=sk-your-deepseek-key
TRANSLATION_BASE_URL=https://api.deepseek.com/anthropic
TRANSLATION_MODEL=deepseek-chat
```

**使用 OpenAI/ChatGPT**：
```
TRANSLATION_PROVIDER=openai
OPENAI_API_KEY=sk-your-openai-key
OPENAI_MODEL=gpt-4o-mini
```

### 其他环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LOCAL_ASR_MODEL` | 本地 Whisper 模型 | `small` |
| `CLOUD_ASR_PROVIDER` | 云端 ASR 提供商 | 空(不使用) |
| `PORT` | 服务端口 | `8000` |

### 字幕位置

- `bottom-right` - 右下角（默认）
- `bottom-center` - 底部居中
- `top-right` - 右上角

## 技术架构

```
┌─────────────────────────────────────────────────┐
│                  Chrome Extension               │
│  ┌──────────┐    ┌──────────────┐    ┌────────┐ │
│  │ tabCapture│───>│ Audio Chunk  │───>│  WS    │ │
│  │  API     │    │  (320ms PCM) │    │ Client │ │
│  └──────────┘    └──────────────┘    └───┬────┘ │
│                                          │      │
│  ┌──────────┐    ┌──────────────┐    ┌───▼────┐ │
│  │ Subtitle │<───│ Subtitle Data│<───│  WS    │ │
│  │   UI     │    │ (JP + ZH)    │    │ Client │ │
│  └──────────┘    └──────────────┘    └────────┘ │
└─────────────────────────┬───────────────────────┘
                          │ WebSocket
┌─────────────────────────▼───────────────────────┐
│                  Backend Server                  │
│  ┌──────────┐    ┌──────────┐    ┌────────────┐ │
│  │   WS     │───>│   VAD +  │───>│   Hybrid   │ │
│  │  Server  │    │  Buffer  │    │   ASR      │ │
│  └──────────┘    └──────────┘    └─────┬──────┘ │
│                                        │        │
│  ┌──────────┐    ┌──────────┐    ┌─────▼──────┐ │
│  │  WS      │<───│ Response │<───│ Translator │ │
│  │  Server  │    │  Build   │    │ Factory    │ │
│  └──────────┘    └──────────┘    └─────┬──────┘ │
│                              ┌─────────┴───────┐ │
│                              │ DeepSeek/OpenAI │ │
│                              └─────────────────┘ │
└─────────────────────────────────────────────────┘
```

## 开发计划

- [ ] TTS 语音输出（中文朗读翻译结果）
- [ ] 字幕历史记录与导出
- [ ] 多语言支持（英→中、韩→中等）
- [ ] 本地翻译模型（NLLB）
- [ ] 字幕样式自定义面板

## License

MIT
