from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"

    translation_provider: str = "deepseek"
    translation_api_key: str = ""
    translation_base_url: str = "https://api.deepseek.com/anthropic"
    translation_model: str = "deepseek-chat"

    local_asr_model: str = "small"
    local_asr_device: str = "auto"

    cloud_asr_provider: Optional[str] = None
    cloud_asr_api_key: Optional[str] = None

    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"

    class Config:
        env_file = ".env"


settings = Settings()
