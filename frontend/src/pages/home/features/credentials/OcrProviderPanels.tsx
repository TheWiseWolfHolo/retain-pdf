// OCR provider 卡片(对照旧 components/dialogs/browser-credentials-dialog.js
// 的 ocrProviderPanels 拼接 + features/credentials/validation-view.js 的
// 校验徽标语义,死文件不 import,这里用 JSX 结构化重写)。
//
// 当前 OCR_PROVIDER_DEFINITIONS 只注册了 paddle 一个 provider(config/providers.js),
// 面板按配置数组渲染,不硬编码 provider id——未来加回 provider 只需扩数组。
// token 输入是非受控 ref(见 credentials-view-store.js elementsRef),
// dialog-values.js/dialog-sync.js(kept)直接读写 .value。

import {
  credentialTokenInputId,
  credentialValidateButtonId,
  credentialValidationId,
} from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import { OCR_PROVIDER_DEFINITIONS } from "../../composition/external.js";

function validationIcon(tone = "", content = "") {
  if (!content) {
    return "";
  }
  if (tone === "valid") {
    return "✓";
  }
  if (tone === "error") {
    return "!";
  }
  return "…";
}

function resetHandlerFor(handlers) {
  return handlers?.resetPaddleValidation;
}

export function OcrProviderPanels() {
  const { credentials, view, handlers, tokenInputRef, elementsRef } = useCredentialsController();
  const activeProvider = credentials.ocrProvider;

  return (
    <div className="credential-provider-panels">
      <label>
        <span className="developer-label">OCR Provider</span>
        <select
          id="browser-ocr-provider-select"
          value={activeProvider}
          onChange={(event) => handlers?.changeProvider?.(event)}
        >
          {OCR_PROVIDER_DEFINITIONS.map((provider) => (
            <option key={provider.id} value={provider.id}>{provider.label}</option>
          ))}
        </select>
      </label>
      {OCR_PROVIDER_DEFINITIONS.map((provider) => {
        const active = provider.id === activeProvider;
        const validation = view.validations[provider.id] || { message: "", tone: "" };
        const content = `${validation.message || ""}`.trim();
        const badgeClasses = [
          "token-inline-status",
          content ? "" : "hidden",
          validation.tone === "valid" ? "is-valid" : "",
          validation.tone === "error" ? "is-error" : "",
          content && !validation.tone ? "is-pending" : "",
        ].filter(Boolean).join(" ");

        return (
          <section
            key={provider.id}
            className={`credential-panel credential-provider-panel${active ? " is-active" : ""}`}
            data-ocr-provider-panel={provider.id}
            role="tabpanel"
            hidden={!active}
          >
            <label>
              <span className="credential-input-row">
                <span className="credential-secret-field">
                  <input
                    id={credentialTokenInputId(provider.id)}
                    type="password"
                    autoComplete="off"
                    placeholder={provider.tokenPlaceholder}
                    defaultValue=""
                    ref={(node) => {
                      tokenInputRef(provider.id)(node);
                      if (active) {
                        elementsRef.activeOcrTokenInput = node || null;
                      }
                    }}
                    onInput={() => (handlers?.resetOcrValidation || resetHandlerFor(handlers))?.()}
                  />
                </span>
                <a className="credential-card-link" href={provider.docsUrl} target="_blank" rel="noopener noreferrer">
                  {provider.docsLabel}
                </a>
              </span>
            </label>
            {provider.id === "custom_ocr" ? (
              <>
                <label>
                  <span className="developer-label">Base URL</span>
                  <input
                    id="browser-custom-ocr-base-url"
                    type="url"
                    defaultValue="https://api.mistral.ai"
                    placeholder="https://example.com 或 https://example.com/v1"
                    ref={(node) => { elementsRef.ocrBaseUrlInput = node || null; }}
                  />
                </label>
                <label>
                  <span className="developer-label">OCR 模型</span>
                  <input
                    id="browser-custom-ocr-model"
                    type="text"
                    defaultValue="mistral-ocr-latest"
                    placeholder="mistral-ocr-latest"
                    ref={(node) => { elementsRef.ocrModelInput = node || null; }}
                  />
                </label>
                <p className="credential-card-description">
                  请求会发送到 Base URL 下的 /v1/ocr，使用 multipart 的 model 与 file 字段。
                </p>
              </>
            ) : null}
            <div className="credential-card-actions">
              {provider.supportsValidation ? (
                <button
                  id={credentialValidateButtonId(provider.id)}
                  type="button"
                  className="app-button secondary"
                  onClick={() => handlers?.validateOcr?.()}
                >
                  {provider.validationButtonLabel}
                </button>
              ) : null}
              <span id={credentialValidationId(provider.id)} className={badgeClasses} title={content || provider.validationIdleMessage}>
                {validationIcon(validation.tone, content)}
              </span>
            </div>
          </section>
        );
      })}
    </div>
  );
}
