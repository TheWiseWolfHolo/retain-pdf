use std::path::Path;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use reqwest::{multipart, Client};
use serde_json::{json, Value};

use super::OcrProviderCapabilities;

const DEFAULT_BASE_URL: &str = "https://api.mistral.ai";
const DEFAULT_MODEL: &str = "mistral-ocr-latest";

#[derive(Debug, Clone)]
pub struct CustomOcrClient {
    endpoint: String,
    api_key: String,
    http: Client,
}

impl CustomOcrClient {
    pub fn new(base_url: &str, api_key: &str, timeout_seconds: i64) -> Result<Self> {
        let http = Client::builder()
            .timeout(Duration::from_secs(timeout_seconds.max(1) as u64))
            .build()
            .context("failed to build custom OCR HTTP client")?;
        Ok(Self {
            endpoint: ocr_endpoint(base_url),
            api_key: api_key.trim().to_string(),
            http,
        })
    }

    pub async fn recognize_file(&self, file_path: &Path, model: &str) -> Result<Value> {
        let file_name = file_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("document.pdf")
            .to_string();
        let bytes = tokio::fs::read(file_path)
            .await
            .with_context(|| format!("failed to read OCR source {}", file_path.display()))?;
        let form = multipart::Form::new()
            .text("model", resolved_model(model).to_string())
            .part(
                "file",
                multipart::Part::bytes(bytes)
                    .file_name(file_name)
                    .mime_str("application/pdf")?,
            );
        let response = self
            .http
            .post(&self.endpoint)
            .bearer_auth(&self.api_key)
            .multipart(form)
            .send()
            .await
            .with_context(|| format!("custom OCR request failed: {}", self.endpoint))?;
        let status = response.status();
        let body = response
            .text()
            .await
            .context("failed to read custom OCR response")?;
        if !status.is_success() {
            return Err(anyhow!(
                "custom OCR returned HTTP {}: {}",
                status.as_u16(),
                body.chars().take(500).collect::<String>()
            ));
        }
        let payload: Value =
            serde_json::from_str(&body).context("custom OCR returned invalid JSON")?;
        if !payload.get("pages").is_some_and(Value::is_array) {
            return Err(anyhow!("custom OCR response is missing pages[]"));
        }
        Ok(payload)
    }
}

pub fn resolved_base_url(value: &str) -> &str {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        DEFAULT_BASE_URL
    } else {
        trimmed
    }
}

pub fn resolved_model(value: &str) -> &str {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        DEFAULT_MODEL
    } else {
        trimmed
    }
}

pub fn ocr_endpoint(base_url: &str) -> String {
    let base = resolved_base_url(base_url).trim_end_matches('/');
    if base.ends_with("/v1/ocr") {
        base.to_string()
    } else if base.ends_with("/v1") {
        format!("{base}/ocr")
    } else {
        format!("{base}/v1/ocr")
    }
}

pub fn to_generic_layout(payload: &Value) -> Result<Value> {
    let pages = payload
        .get("pages")
        .and_then(Value::as_array)
        .ok_or_else(|| anyhow!("custom OCR response is missing pages[]"))?;
    let normalized_pages: Vec<Value> = pages
        .iter()
        .enumerate()
        .map(|(position, page)| {
            let dimensions = page.get("dimensions").and_then(Value::as_object);
            let width = dimensions
                .and_then(|value| value.get("width"))
                .and_then(Value::as_f64)
                .unwrap_or(0.0);
            let height = dimensions
                .and_then(|value| value.get("height"))
                .and_then(Value::as_f64)
                .unwrap_or(0.0);
            let markdown = page.get("markdown").and_then(Value::as_str).unwrap_or("");
            json!({
                "page_index": page.get("index").and_then(Value::as_u64).unwrap_or(position as u64),
                "width": width,
                "height": height,
                "unit": "pt",
                "blocks": [{
                    "type": "text",
                    "sub_type": "body",
                    "bbox": [0.0, 0.0, width, height],
                    "text": markdown,
                    "metadata": {
                        "content_format": "markdown"
                    }
                }]
            })
        })
        .collect();
    Ok(json!({
        "provider": "generic_flat_ocr",
        "pages": normalized_pages
    }))
}

pub fn capabilities() -> OcrProviderCapabilities {
    OcrProviderCapabilities {
        supports_remote_url_submit: false,
        supports_local_file_upload: true,
        supports_polling: false,
        supports_download_bundle: false,
        supports_extra_formats: false,
        supports_formula_toggle: false,
        supports_table_toggle: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endpoint_accepts_root_v1_and_full_ocr_urls() {
        assert_eq!(
            ocr_endpoint("https://example.com"),
            "https://example.com/v1/ocr"
        );
        assert_eq!(
            ocr_endpoint("https://example.com/v1"),
            "https://example.com/v1/ocr"
        );
        assert_eq!(
            ocr_endpoint("https://example.com/v1/ocr/"),
            "https://example.com/v1/ocr"
        );
    }

    #[test]
    fn mistral_pages_become_generic_document_pages() {
        let layout = to_generic_layout(&json!({
            "pages": [{
                "index": 0,
                "markdown": "# Title\n\nBody",
                "dimensions": {"width": 1000, "height": 1400}
            }]
        }))
        .expect("layout");
        assert_eq!(layout["provider"], "generic_flat_ocr");
        assert_eq!(layout["pages"][0]["blocks"][0]["text"], "# Title\n\nBody");
        assert_eq!(layout["pages"][0]["blocks"][0]["bbox"][2], 1000.0);
    }
}
