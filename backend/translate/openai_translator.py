from typing import Optional, AsyncGenerator
from openai import AsyncOpenAI
from config import settings


SYSTEM_PROMPT = """你是一个专业的日语到中文翻译助手。请将日语翻译成自然流畅的中文。
要求：
1. 保持口语化表达，保留语气词的情感
2. 如果是专业术语，保持原意准确
3. 只输出翻译结果，不要解释
4. 如果输入不是日语，直接返回原文"""


class OpenAITranslator:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_base_url,
        )
        self.model = settings.openai_model

    async def translate(self, text: str) -> Optional[str]:
        if not text or not text.strip():
            return None

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": text},
                ],
                temperature=0.3,
                max_tokens=500,
            )
            result = response.choices[0].message.content
            return result.strip() if result else None
        except Exception as e:
            print(f"Translation error: {e}")
            return None

    async def translate_stream(self, text: str) -> AsyncGenerator[str, None]:
        if not text or not text.strip():
            return

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": text},
                ],
                temperature=0.3,
                max_tokens=500,
                stream=True,
            )

            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as e:
            print(f"Streaming translation error: {e}")
