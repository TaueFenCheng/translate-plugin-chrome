import numpy as np
from typing import Optional, Generator
from asr.local_whisper import LocalWhisperEngine
from asr.cloud_api import CloudASREngine


class HybridASREngine:
    def __init__(self):
        self.local_engine = LocalWhisperEngine()
        self.cloud_engine = CloudASREngine()
        self.use_cloud = not self.local_engine.is_loaded
        self.error_count = 0
        self.MAX_LOCAL_ERRORS = 3

    def transcribe(self, audio: np.ndarray, sample_rate: int = 16000) -> Optional[str]:
        if self.use_cloud:
            return self.cloud_engine.transcribe(audio, sample_rate)

        result = self.local_engine.transcribe(audio, sample_rate)
        if result is not None:
            self.error_count = 0
            return result

        self.error_count += 1
        if self.error_count >= self.MAX_LOCAL_ERRORS:
            print("Switching to cloud ASR due to repeated local failures")
            self.use_cloud = True

        return self.cloud_engine.transcribe(audio, sample_rate)

    def transcribe_streaming(
        self, audio: np.ndarray, sample_rate: int = 16000
    ) -> Generator[dict, None, None]:
        if self.use_cloud:
            text = self.cloud_engine.transcribe(audio, sample_rate)
            if text:
                yield {"text": text, "start": 0, "end": 0, "is_final": True}
            return

        for segment in self.local_engine.transcribe_streaming(audio, sample_rate):
            segment["is_final"] = True
            yield segment
