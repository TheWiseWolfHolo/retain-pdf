use std::collections::HashSet;
use std::time::Duration;

use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::error::AppError;
use crate::models::{now_iso, ApiResponse};
use crate::ocr_provider::mineru::{
    extract_provider_error_code, extract_provider_message, extract_provider_trace_id,
    map_provider_error_code, MineruClient,
};
use crate::ocr_provider::OcrErrorCategory;
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct MineruTokenValidationRequest {
    pub mineru_token: String,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub model_version: String,
}

#[derive(Debug, Serialize)]
pub struct MineruTokenValidationView {
    pub ok: bool,
    pub status: &'static str,
    pub summary: String,
    pub retryable: bool,
    pub provider_code: Option<String>,
    pub provider_message: Option<String>,
    pub operator_hint: Option<String>,
    pub trace_id: Option<String>,
    pub base_url: String,
    pub checked_at: String,
}

#[derive(Debug, Deserialize)]
pub struct OpenAiModelsRequest {
    pub api_key: String,
    pub base_url: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
pub struct OpenAiModelItemView {
    pub id: String,
    pub owned_by: String,
    pub label: String,
}

#[derive(Debug, Serialize)]
pub struct OpenAiModelsView {
    pub ok: bool,
    pub status: &'static str,
    pub summary: String,
    pub items: Vec<OpenAiModelItemView>,
    pub base_url: String,
    pub checked_at: String,
}

pub async fn validate_mineru_token(
    State(_state): State<AppState>,
    Json(payload): Json<MineruTokenValidationRequest>,
) -> Result<Json<ApiResponse<MineruTokenValidationView>>, AppError> {
    let token = payload.mineru_token.trim();
    if token.is_empty() {
        return Err(AppError::bad_request("mineru_token is required"));
    }

    let base_url = payload.base_url.trim().to_string();
    let model_version = payload
        .model_version
        .trim()
        .to_string();
    let client = MineruClient::new(base_url.clone(), token.to_string());
    let checked_at = now_iso();

    let view = match client
        .apply_upload_url(
            "retain-pdf-token-check.pdf",
            if model_version.is_empty() {
                "vlm"
            } else {
                model_version.as_str()
            },
            "",
            "retain-pdf-token-check",
        )
        .await
    {
        Ok(result) => MineruTokenValidationView {
            ok: true,
            status: "valid",
            summary: "MinerU Token 可用".to_string(),
            retryable: false,
            provider_code: Some("0".to_string()),
            provider_message: Some("ok".to_string()),
            operator_hint: None,
            trace_id: result.trace_id,
            base_url: client.base_url.clone(),
            checked_at,
        },
        Err(err) => classify_probe_error(err.to_string(), client.base_url.clone(), checked_at),
    };

    Ok(Json(ApiResponse::ok(view)))
}

pub async fn list_openai_models(
    State(_state): State<AppState>,
    Json(payload): Json<OpenAiModelsRequest>,
) -> Result<Json<ApiResponse<OpenAiModelsView>>, AppError> {
    let api_key = payload.api_key.trim();
    if api_key.is_empty() {
        return Err(AppError::bad_request("api_key is required"));
    }

    let base_url = normalize_remote_base_url(&payload.base_url)?;
    let checked_at = now_iso();
    let endpoint = format!("{}/models", base_url.trim_end_matches('/'));
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|err| AppError::internal(format!("failed to build model proxy client: {err}")))?;

    let response = client
        .get(&endpoint)
        .bearer_auth(api_key)
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .await;

    let view = match response {
        Ok(resp) => build_openai_models_view(resp, base_url, checked_at).await,
        Err(err) => {
            let (status, summary) = if err.is_timeout() {
                ("network_error", "模型接口请求超时")
            } else if err.is_connect() {
                ("network_error", "模型接口连接失败")
            } else {
                ("provider_error", "模型接口请求失败")
            };
            OpenAiModelsView {
                ok: false,
                status,
                summary: summary.to_string(),
                items: Vec::new(),
                base_url,
                checked_at,
            }
        }
    };

    Ok(Json(ApiResponse::ok(view)))
}

async fn build_openai_models_view(
    response: reqwest::Response,
    base_url: String,
    checked_at: String,
) -> OpenAiModelsView {
    let status_code = response.status();
    if status_code.is_success() {
        let payload = response.json::<Value>().await.unwrap_or(Value::Null);
        let items = extract_openai_model_items(&payload);
        let summary = if items.is_empty() {
            "模型接口可访问，但未返回可用模型".to_string()
        } else {
            format!("已获取 {} 个模型", items.len())
        };
        return OpenAiModelsView {
            ok: true,
            status: if items.is_empty() { "empty" } else { "valid" },
            summary,
            items,
            base_url,
            checked_at,
        };
    }

    let body_text = response.text().await.unwrap_or_default();
    let (status, summary_base) = match status_code.as_u16() {
        401 | 403 => ("unauthorized", "模型 API Key 无效或已过期".to_string()),
        404 => ("not_found", "模型接口未找到，请检查 Base URL".to_string()),
        429 => ("rate_limited", "模型接口限流，请稍后重试".to_string()),
        _ => (
            "provider_error",
            format!("模型接口返回 {}", status_code.as_u16()),
        ),
    };

    let summary = if body_text.trim().is_empty() {
        summary_base
    } else {
        format!("{summary_base}：{body_text}")
    };

    OpenAiModelsView {
        ok: false,
        status,
        summary,
        items: Vec::new(),
        base_url,
        checked_at,
    }
}

