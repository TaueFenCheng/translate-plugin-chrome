from config import settings
from translate.openai_translator import OpenAITranslator
from translate.anthropic_translator import AnthropicTranslator


def get_translator():
    provider = settings.translation_provider.lower()
    
    if provider == "deepseek":
        print(f"Using DeepSeek translator (model: {settings.translation_model})")
        return AnthropicTranslator()
    
    print(f"Using OpenAI translator (model: {settings.openai_model})")
    return OpenAITranslator()
