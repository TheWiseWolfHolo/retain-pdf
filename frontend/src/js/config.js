import { $ } from "./dom.js";
import {
  BROWSER_CONFIG_STORAGE_KEY,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_RATE_LIMIT_QPS,
  DEFAULT_RATE_LIMIT_RPM,
  DEFAULT_TARGET_LANGUAGE,
  DEFAULT_WORKERS,
} from "./constants.js";
import { normalizeBrowserStoredConfig } from "./model-catalog.js";

let runtimeConfig = { ...(window.__FRONT_RUNTIME_CONFIG__ || {}) };

const tauriInternals = typeof window.__TAURI_INTERNALS__ === "object" ? window.__TAURI_INTERNALS__ : null;
const desktopBridge = tauriInternals && typeof tauriInternals.invoke === "function"
  ? {
      invoke(command, args = {}) {
        return tauriInternals.invoke(command, args);
      },
    }
  : null;

export function apiBase() {
  if (typeof runtimeConfig.apiBase === "string" && runtimeConfig.apiBase.trim()) {
    return runtimeConfig.apiBase.trim().replace(/\/$/, "");
  }
  const host = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${host}:41000`;
}

export function frontendApiKey() {
  return typeof runtimeConfig.xApiKey === "string" ? runtimeConfig.xApiKey.trim() : "";
}

export function buildApiHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const apiKey = frontendApiKey();
  if (apiKey) {
    headers["X-API-KEY"] = apiKey;
  }
  return headers;
}

export function defaultMineruToken() {
  return typeof runtimeConfig.mineruToken === "string" ? runtimeConfig.mineruToken : "";
}

export function defaultModelApiKey() {
  return typeof runtimeConfig.modelApiKey === "string" ? runtimeConfig.modelApiKey : "";
}

export function defaultModelName() {
  return typeof runtimeConfig.model === "string" && runtimeConfig.model.trim()
    ? runtimeConfig.model.trim()
    : DEFAULT_MODEL;
}

export function defaultModelBaseUrl() {
  return typeof runtimeConfig.baseUrl === "string" && runtimeConfig.baseUrl.trim()
    ? runtimeConfig.baseUrl.trim()
    : DEFAULT_BASE_URL;
}

export function defaultTargetLanguage() {
  return typeof runtimeConfig.targetLanguage === "string" && runtimeConfig.targetLanguage.trim()
    ? runtimeConfig.targetLanguage.trim()
    : DEFAULT_TARGET_LANGUAGE;
}

export function defaultWorkers() {
  const parsed = Number.parseInt(`${runtimeConfig.workers ?? ""}`.trim(), 10);
  return Number.isFinite(parsed) && (parsed > 0 || parsed === -1) ? parsed : DEFAULT_WORKERS;
}

export function defaultRateLimitQps() {
  const parsed = Number.parseInt(`${runtimeConfig.rateLimitQps ?? ""}`.trim(), 10);
  return Number.isFinite(parsed) && (parsed >= 0 || parsed === -1) ? parsed : DEFAULT_RATE_LIMIT_QPS;
}

export function defaultRateLimitRpm() {
  const parsed = Number.parseInt(`${runtimeConfig.rateLimitRpm ?? ""}`.trim(), 10);
  return Number.isFinite(parsed) && (parsed >= 0 || parsed === -1) ? parsed : DEFAULT_RATE_LIMIT_RPM;
}

export function isDesktopMode() {
  return !!desktopBridge;
}

export function setRuntimeConfig(nextConfig = {}) {
  runtimeConfig = {
    ...runtimeConfig,
    ...nextConfig,
  };
}

export function loadBrowserStoredConfig() {
  if (isDesktopMode() || typeof window.localStorage === "undefined") {
    return normalizeBrowserStoredConfig({}, {
      defaultBaseUrl: defaultModelBaseUrl(),
      defaultModel: defaultModelName(),
      defaultTargetLanguage: defaultTargetLanguage(),
      defaultWorkers: defaultWorkers(),
    });
  }
  try {
    const raw = window.localStorage.getItem(BROWSER_CONFIG_STORAGE_KEY);
    if (!raw) {
      return normalizeBrowserStoredConfig({}, {
        defaultBaseUrl: defaultModelBaseUrl(),
        defaultModel: defaultModelName(),
        defaultTargetLanguage: defaultTargetLanguage(),
        defaultWorkers: defaultWorkers(),
      });
    }
    const parsed = JSON.parse(raw);
    return normalizeBrowserStoredConfig(typeof parsed === "object" && parsed ? parsed : {}, {
      defaultBaseUrl: defaultModelBaseUrl(),
      defaultModel: defaultModelName(),
      defaultTargetLanguage: defaultTargetLanguage(),
      defaultWorkers: defaultWorkers(),
    });
  } catch (_err) {
    return normalizeBrowserStoredConfig({}, {
      defaultBaseUrl: defaultModelBaseUrl(),
      defaultModel: defaultModelName(),
      defaultTargetLanguage: defaultTargetLanguage(),
      defaultWorkers: defaultWorkers(),
    });
  }
}

export function saveBrowserStoredConfig() {
  if (isDesktopMode() || typeof window.localStorage === "undefined") {
    return;
  }
  const payload = {
    mineruToken: $("mineru_token")?.value || "",
    modelApiKey: $("api_key")?.value || "",
    modelBaseUrl: $("model_base_url")?.value || defaultModelBaseUrl(),
    model: $("model_name")?.value || defaultModelName(),
    targetLanguage: $("target_language")?.value || defaultTargetLanguage(),
    workers: $("translation_workers")?.value || defaultWorkers(),
    rateLimitQps: $("rate_limit_qps")?.value || defaultRateLimitQps(),
    rateLimitRpm: $("rate_limit_rpm")?.value || defaultRateLimitRpm(),
  };
  try {
    window.localStorage.setItem(BROWSER_CONFIG_STORAGE_KEY, JSON.stringify(payload));
  } catch (_err) {
    // Ignore storage quota / privacy mode failures.
  }
}

export function applyKeyInputs(mineruToken, modelApiKey) {
  $("mineru_token").value = mineruToken || "";
  $("api_key").value = modelApiKey || "";
  if ($("setup-mineru-token")) {
    $("setup-mineru-token").value = mineruToken || "";
  }
  if ($("setup-model-api-key")) {
    $("setup-model-api-key").value = modelApiKey || "";
  }
  if ($("settings-mineru-token")) {
    $("settings-mineru-token").value = mineruToken || "";
  }
  if ($("settings-model-api-key")) {
    $("settings-model-api-key").value = modelApiKey || "";
  }
}

export function applyModelConfigInputs(modelBaseUrl, modelName) {
  const resolvedBaseUrl = modelBaseUrl || defaultModelBaseUrl();
  const resolvedModel = modelName || defaultModelName();

  if ($("model_base_url")) {
    $("model_base_url").value = resolvedBaseUrl;
  }
  if ($("model_name")) {
    $("model_name").value = resolvedModel;
  }
  if ($("browser-model-base-url")) {
    $("browser-model-base-url").value = resolvedBaseUrl;
  }
  if ($("browser-model-id")) {
    $("browser-model-id").value = resolvedModel;
  }
}

export function applyTranslationPreferenceInputs(
  targetLanguage,
  workers,
  rateLimitQps,
  rateLimitRpm,
) {
  const resolvedTargetLanguage = targetLanguage || defaultTargetLanguage();
  const rawWorkers = Number(workers);
  const resolvedWorkers = Number.isFinite(rawWorkers) && (rawWorkers > 0 || rawWorkers === -1)
    ? Math.trunc(rawWorkers)
    : defaultWorkers();
  const rawRateLimitQps = Number(rateLimitQps);
  const resolvedRateLimitQps = Number.isFinite(rawRateLimitQps) && (rawRateLimitQps >= 0 || rawRateLimitQps === -1)
    ? Math.trunc(rawRateLimitQps)
    : defaultRateLimitQps();
  const rawRateLimitRpm = Number(rateLimitRpm);
  const resolvedRateLimitRpm = Number.isFinite(rawRateLimitRpm) && (rawRateLimitRpm >= 0 || rawRateLimitRpm === -1)
    ? Math.trunc(rawRateLimitRpm)
    : defaultRateLimitRpm();

  if ($("target_language")) {
    $("target_language").value = resolvedTargetLanguage;
  }
  if ($("translation_workers")) {
    $("translation_workers").value = String(resolvedWorkers);
  }
  if ($("rate_limit_qps")) {
    $("rate_limit_qps").value = String(resolvedRateLimitQps);
  }
  if ($("rate_limit_rpm")) {
    $("rate_limit_rpm").value = String(resolvedRateLimitRpm);
  }
  if ($("browser-target-language")) {
    $("browser-target-language").value = resolvedTargetLanguage;
  }
  if ($("browser-workers")) {
    $("browser-workers").value = String(resolvedWorkers);
  }
  if ($("browser-rate-limit-qps")) {
    $("browser-rate-limit-qps").value = String(resolvedRateLimitQps);
  }
  if ($("browser-rate-limit-rpm")) {
    $("browser-rate-limit-rpm").value = String(resolvedRateLimitRpm);
  }
}

export async function desktopInvoke(command, args = {}) {
  if (!desktopBridge) {
    throw new Error("桌面接口不可用");
  }
  return desktopBridge.invoke(command, args);
}
