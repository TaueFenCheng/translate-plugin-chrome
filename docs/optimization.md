# 🚀 翻译延迟优化方案

## 🔍 当前瓶颈分析

### 延迟来源拆解

```
音频输入 ──→ VAD检测 ──→ 缓冲累积 ──→ ASR识别 ──→ 翻译 ──→ 输出
  320ms       检查周期     1秒+       1-2秒       1-3秒      网络
```

**总延迟**: ~3-6 秒（远慢于实时输入）

### 各阶段耗时

| 阶段 | 当前耗时 | 可优化空间 |
|------|---------|-----------|
| 音频分块 | 320ms | 可降至 160ms |
| VAD 检测 | 每 320ms 检查 | 可改为 160ms |
| 缓冲累积 | 1.0 秒 | 可降至 0.3 秒 |
| ASR 识别 | 1-2 秒 | 流式可降至 0.5 秒 |
| 翻译 | 1-3 秒 | 流式已实现，首字 0.5 秒 |
| WebSocket 传输 | <50ms | 已优化 |

---

## 🎯 优化方案

### 方案 1: 降低 VAD 阈值和缓冲时间 ⭐⭐⭐

**改动位置**: `backend/websocket/handler.py`

**当前配置**:
```python
self.MIN_SPEECH_DURATION = 1.0  # 等待 1 秒语音才开始识别
```

**优化后**:
```python
self.MIN_SPEECH_DURATION = 0.3  # 300ms 就开始识别
self.SILENCE_THRESHOLD = 1.0    # 降低静音阈值
```

**预期效果**: 
- 延迟降低 ~0.7 秒
- 可能增加误识别（短暂噪音被当作语音）

---

### 方案 2: 优化音频分块策略 ⭐⭐⭐

**改动位置**: `extension/offscreen/offscreen.js` + `backend/websocket/handler.py`

**当前**:
```javascript
// 前端：4096 样本缓冲区
audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
```

**优化**:
```javascript
// 更小的缓冲区，更频繁发送
audioProcessor = audioContext.createScriptProcessor(2048, 1, 1);
```

**预期效果**:
- 音频分块从 320ms 降至 ~160ms
- 更流畅的实时体验

---

### 方案 3: 使用流式 ASR ⭐⭐⭐⭐

**改动位置**: `backend/asr/local_whisper.py` + `backend/websocket/handler.py`

**当前**: 等待完整语音段 → 一次性识别 → 整段翻译

**优化**: 使用 `faster-whisper` 的流式模式

```python
# 新增流式识别方法
async def transcribe_streaming(self, audio, sample_rate):
    segments, info = self.model.transcribe(
        audio,
        beam_size=5,
        language="ja",
        vad_filter=True,  # 启用 VAD 过滤
        word_timestamps=True,
    )
    
    for segment in segments:
        yield {
            "text": segment.text,
            "start": segment.start,
            "end": segment.end,
        }
```

**预期效果**:
- 首字延迟降至 ~1 秒
- 边说边识别，实时性大幅提升

---

### 方案 4: 并行处理 Pipeline ⭐⭐⭐⭐

**改动位置**: `backend/websocket/handler.py`

**当前**: 串行处理
```
ASR 完成 ──→ 翻译开始 ──→ 翻译完成
```

**优化**: 并行处理
```python
async def _process_audio_parallel(self, audio_data, websocket):
    # ASR 识别
    jp_text = await asyncio.to_thread(
        self.asr_engine.transcribe, 
        audio_data, 
        self.SAMPLE_RATE
    )
    
    # 立即发送部分结果
    await self._send_partial(jp_text, "翻译中...")
    
    # 同时开始翻译
    zh_text = await self.translator.translate(jp_text)
    await self._send_final(jp_text, zh_text)
```

**预期效果**:
- 总延迟降低 ~40%
- 用户体验更流畅

---

### 方案 5: 使用更快的 ASR 模型 ⭐⭐

**改动位置**: `.env` 配置

**当前**: `LOCAL_ASR_MODEL=small` (~500MB)

**可选**:
| 模型 | 大小 | 速度 | 准确率 |
|------|------|------|--------|
| `tiny` | 75MB | 最快 | 较低 |
| `base` | 140MB | 快 | 中等 |
| `small` | 500MB | 中等 | 较高 |
| `medium` | 1.5GB | 慢 | 高 |

**推荐**: 如果延迟是关键，使用 `base` 模型

---

### 方案 6: 智能缓冲策略 ⭐⭐⭐

**改动位置**: `backend/audio/stream.py`

**当前**: 固定缓冲 1 秒

**优化**: 动态缓冲
```python
class SmartAudioBuffer:
    def __init__(self):
        self.min_buffer = 0.3   # 最小 300ms
        self.max_buffer = 2.0   # 最大 2 秒
        self.current_buffer = 0.3
        
    def adjust_buffer(self, success_rate):
        # 根据识别成功率动态调整
        if success_rate > 0.8:
            self.current_buffer = max(self.min_buffer, self.current_buffer - 0.1)
        else:
            self.current_buffer = min(self.max_buffer, self.current_buffer + 0.1)
```

**预期效果**:
- 自适应网络和处理能力
- 平衡延迟和准确率

---

## 📊 优化效果预估

| 方案 | 实施难度 | 延迟降低 | 推荐优先级 |
|------|---------|---------|-----------|
| 方案 1: 降低阈值 | ⭐ | ~0.7s | ⭐⭐⭐ |
| 方案 2: 优化分块 | ⭐⭐ | ~0.3s | ⭐⭐⭐ |
| 方案 3: 流式 ASR | ⭐⭐⭐ | ~1.5s | ⭐⭐⭐⭐ |
| 方案 4: 并行处理 | ⭐⭐ | ~1.0s | ⭐⭐⭐⭐ |
| 方案 5: 更快模型 | ⭐ | ~0.5s | ⭐⭐ |
| 方案 6: 智能缓冲 | ⭐⭐⭐ | ~0.5s | ⭐⭐ |

**组合优化后预估**:
- 当前延迟: ~3-6 秒
- 优化后延迟: ~1-2 秒
- **改进幅度**: ~60%

---

## 🚀 实施建议

### 第一阶段（立即见效，30 分钟）
1. ✅ 降低 `MIN_SPEECH_DURATION` 到 0.3 秒
2. ✅ 优化音频分块到 2048 样本

### 第二阶段（中等改动，2-3 小时）
3. ✅ 实现流式 ASR
4. ✅ 并行处理 Pipeline

### 第三阶段（架构优化，1-2 天）
5. ✅ 智能缓冲策略
6. ✅ 模型切换机制

---

## ⚠️ 注意事项

### 降低阈值的副作用
- 可能增加误识别（短暂噪音）
- 建议配合 VAD 过滤使用

### 流式 ASR 的挑战
- `faster-whisper` 的流式支持有限
- 可能需要使用 `whisper-streaming` 库

### 并行处理的复杂度
- 需要处理异步状态管理
- 确保翻译结果与 ASR 结果对应

---

## 📝 总结

**推荐优先实施**: 方案 1 + 方案 2（快速见效）

**中期目标**: 方案 3 + 方案 4（显著提升）

**长期优化**: 方案 5 + 方案 6（架构完善）

实施后预期延迟从 3-6 秒降至 1-2 秒，用户体验大幅改善！
