function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNonNegativeInt(value, fallback = 0) {
  const raw = typeof value === "number" ? value : Number.parseInt(trimString(value), 10);
  if (!Number.isFinite(raw) || raw < 0) {
    return fallback;
  }
  return Math.trunc(raw);
}

function normalizePositiveOrUnlimitedInt(value, fallback = 1) {
  const raw = typeof value === "number" ? value : Number.parseInt(trimString(value), 10);
  if (!Number.isFinite(raw)) {
    return fallback;
  }
  const normalized = Math.trunc(raw);
  if (normalized === -1 || normalized > 0) {
    return normalized;
  }
  return fallback;
}

function normalizeRateLimitControl(value, fallback = 0) {
  const raw = typeof value === "number" ? value : Number.parseInt(trimString(value), 10);
  if (!Number.isFinite(raw)) {
    return fallback;
  }
  const normalized = Math.trunc(raw);
  if (normalized === -1 || normalized >= 0) {
    return normalized;
  }
  return fallback;
}

export function normalizeModelCatalogResponse(payload) {
  const rawItems = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : [];

  const seen = new Set();
  const normalized = [];

  for (const item of rawItems) {
    const id = trimString(item?.id || item?.name || item?.model);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    normalized.push({
      id,
      ownedBy: trimString(item?.owned_by || item?.provider || item?.vendor),
      label: id,
    });
  }

  return normalized.sort((left, right) => left.id.localeCompare(right.id, undefined, {
    numeric: true,
    sensitivity: "base",
  }));
}

export function normalizeBrowserStoredConfig(rawConfig = {}, defaults = {}) {
  const defaultBaseUrl = trimString(defaults.defaultBaseUrl);
  const defaultModel = trimString(defaults.defaultModel);
  const defaultTargetLanguage = trimString(defaults.defaultTargetLanguage) || "zh-CN";
  const defaultWorkers = normalizeNonNegativeInt(defaults.defaultWorkers, 100) || 100;

  return {
    mineruToken: trimString(rawConfig.mineruToken),
    modelApiKey: trimString(rawConfig.modelApiKey),
    modelBaseUrl: trimString(rawConfig.modelBaseUrl || rawConfig.baseUrl) || defaultBaseUrl,
    model: trimString(rawConfig.model) || defaultModel,
    targetLanguage: trimString(rawConfig.targetLanguage) || defaultTargetLanguage,
    workers: normalizePositiveOrUnlimitedInt(rawConfig.workers, defaultWorkers),
    rateLimitQps: normalizeRateLimitControl(rawConfig.rateLimitQps, 0),
    rateLimitRpm: normalizeRateLimitControl(rawConfig.rateLimitRpm, 0),
  };
}

export function resolvePreferredModel(items = [], preferredModel = "") {
  const normalizedPreferred = trimString(preferredModel);
  if (!normalizedPreferred) {
    return items.length === 1 ? items[0].id : "";
  }
  const exact = items.find((item) => item.id === normalizedPreferred);
  if (exact) {
    return exact.id;
  }
  const fuzzy = items.find((item) => item.id.toLowerCase() === normalizedPreferred.toLowerCase());
  return fuzzy?.id || "";
}
