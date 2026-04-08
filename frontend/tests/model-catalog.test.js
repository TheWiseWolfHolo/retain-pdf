import test from "node:test";
import assert from "node:assert/strict";

test("normalizeModelCatalogResponse deduplicates ids and preserves provider metadata", async () => {
  const { normalizeModelCatalogResponse } = await import("../src/js/model-catalog.js");

  const result = normalizeModelCatalogResponse({
    data: [
      { id: "deepseek-chat", owned_by: "deepseek" },
      { id: "gpt-4.1", owned_by: "openai" },
      { id: "deepseek-chat", owned_by: "deepseek" },
      { id: "  kimi-k2  ", owned_by: "moonshot" },
      { id: "", owned_by: "ignored" },
    ],
  });

  assert.deepEqual(result, [
    { id: "deepseek-chat", ownedBy: "deepseek", label: "deepseek-chat" },
    { id: "gpt-4.1", ownedBy: "openai", label: "gpt-4.1" },
    { id: "kimi-k2", ownedBy: "moonshot", label: "kimi-k2" },
  ]);
});

test("normalizeBrowserStoredConfig falls back to runtime defaults when values are missing", async () => {
  const { normalizeBrowserStoredConfig } = await import("../src/js/model-catalog.js");

  const result = normalizeBrowserStoredConfig(
    {
      mineruToken: "mineru-123",
      modelApiKey: "sk-local",
    },
    {
      defaultBaseUrl: "https://gateway.example.com/v1",
      defaultModel: "gpt-4.1-mini",
      defaultTargetLanguage: "zh-CN",
      defaultWorkers: 100,
    },
  );

  assert.deepEqual(result, {
    mineruToken: "mineru-123",
    modelApiKey: "sk-local",
    modelBaseUrl: "https://gateway.example.com/v1",
    model: "gpt-4.1-mini",
    targetLanguage: "zh-CN",
    workers: 100,
    rateLimitQps: 0,
    rateLimitRpm: 0,
  });
});

test("normalizeBrowserStoredConfig trims explicit model config", async () => {
  const { normalizeBrowserStoredConfig } = await import("../src/js/model-catalog.js");

  const result = normalizeBrowserStoredConfig(
    {
      mineruToken: "  mineru-123  ",
      modelApiKey: "  sk-local  ",
      modelBaseUrl: " https://proxy.example.com/v1/ ",
      model: " claude-3.7-sonnet ",
      targetLanguage: " ja ",
      workers: " 6 ",
      rateLimitQps: " 2 ",
      rateLimitRpm: " 90 ",
    },
    {
      defaultBaseUrl: "https://fallback.example.com/v1",
      defaultModel: "fallback-model",
      defaultTargetLanguage: "zh-CN",
      defaultWorkers: 100,
    },
  );

  assert.deepEqual(result, {
    mineruToken: "mineru-123",
    modelApiKey: "sk-local",
    modelBaseUrl: "https://proxy.example.com/v1/",
    model: "claude-3.7-sonnet",
    targetLanguage: "ja",
    workers: 6,
    rateLimitQps: 2,
    rateLimitRpm: 90,
  });
});

test("normalizeBrowserStoredConfig preserves -1 sentinel for unlimited controls", async () => {
  const { normalizeBrowserStoredConfig } = await import("../src/js/model-catalog.js");

  const result = normalizeBrowserStoredConfig(
    {
      workers: "-1",
      rateLimitQps: "-1",
      rateLimitRpm: "-1",
    },
    {
      defaultBaseUrl: "https://fallback.example.com/v1",
      defaultModel: "fallback-model",
      defaultTargetLanguage: "zh-CN",
      defaultWorkers: 100,
    },
  );

  assert.equal(result.workers, -1);
  assert.equal(result.rateLimitQps, -1);
  assert.equal(result.rateLimitRpm, -1);
});
