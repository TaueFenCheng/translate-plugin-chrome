import numpy as np
from typing import Optional
from config import settings


class LocalWhisperEngine:
    def __init__(self):
        self.model = None
        self.is_loaded = False
        self._load_model()

    def _load_model(self):
        try:
            from faster_whisper import WhisperModel

            self.model = WhisperModel(
                settings.local_asr_model,
                device=settings.local_asr_device,
                compute_type="int8",
            )
            self.is_loaded = True
            print(f"Local Whisper model loaded: {settings.local_asr_model}")
        except Exception as e:
            print(f"Failed to load local Whisper model: {e}")
            self.is_loaded = False

    def transcribe(self, audio: np.ndarray, sample_rate: int = 16000) -> Optional[str]:
        if not self.is_loaded or self.model is None:
            return None

        try:
            segments, info = self.model.transcribe(
                audio,
                beam_size=5,
                language="ja",
                vad_filter=False,
            )

            texts = []
            for segment in segments:
                texts.append(segment.text.strip())

            return " ".join(texts) if texts else None
        except Exception as e:
            print(f"Local transcription error: {e}")
            return None

    def transcribe_streaming(self, audio: np.ndarray, sample_rate: int = 16000):
        if not self.is_loaded or self.model is None:
            return

        try:
            segments, info = self.model.transcribe(
                audio,
                beam_size=5,
                language="ja",
                vad_filter=False,
            )

            for segment in segments:
                yield {
                    "text": segment.text.strip(),
                    "start": segment.start,
                    "end": segment.end,
                }
        except Exception as e:
            print(f"Local streaming transcription error: {e}")
