import sys
import unittest
import importlib.util
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


def load_module(module_name: str, relative_path: str):
    spec = importlib.util.spec_from_file_location(module_name, REPO_SCRIPTS_ROOT / relative_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


class TargetLanguageAndRateLimitTests(unittest.TestCase):
    def test_target_language_guidance_overrides_default_chinese_prompt(self):
        module = load_module("retainpdf_target_language", "services/translation/llm/target_language.py")

        guidance = module.build_target_language_guidance("ja")

        self.assertIn("Japanese", guidance)
        self.assertIn("override", guidance.lower())

    def test_rate_limit_interval_uses_stricter_of_qps_and_rpm(self):
        module = load_module("retainpdf_request_limits", "services/translation/llm/request_limits.py")

        self.assertAlmostEqual(module.compute_min_interval_seconds(rate_limit_qps=2, rate_limit_rpm=0), 0.5)
        self.assertAlmostEqual(module.compute_min_interval_seconds(rate_limit_qps=0, rate_limit_rpm=30), 2.0)
        self.assertAlmostEqual(module.compute_min_interval_seconds(rate_limit_qps=4, rate_limit_rpm=60), 1.0)
        self.assertEqual(module.normalize_rate_limit(-1), 0)

    def test_parallelism_helpers_support_unlimited_worker_sentinel(self):
        module = load_module("retainpdf_parallelism", "services/translation/parallelism.py")

        self.assertEqual(module.normalize_requested_workers(-1), -1)
        self.assertEqual(module.resolve_executor_workers(-1, 5), 5)
        self.assertEqual(module.resolve_executor_workers(-1, 5, cap=4), 4)
        self.assertEqual(module.resolve_executor_workers(3, 10), 3)


if __name__ == "__main__":
    unittest.main()
