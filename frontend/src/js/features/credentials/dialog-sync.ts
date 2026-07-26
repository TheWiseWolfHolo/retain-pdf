import { normalizeOcrProvider } from "../../config/providers.js";
import { createCredentialDialogElementsPort } from "./dialog-elements-port.js";

export function syncCredentialDialogFields({
  credentials,
  taskOptions = {},
  defaultModelBaseUrl,
  defaultModelApiKey,
  elementsPort = createCredentialDialogElementsPort(),
}: any) {
  const {
    paddleInput,
    apiKeyInput,
    modelBaseUrlInput,
    modelNameInput,
    providerProfileIdInput,
    targetLanguageSelect,
    rateLimitQpsInput,
    rateLimitRpmInput,
    mathModeSelect,
  } = elementsPort.elements();

  if (paddleInput) {
    paddleInput.value = credentials.paddleToken || "";
  }
  if (apiKeyInput) {
    // 只展示设置里已存的 Key，不从 runtime 回填（避免「设置空白却仍能问答」）
    void defaultModelApiKey;
    apiKeyInput.value = `${credentials.modelApiKey || ""}`.trim();
  }
  if (modelBaseUrlInput) {
    modelBaseUrlInput.value = taskOptions.baseUrl || defaultModelBaseUrl?.() || "";
  }
  if (modelNameInput) {
    modelNameInput.value = taskOptions.model || "";
  }
  if (providerProfileIdInput) {
    providerProfileIdInput.value = taskOptions.providerProfileId || taskOptions.provider_profile_id || "";
  }
  if (targetLanguageSelect) {
    targetLanguageSelect.value = taskOptions.targetLanguage || taskOptions.target_language || "zh-CN";
  }
  if (rateLimitQpsInput) {
    rateLimitQpsInput.value = `${taskOptions.rateLimitQps || taskOptions.rate_limit_qps || 0}`;
  }
  if (rateLimitRpmInput) {
    rateLimitRpmInput.value = `${taskOptions.rateLimitRpm || taskOptions.rate_limit_rpm || 0}`;
  }
  if (mathModeSelect) {
    mathModeSelect.value = taskOptions.mathMode === "placeholder" ? "placeholder" : "direct_typst";
  }
  elementsPort.syncOcrProviderControls(normalizeOcrProvider(credentials.ocrProvider));
}
