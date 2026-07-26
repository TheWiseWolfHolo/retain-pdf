import { createCredentialDialogElementsPort } from "./dialog-elements-port.js";

/** Values read from the browser credential dialog inputs. */
export interface CredentialDialogValues {
  paddleToken: string;
  modelApiKey: string;
  modelBaseUrl: string;
  modelName: string;
  providerProfileId: string;
  targetLanguage: string;
  rateLimitQps: number;
  rateLimitRpm: number;
  mathMode: string;
}

export interface CredentialDialogElementsLike {
  paddleInput?: { value?: string } | null;
  apiKeyInput?: { value?: string } | null;
  modelBaseUrlInput?: { value?: string } | null;
  modelNameInput?: { value?: string } | null;
  providerProfileIdInput?: { value?: string } | null;
  targetLanguageSelect?: { value?: string } | null;
  rateLimitQpsInput?: { value?: string } | null;
  rateLimitRpmInput?: { value?: string } | null;
  mathModeSelect?: { value?: string } | null;
}

export interface ReadCredentialDialogValuesOptions {
  elementsPort?: {
    elements: () => CredentialDialogElementsLike;
  };
}

export interface BuildBrowserCredentialConfigOptions {
  values: Pick<CredentialDialogValues, "paddleToken" | "modelApiKey">;
  currentOcrProvider: () => string;
  defaultModelApiKey?: () => string;
}

export interface BuildTaskOptionsFromDialogValuesOptions {
  values: Pick<
    CredentialDialogValues,
    "modelName" | "modelBaseUrl" | "providerProfileId" | "targetLanguage"
      | "rateLimitQps" | "rateLimitRpm" | "mathMode"
  >;
  defaultModelBaseUrl?: () => string;
}

export function readCredentialDialogValues({
  elementsPort = createCredentialDialogElementsPort(),
}: ReadCredentialDialogValuesOptions = {}): CredentialDialogValues {
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
  return {
    paddleToken: paddleInput?.value?.trim() || "",
    modelApiKey: apiKeyInput?.value?.trim() || "",
    modelBaseUrl: modelBaseUrlInput?.value?.trim() || "",
    modelName: modelNameInput?.value?.trim() || "",
    providerProfileId: providerProfileIdInput?.value?.trim() || "",
    targetLanguage: targetLanguageSelect?.value?.trim() || "zh-CN",
    rateLimitQps: Math.max(0, Number(rateLimitQpsInput?.value || 0) || 0),
    rateLimitRpm: Math.max(0, Number(rateLimitRpmInput?.value || 0) || 0),
    mathMode: mathModeSelect?.value || "direct_typst",
  };
}

export function buildBrowserCredentialConfig({
  values,
  currentOcrProvider,
  // defaultModelApiKey 保留参数兼容调用方，但不再静默写入设置（密钥只认对话框/用户输入）
  defaultModelApiKey: _defaultModelApiKey,
}: BuildBrowserCredentialConfigOptions) {
  return {
    ocrProvider: currentOcrProvider(),
    paddleToken: values.paddleToken,
    modelApiKey: `${values.modelApiKey || ""}`.trim(),
  };
}

export function buildTaskOptionsFromDialogValues({
  values,
  defaultModelBaseUrl,
}: BuildTaskOptionsFromDialogValuesOptions) {
  return {
    model: values.modelName,
    baseUrl: values.modelBaseUrl || defaultModelBaseUrl?.() || "",
    providerProfileId: values.providerProfileId,
    targetLanguage: values.targetLanguage,
    rateLimitQps: values.rateLimitQps,
    rateLimitRpm: values.rateLimitRpm,
    mathMode: values.mathMode,
    translateTitles: true,
  };
}

export function ocrTokenFromDialogValues(
  values: Partial<Pick<CredentialDialogValues, "paddleToken">> = {},
) {
  return values.paddleToken;
}
