export function positiveInteger(value, fallback) {
  const fallbackNumber = Number(fallback);
  const normalizedFallback = Number.isFinite(fallbackNumber) && fallbackNumber > 0
    ? Math.floor(fallbackNumber)
    : 1;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return normalizedFallback;
  }
  return Math.floor(number);
}

export function buildDeveloperConfigWithDefaults({
  saved,
  normalizeWorkflow,
  normalizeMathMode,
  defaults,
  defaultModelName,
  defaultModelBaseUrl,
}: any) {
  const source = saved || {};
  return {
    workflow: normalizeWorkflow(source.workflow),
    renderSourceJobId: `${source.renderSourceJobId || ""}`.trim(),
    mathMode: normalizeMathMode(source.mathMode),
    model: source.model || defaultModelName(),
    baseUrl: source.baseUrl || defaultModelBaseUrl(),
    providerProfileId: `${source.providerProfileId || source.provider_profile_id || ""}`.trim(),
    targetLanguage: `${source.targetLanguage || source.target_language || "zh-CN"}`.trim() || "zh-CN",
    rateLimitQps: Math.max(0, Number(source.rateLimitQps || source.rate_limit_qps || 0) || 0),
    rateLimitRpm: Math.max(0, Number(source.rateLimitRpm || source.rate_limit_rpm || 0) || 0),
    glossaryId: `${source.glossaryId || source.glossary_id || ""}`.trim(),
    workers: positiveInteger(source.workers, defaults.workers),
    batchSize: positiveInteger(source.batchSize, defaults.batchSize),
    classifyBatchSize: positiveInteger(source.classifyBatchSize, defaults.classifyBatchSize),
    compileWorkers: positiveInteger(source.compileWorkers, defaults.compileWorkers),
    timeoutSeconds: positiveInteger(source.timeoutSeconds, defaults.timeoutSeconds),
    translateTitles: source.translateTitles !== false,
  };
}

export function workflowNeedsUpload(workflow, constants) {
  return workflow !== constants.WORKFLOW_RENDER;
}

export function workflowNeedsCredentials(workflow, constants) {
  return workflow !== constants.WORKFLOW_RENDER;
}

export function workflowUsesRenderStage(workflow, constants) {
  return workflow === constants.WORKFLOW_BOOK || workflow === constants.WORKFLOW_RENDER;
}

export function workflowSubmitLabel(workflow, constants) {
  // UI 文案：上传弹窗主按钮「直接翻译」；render 仍用「开始渲染」
  switch (workflow) {
    case constants.WORKFLOW_RENDER:
      return "开始渲染";
    case constants.WORKFLOW_TRANSLATE:
      return "直接翻译";
    case constants.WORKFLOW_BOOK:
      return "直接翻译";
    default:
      return "直接翻译";
  }
}

export function workflowHeadline(workflow, constants) {
  switch (workflow) {
    case constants.WORKFLOW_RENDER:
      return "当前工作流会复用已有任务产物重新生成 PDF。";
    default:
      return "选择 PDF 后，可直接翻译或仅收藏到书架。";
  }
}
