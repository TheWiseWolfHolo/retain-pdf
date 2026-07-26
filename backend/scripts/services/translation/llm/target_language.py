from __future__ import annotations

import os


DEFAULT_TARGET_LANGUAGE = "zh-CN"
TARGET_LANGUAGE_ENV = "RETAIN_TRANSLATION_TARGET_LANGUAGE"

_PROFILES: dict[str, tuple[str, str]] = {
    "zh-CN": ("简体中文", "Use precise, publication-style Simplified Chinese."),
    "zh-TW": ("繁體中文", "Use precise, publication-style Traditional Chinese."),
    "en": ("English", "Use polished, publication-style English."),
    "ja": ("日本語", "Use natural, formal Japanese."),
    "ko": ("한국어", "Use natural, formal Korean."),
    "de": ("Deutsch", "Use natural, formal German."),
    "fr": ("Français", "Use natural, formal French."),
}

_ALIASES = {
    "zh": "zh-CN",
    "zh-cn": "zh-CN",
    "zh-hans": "zh-CN",
    "zh-tw": "zh-TW",
    "zh-hant": "zh-TW",
    "english": "en",
    "en-us": "en",
    "en-gb": "en",
    "japanese": "ja",
    "ja-jp": "ja",
    "korean": "ko",
    "ko-kr": "ko",
    "german": "de",
    "de-de": "de",
    "french": "fr",
    "fr-fr": "fr",
}


def normalize_target_language(value: str | None = None) -> str:
    raw = str(value if value is not None else os.environ.get(TARGET_LANGUAGE_ENV, "")).strip()
    if raw in _PROFILES:
        return raw
    return _ALIASES.get(raw.lower(), DEFAULT_TARGET_LANGUAGE)


def target_language_profile(value: str | None = None) -> dict[str, str]:
    code = normalize_target_language(value)
    label, style_hint = _PROFILES[code]
    return {"code": code, "label": label, "style_hint": style_hint}
