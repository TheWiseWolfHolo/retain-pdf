import sys
import unittest
import importlib.util
import os
import types
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


class TypstProjectRootTests(unittest.TestCase):
    def test_background_compile_root_uses_job_common_ancestor(self):
        fitz_stub = types.ModuleType("fitz")
        fitz_stub.Document = object
        fitz_stub.Page = object
        fitz_stub.Rect = object
        fitz_stub.Matrix = object
        sys.modules.setdefault("fitz", fitz_stub)
        module = load_module("retainpdf_typst_compiler", "services/rendering/typst/compiler.py")

        work_dir = Path("/data/jobs/20260408011752-c56188/rendered/typst/background-book")
        source_pdf_path = Path("/data/jobs/20260408011752-c56188/source/example.pdf")

        resolved = module.resolve_typst_project_root(
            work_dir / "book-background-overlay.typ",
            source_pdf_path,
        )

        expected = Path(
            os.path.commonpath(
                [
                    (work_dir / "book-background-overlay.typ").resolve(strict=False),
                    source_pdf_path.resolve(strict=False),
                ]
            )
        )
        self.assertEqual(resolved, expected)


if __name__ == "__main__":
    unittest.main()
