export const DEFAULT_OCR_PROVIDER = "paddle";

export const OCR_PROVIDER_DEFINITIONS = [
  {
    id: "paddle",
    label: "PaddleOCR",
    description: "在线 OCR。",
    tokenField: "paddle_token",
    runtimeConfigKey: "paddleToken",
    tokenLabel: "Paddle Access Token",
    tokenPlaceholder: "Paddle Access Token",
    validationButtonLabel: "检测 Paddle",
    validationIdleMessage: "未检测",
    validationMissingMessage: "请先填写 Paddle Access Token。",
    validationUnavailableMessage: "",
    docsUrl: "https://aistudio.baidu.com/account/accessToken",
    docsLabel: "获取 Token",
    supportsValidation: true,
  },
  {
    id: "custom_ocr",
    label: "自定义 OCR",
    description: "Mistral / LiteLLM 兼容的 POST /v1/ocr。",
    tokenField: "custom_ocr_api_key",
    runtimeConfigKey: "paddleToken",
    tokenLabel: "OCR API Key",
    tokenPlaceholder: "OCR API Key",
    validationButtonLabel: "",
    validationIdleMessage: "",
    validationMissingMessage: "请先填写 OCR API Key。",
    validationUnavailableMessage: "接口将在提交 PDF 时验证。",
    docsUrl: "https://docs.litellm.ai/docs/ocr",
    docsLabel: "接口格式",
    supportsValidation: false,
  },
];

export const TRANSLATION_PROVIDER_DEFINITION = {
  id: "deepseek",
  label: "DeepSeek",
  keyLabel: "DeepSeek Key",
  keyPlaceholder: "DeepSeek API Key",
  description: "翻译模型。",
  docsUrl: "https://platform.deepseek.com/api_keys",
  docsLabel: "获取 Key",
  validationButtonLabel: "检测 DeepSeek",
  validationIdleMessage: "未检测",
  validationMissingMessage: "请先填写 DeepSeek Key。",
  validationSuccessMessage: "DeepSeek 接口连接成功。",
  validationNetworkMessage: "DeepSeek 接口检测失败，请检查网络或浏览器跨域限制。",
  validationUnauthorizedMessage: "DeepSeek Key 无效或已过期。",
};

export function normalizeOcrProvider(value) {
  const provider = `${value || ""}`.trim().toLowerCase();
  return OCR_PROVIDER_DEFINITIONS.some((item) => item.id === provider) ? provider : DEFAULT_OCR_PROVIDER;
}

export function getOcrProviderDefinition(provider) {
  return OCR_PROVIDER_DEFINITIONS.find((item) => item.id === normalizeOcrProvider(provider)) || OCR_PROVIDER_DEFINITIONS[0];
}
