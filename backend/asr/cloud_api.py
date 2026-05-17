import numpy as np
from typing import Optional
from config import settings


class CloudASREngine:
    def __init__(self):
        self.provider = settings.cloud_asr_provider
        self.api_key = settings.cloud_asr_api_key

    def transcribe(self, audio: np.ndarray, sample_rate: int = 16000) -> Optional[str]:
        if not self.provider:
            return None

        if self.provider == "openai":
            return self._transcribe_openai(audio, sample_rate)
        elif self.provider == "azure":
            return self._transcribe_azure(audio, sample_rate)
        else:
            print(f"Unknown cloud ASR provider: {self.provider}")
            return None

    def _transcribe_openai(self, audio: np.ndarray, sample_rate: int) -> Optional[str]:
        try:
            import io
            import wave
            from openai import OpenAI

            audio_int16 = np.clip(audio * 32767, -32768, 32767).astype(np.int16)

            buffer = io.BytesIO()
            with wave.open(buffer, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(sample_rate)
                wf.writeframes(audio_int16.tobytes())
            buffer.seek(0)
            buffer.name = "audio.wav"

            client = OpenAI(api_key=settings.openai_api_key)
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=buffer,
                language="ja",
            )
            return response.text.strip()
        except Exception as e:
            print(f"OpenAI ASR error: {e}")
            return None

    def _transcribe_azure(self, audio: np.ndarray, sample_rate: int) -> Optional[str]:
        try:
            import azure.cognitiveservices.speech as speechsdk

            audio_int16 = np.clip(audio * 32767, -32768, 32767).astype(np.int16)

            speech_config = speechsdk.SpeechConfig(
                subscription=self.api_key,
                region="eastasia",
            )
            speech_config.speech_recognition_language = "ja-JP"

            audio_config = speechsdk.audio.AudioConfig(stream=speechsdk.audio.PushAudioInputStream())
            recognizer = speechsdk.SpeechRecognizer(
                speech_config=speech_config,
                audio_config=audio_config,
            )

            result = recognizer.recognize_once_async().get()
            if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                return result.text.strip()
            return None
        except Exception as e:
            print(f"Azure ASR error: {e}")
            return None
