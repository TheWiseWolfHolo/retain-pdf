from __future__ import annotations


DEFAULT_TARGET_LANGUAGE = "zh-CN"

_TARGET_LANGUAGE_PROFILES: dict[str, dict[str, str]] = {
    "zh-CN": {
        "label": "简体中文",
        "english_name": "Simplified Chinese",
        "style_hint": "Use precise, publication-style Simplified Chinese suitable for scientific and technical documents.",
    },
    "zh-TW": {
        "label": "繁體中文",
        "english_name": "Traditional Chinese",
        "style_hint": "Use precise, publication-style Traditional Chinese suitable for scientific and technical documents.",
    },
    "en": {
        "label": "English",
        "english_name": "English",
        "style_hint": "Use polished, publication-style English suitable for scientific and technical documents.",
    },
    "ja": {
        "label": "日本語",
        "english_name": "Japanese",
        "style_hint": "Use natural Japanese suitable for scientific and technical writing, keeping terminology concise and formal.",
    },
    "ko": {
        "label": "한국어",
        "english_name": "Korean",
        "style_hint": "Use natural Korean suitable for scientific and technical writing, keeping terminology concise and formal.",
    },
    "de": {
        "label": "Deutsch",
        "english_name": "German",
        "style_hint": "Use natural German suitable for scientific and technical writing, keeping terminology concise and formal.",
    },
    "fr": {
        "label": "Français",
        "english_name": "French",
        "style_hint": "Use natural French suitable for scientific and technical writing, keeping terminology concise and formal.",
    },
}

_TARGET_LANGUAGE_ALIASES: dict[str, str] = {
    "zh": "zh-CN",
    "zh-cn": "zh-CN",
    "zh_hans": "zh-CN",
    "zh-hans": "zh-CN",
    "simplified chinese": "zh-CN",
    "chinese": "zh-CN",
    "zh-tw": "zh-TW",
    "zh_hant": "zh-TW",
    "zh-hant": "zh-TW",
    "traditional chinese": "zh-TW",
    "en-us": "en",
    "en-gb": "en",
    "english": "en",
    "ja-jp": "ja",
    "japanese": "ja",
    "ko-kr": "ko",
    "korean": "ko",
    "de-de": "de",
    "german": "de",
    "fr-fr": "fr",
    "french": "fr",
}


def normalize_target_language(value: str | None) -> str:
    raw = str(value or "").strip()
    if not raw:
        return DEFAULT_TARGET_LANGUAGE
    if raw in _TARGET_LANGUAGE_PROFILES:
        return raw
    lowered = raw.lower()
    return _TARGET_LANGUAGE_ALIASES.get(lowered, DEFAULT_TARGET_LANGUAGE)


def target_language_profile(value: str | None) -> dict[str, str]:
    code = normalize_target_language(value)
    return {
        "code": code,
        **_TARGET_LANGUAGE_PROFILES.get(code, _TARGET_LANGUAGE_PROFILES[DEFAULT_TARGET_LANGUAGE]),
    }


def build_target_language_guidance(value: str | None) -> str:
    profile = target_language_profile(value)
    return (
        f"Target output language override: {profile['english_name']} ({profile['code']}). "
        "This override takes precedence over any earlier prompt text that mentions Simplified Chinese. "
        f"{profile['style_hint']}"
    )
