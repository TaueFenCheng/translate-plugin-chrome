import json
import asyncio
import base64
import numpy as np
import time
from typing import Dict, Optional, AsyncGenerator
from fastapi import WebSocket
from audio.vad import VoiceActivityDetector
from audio.stream import AudioStreamBuffer
from asr.engine import HybridASREngine
from translate.translator_factory import get_translator


class SessionHandler:
    def __init__(self):
        self.vad = VoiceActivityDetector(mode=3)
        self.audio_buffer = AudioStreamBuffer()
        self.asr_engine = HybridASREngine()
        self.translator = get_translator()
        self.is_processing = False
        self.speech_detected = False
        self.current_sentence_id = 0
        self.last_audio_time = 0

        self.MIN_SPEECH_DURATION = 1.0
        self.SILENCE_THRESHOLD = 1.5
        self.SAMPLE_RATE = 16000

    async def handle_audio_chunk(self, chunk_data: str) -> Optional[dict]:
        try:
            audio_bytes = base64.b64decode(chunk_data)
            audio_int16 = np.frombuffer(audio_bytes, dtype=np.int16)
            audio_float = audio_int16.astype(np.float32) / 32768.0

            self.audio_buffer.add_chunk(audio_float)
            self.last_audio_time = time.time()

            if not self.vad.has_speech(self.audio_buffer.get_buffer()):
                return None

            if self.audio_buffer.duration < self.MIN_SPEECH_DURATION:
                return None

            if not self.is_processing:
                self.is_processing = True
                result = await self._process_audio()
                self.is_processing = False
                return result

            return None
        except Exception as e:
            print(f"Audio processing error: {e}")
            return None

    async def handle_audio_chunk_streaming(
        self, chunk_data: str, websocket: WebSocket
    ) -> None:
        try:
            audio_bytes = base64.b64decode(chunk_data)
            audio_int16 = np.frombuffer(audio_bytes, dtype=np.int16)
            audio_float = audio_int16.astype(np.float32) / 32768.0

            self.audio_buffer.add_chunk(audio_float)
            self.last_audio_time = time.time()

            if not self.vad.has_speech(self.audio_buffer.get_buffer()):
                return

            if self.audio_buffer.duration < self.MIN_SPEECH_DURATION:
                return

            if not self.is_processing:
                self.is_processing = True
                await self._process_audio_streaming(websocket)
                self.is_processing = False

        except Exception as e:
            print(f"Audio processing error: {e}")

    async def _process_audio(self) -> Optional[dict]:
        audio_data = self.audio_buffer.get_and_clear()

        if len(audio_data) < self.SAMPLE_RATE:
            return None

        jp_text = self.asr_engine.transcribe(audio_data, self.SAMPLE_RATE)
        if not jp_text:
            return None

        self.current_sentence_id += 1
        current_id = self.current_sentence_id

        zh_text = await self.translator.translate(jp_text)

        return {
            "type": "final",
            "text_jp": jp_text,
            "text_zh": zh_text or "",
            "id": current_id,
        }

    async def _process_audio_streaming(self, websocket: WebSocket) -> None:
        audio_data = self.audio_buffer.get_and_clear()

        if len(audio_data) < self.SAMPLE_RATE:
            return

        jp_text = self.asr_engine.transcribe(audio_data, self.SAMPLE_RATE)
        if not jp_text:
            return

        self.current_sentence_id += 1
        current_id = self.current_sentence_id

        # 先发送部分结果（日文识别完成）
        await websocket.send_text(
            json.dumps({
                "type": "partial",
                "text_jp": jp_text,
                "text_zh": "翻译中...",
                "id": current_id,
            })
        )

        # 使用流式翻译，逐步发送中文结果
        zh_text_parts = []
        async for chunk in self.translator.translate_stream(jp_text):
            zh_text_parts.append(chunk)
            await websocket.send_text(
                json.dumps({
                    "type": "partial",
                    "text_jp": jp_text,
                    "text_zh": "".join(zh_text_parts),
                    "id": current_id,
                })
            )

        # 发送最终结果
        final_zh = "".join(zh_text_parts)
        await websocket.send_text(
            json.dumps({
                "type": "final",
                "text_jp": jp_text,
                "text_zh": final_zh,
                "id": current_id,
            })
        )

    def reset(self):
        self.audio_buffer.clear()
        self.is_processing = False
        self.speech_detected = False
