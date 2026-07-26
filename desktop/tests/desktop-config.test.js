const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createDesktopConfigStore } = require("../src/main/desktop-config.js");

test("custom OCR provider survives desktop save and reload", (t) => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), "retainpdf-config-"));
  t.after(() => fs.rmSync(userData, { recursive: true, force: true }));
  const store = createDesktopConfigStore({
    getPath(name) {
      assert.equal(name, "userData");
      return userData;
    },
  });

  store.saveDesktopConfig({
    ocrProvider: "custom_ocr",
    paddleToken: "custom-ocr-key",
    developerConfig: {
      ocrBaseUrl: "https://ocr.example/v1",
      ocrModel: "mistral-ocr-latest",
    },
  });

  const reloaded = store.loadDesktopConfig();
  assert.equal(reloaded.ocrProvider, "custom_ocr");
  assert.equal(reloaded.paddleToken, "custom-ocr-key");
  assert.equal(reloaded.developerConfig.ocrBaseUrl, "https://ocr.example/v1");
  assert.equal(reloaded.developerConfig.ocrModel, "mistral-ocr-latest");
});
