from typing import Optional, AsyncGenerator
from anthropic import AsyncAnthropic
from config import settings


SYSTEM_PROMPT = """你是一个专业的日语到中文翻译助手。请将日语翻译成自然流畅的中文。
要求：
1. 保持口语化表达，保留语气词的情感
2. 如果是专业术语，保持原意准确
3. 只输出翻译结果，不要解释
4. 如果输入不是日语，直接返回原文"""


class AnthropicTranslator:
    def __init__(self):
        self.client = AsyncAnthropic(
            api_key=settings.translation_api_key,
            base_url=settings.translation_base_url,
        )
        self.model = settings.translation_model

    async def translate(self, text: str) -> Optional[str]:
        if not text or not text.strip():
            return None

        try:
            response = await self.client.messages.create(
                model=self.model,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": text}],
                max_tokens=500,
            )
            result = response.content[0].text
            return result.strip() if result else None
        except Exception as e:
            print(f"Anthropic translation error: {e}")
            return None

    async def translate_stream(self, text: str) -> AsyncGenerator[str, None]:
        if not text or not text.strip():
            return

        try:
            response = await self.client.messages.create(
                model=self.model,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": text}],
                max_tokens=500,
            )
            yield response.content[0].text.strip()
        except Exception as e:
            print(f"Streaming translation error: {e}")
