import numpy as np
from collections import deque
from typing import Optional


class AudioStreamBuffer:
    def __init__(
        self,
        sample_rate: int = 16000,
        chunk_duration: float = 0.32,
        max_buffer_seconds: float = 5.0,
    ):
        self.sample_rate = sample_rate
        self.chunk_size = int(sample_rate * chunk_duration)
        self.max_buffer_size = int(sample_rate * max_buffer_seconds)
        self.buffer = deque()
        self.total_samples = 0

    def add_chunk(self, audio_data: np.ndarray) -> None:
        for sample in audio_data:
            self.buffer.append(sample)
            self.total_samples += 1
            if len(self.buffer) > self.max_buffer_size:
                self.buffer.popleft()

    def get_buffer(self) -> np.ndarray:
        return np.array(list(self.buffer), dtype=np.float32)

    def get_and_clear(self) -> np.ndarray:
        data = self.get_buffer()
        self.buffer.clear()
        self.total_samples = 0
        return data

    def has_enough_audio(self, min_seconds: float = 1.0) -> bool:
        return self.total_samples >= int(self.sample_rate * min_seconds)

    def clear(self) -> None:
        self.buffer.clear()
        self.total_samples = 0

    @property
    def duration(self) -> float:
        return self.total_samples / self.sample_rate
