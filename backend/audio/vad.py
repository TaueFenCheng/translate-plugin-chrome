import webrtcvad
import numpy as np


class VoiceActivityDetector:
    def __init__(self, mode: int = 3, frame_ms: int = 30):
        self.vad = webrtcvad.Vad(mode)
        self.frame_ms = frame_ms
        self.sample_rate = 16000
        self.frame_size = int(self.sample_rate * frame_ms / 1000)
        self.speech_frames = 0
        self.total_frames = 0
        self.SPEECH_THRESHOLD = 0.4

    def is_speech(self, audio_chunk: np.ndarray) -> bool:
        if len(audio_chunk) < self.frame_size:
            return False

        audio_bytes = self._float32_to_pcm16(audio_chunk[: self.frame_size])
        try:
            return self.vad.is_speech(audio_bytes, self.sample_rate)
        except Exception:
            return False

    def has_speech(self, audio_buffer: np.ndarray) -> bool:
        if len(audio_buffer) < self.frame_size:
            return False

        frames = self._split_into_frames(audio_buffer)
        if not frames:
            return False

        speech_count = sum(
            1
            for frame in frames
            if self.vad.is_speech(
                self._float32_to_pcm16(frame), self.sample_rate
            )
        )
        return (speech_count / len(frames)) >= self.SPEECH_THRESHOLD

    def _split_into_frames(self, audio: np.ndarray) -> list:
        frames = []
        for i in range(0, len(audio) - self.frame_size + 1, self.frame_size):
            frames.append(audio[i : i + self.frame_size])
        return frames

    def _float32_to_pcm16(self, audio: np.ndarray) -> bytes:
        audio_int16 = np.clip(audio * 32767, -32768, 32767).astype(np.int16)
        return audio_int16.tobytes()