fn normalize_remote_base_url(raw: &str) -> Result<String, AppError> {
    let base_url = raw.trim();
    if base_url.is_empty() {
        return Err(AppError::bad_request("base_url is required"));
    }
    if !(base_url.starts_with("http://") || base_url.starts_with("https://")) {
        return Err(AppError::bad_request(
            "base_url must start with http:// or https://",
        ));
    }
    Ok(base_url.trim_end_matches('/').to_string())
}

fn extract_openai_model_items(payload: &Value) -> Vec<OpenAiModelItemView> {
    let mut seen = HashSet::new();
    let mut items = Vec::new();
    let Some(data) = payload.get("data").and_then(Value::as_array) else {
        return items;
    };

    for entry in data {
        let Some(id) = entry.get("id").and_then(Value::as_str).map(str::trim) else {
            continue;
        };
        if id.is_empty() || !seen.insert(id.to_string()) {
            continue;
        }
        let owned_by = entry
            .get("owned_by")
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or_default()
            .to_string();
        items.push(OpenAiModelItemView {
            id: id.to_string(),
            owned_by,
            label: id.to_string(),
        });
    }

    items.sort_by(|left, right| left.id.cmp(&right.id));
    items
}

fn classify_probe_error(
    error_text: String,
    base_url: String,
    checked_at: String,
) -> MineruTokenValidationView {
    let provider_code = extract_provider_error_code(&error_text);
    let provider_message = extract_provider_message(&error_text);
    let trace_id = extract_provider_trace_id(&error_text);

    if let Some(code) = provider_code.as_deref() {
        let mapped = map_provider_error_code(code, provider_message.clone().unwrap_or_default(), trace_id.as_deref());
        return MineruTokenValidationView {
            ok: false,
            status: match mapped.category {
                OcrErrorCategory::Unauthorized => "unauthorized",
                OcrErrorCategory::CredentialExpired => "expired",
                _ => "provider_error",
            },
            summary: match mapped.category {
                OcrErrorCategory::Unauthorized => "MinerU Token 无效".to_string(),
                OcrErrorCategory::CredentialExpired => "MinerU Token 已过期".to_string(),
                _ => "MinerU Token 校验失败".to_string(),
            },
            retryable: !matches!(
                mapped.category,
                OcrErrorCategory::Unauthorized | OcrErrorCategory::CredentialExpired
            ),
            provider_code: mapped.provider_code,
            provider_message: mapped.provider_message,
            operator_hint: mapped.operator_hint,
            trace_id: mapped.trace_id,
            base_url,
            checked_at,
        };
    }

    let lowered = error_text.to_lowercase();
    let (status, summary, retryable) = if lowered.contains("timed out")
        || lowered.contains("timeout")
        || lowered.contains("failed to resolve")
        || lowered.contains("dns")
        || lowered.contains("connection")
    {
        ("network_error", "MinerU 连通性校验失败", true)
    } else {
        ("provider_error", "MinerU Token 校验失败", true)
    };

    MineruTokenValidationView {
        ok: false,
        status,
        summary: summary.to_string(),
        retryable,
        provider_code,
        provider_message: provider_message.or(Some(error_text)),
        operator_hint: None,
        trace_id,
        base_url,
        checked_at,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{classify_probe_error, extract_openai_model_items, normalize_remote_base_url};

    #[test]
    fn classify_probe_error_maps_invalid_token() {
        let view = classify_probe_error(
            r#"MinerU API error code=A0202: invalid token trace_id=trace-1"#.to_string(),
            "https://mineru.net".to_string(),
            "2026-04-06T00:00:00Z".to_string(),
        );
        assert!(!view.ok);
        assert_eq!(view.status, "unauthorized");
        assert_eq!(view.provider_code.as_deref(), Some("A0202"));
    }

    #[test]
    fn classify_probe_error_maps_expired_token() {
        let view = classify_probe_error(
            r#"MinerU API error code=A0211: token expired trace_id=trace-2"#.to_string(),
            "https://mineru.net".to_string(),
            "2026-04-06T00:00:00Z".to_string(),
        );
        assert!(!view.ok);
        assert_eq!(view.status, "expired");
        assert_eq!(view.provider_code.as_deref(), Some("A0211"));
    }

    #[test]
    fn classify_probe_error_maps_network_failure() {
        let view = classify_probe_error(
            "POST https://mineru.net/api/v4/file-urls/batch failed: operation timed out".to_string(),
            "https://mineru.net".to_string(),
            "2026-04-06T00:00:00Z".to_string(),
        );
        assert!(!view.ok);
        assert_eq!(view.status, "network_error");
        assert!(view.retryable);
    }

    #[test]
    fn extract_openai_model_items_deduplicates_and_sorts() {
        let items = extract_openai_model_items(&json!({
            "data": [
                { "id": "deepseek-chat", "owned_by": "deepseek" },
                { "id": "gpt-4.1-mini", "owned_by": "openai" },
                { "id": "deepseek-chat", "owned_by": "deepseek" },
                { "id": "qwen-max", "owned_by": "qwen" },
                { "id": "" }
            ]
        }));

        assert_eq!(items.len(), 3);
        assert_eq!(items[0].id, "deepseek-chat");
        assert_eq!(items[1].id, "gpt-4.1-mini");
        assert_eq!(items[2].id, "qwen-max");
    }

    #[test]
    fn normalize_remote_base_url_rejects_invalid_scheme() {
        let err = normalize_remote_base_url("ftp://example.com").expect_err("should fail");
        assert_eq!(err.to_string(), "base_url must start with http:// or https://");
    }
}
