from __future__ import annotations

import importlib
import json
import os
import unittest
from unittest.mock import Mock, patch

from services.translation.llm.providers.anthropic import client as anthropic
from services.translation.llm.providers.custom_json import client as custom_json
from services.translation.llm.providers.gemini import client as gemini
from services.translation.llm.request_limits import min_interval_seconds
from services.translation.llm.target_language import target_language_profile


class ProviderAdapterTests(unittest.TestCase):
    def tearDown(self) -> None:
        for key in [
            "RETAIN_TRANSLATION_PROVIDER_ADAPTER",
            "RETAIN_TRANSLATION_REQUEST_FORMAT_JSON",
            "RETAIN_TRANSLATION_STREAM",
            "RETAIN_TRANSLATION_TARGET_LANGUAGE",
            "RETAIN_TRANSLATION_RATE_LIMIT_QPS",
            "RETAIN_TRANSLATION_RATE_LIMIT_RPM",
        ]:
            os.environ.pop(key, None)

    def test_anthropic_maps_system_and_messages(self) -> None:
        response = Mock()
        response.json.return_value = {"content": [{"type": "text", "text": "译文"}]}
        with patch.object(anthropic, "request_with_retries", return_value=response) as request:
            result = anthropic.request_chat_content(
                [
                    {"role": "system", "content": "system"},
                    {"role": "user", "content": "hello"},
                ],
                api_key="sk-test",
                model="claude-test",
                base_url="https://api.anthropic.com",
            )
        self.assertEqual(result, "译文")
        body = request.call_args.kwargs["body"]
        self.assertEqual(body["system"], "system")
        self.assertEqual(body["messages"], [{"role": "user", "content": "hello"}])
        self.assertEqual(
            request.call_args.kwargs["url"],
            "https://api.anthropic.com/v1/messages",
        )

    def test_gemini_maps_messages_and_extracts_parts(self) -> None:
        response = Mock()
        response.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "A"}, {"text": "B"}]}}]
        }
        with patch.object(gemini, "request_with_retries", return_value=response) as request:
            result = gemini.request_chat_content(
                [
                    {"role": "system", "content": "system"},
                    {"role": "user", "content": "hello"},
                ],
                api_key="key",
                model="gemini-test",
                response_format={"type": "json_object"},
            )
        self.assertEqual(result, "AB")
        body = request.call_args.kwargs["body"]
        self.assertEqual(body["systemInstruction"]["parts"], [{"text": "system"}])
        self.assertEqual(body["contents"][0]["role"], "user")
        self.assertEqual(
            body["generationConfig"]["responseMimeType"],
            "application/json",
        )

    def test_custom_json_injects_typed_messages_and_extracts_content(self) -> None:
        os.environ["RETAIN_TRANSLATION_REQUEST_FORMAT_JSON"] = json.dumps(
            {
                "request": {
                    "method": "POST",
                    "path": "/translate",
                    "headers": {"Authorization": "Bearer {{api_key}}"},
                    "body": {
                        "model": "{{model}}",
                        "messages": "{{messages}}",
                        "temperature": "{{temperature}}",
                    },
                },
                "response": {"content_path": "result.items[0].text"},
            }
        )
        response = Mock()
        response.json.return_value = {"result": {"items": [{"text": "完成"}]}}
        messages = [{"role": "user", "content": "hello"}]
        with patch.object(custom_json, "request_with_retries", return_value=response) as request:
            result = custom_json.request_chat_content(
                messages,
                api_key="key",
                model="custom-model",
                base_url="https://example.com/api",
                temperature=0.3,
            )
        self.assertEqual(result, "完成")
        body = request.call_args.kwargs["body"]
        self.assertEqual(body["messages"], messages)
        self.assertEqual(body["temperature"], 0.3)
        self.assertEqual(
            request.call_args.kwargs["headers"]["Authorization"],
            "Bearer key",
        )

    def test_registry_selects_explicit_adapter(self) -> None:
        import services.translation.llm.shared.provider_registry as registry

        os.environ["RETAIN_TRANSLATION_PROVIDER_ADAPTER"] = "anthropic_messages"
        registry = importlib.reload(registry)
        self.assertEqual(
            registry.resolve_active_provider_runtime().provider_id,
            "anthropic_messages",
        )

    def test_target_language_profile_reads_job_environment(self) -> None:
        os.environ["RETAIN_TRANSLATION_TARGET_LANGUAGE"] = "ja"
        self.assertEqual(target_language_profile()["label"], "日本語")

    def test_request_limit_uses_stricter_qps_or_rpm_value(self) -> None:
        os.environ["RETAIN_TRANSLATION_RATE_LIMIT_QPS"] = "10"
        os.environ["RETAIN_TRANSLATION_RATE_LIMIT_RPM"] = "30"
        self.assertEqual(min_interval_seconds(), 2.0)


if __name__ == "__main__":
    unittest.main()
