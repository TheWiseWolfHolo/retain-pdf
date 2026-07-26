mod catalog;
pub mod custom;
pub mod mineru;
pub mod paddle;
mod provider_config;
pub mod types;

use anyhow::{bail, Result};

#[allow(unused_imports)]
pub use catalog::{
    ensure_provider_diagnostics, is_supported_provider, provider_artifact_layout,
    provider_capabilities, provider_definition, provider_display_name, provider_model_version,
    provider_public_definitions, provider_token, provider_token_env_name,
    provider_token_field_name, supported_provider_keys,
};
pub use provider_config::{
    configured_provider_credential_env, normalize_paddle_model_name, paddle_default_model,
};
pub use types::{
    OcrArtifactSet, OcrErrorCategory, OcrProviderArtifactLayout, OcrProviderCapabilities,
    OcrProviderCredentialSpec, OcrProviderDiagnostics, OcrProviderErrorInfo, OcrProviderKind,
    OcrProviderOptionSpec, OcrProviderPublicDefinition, OcrTaskHandle, OcrTaskState, OcrTaskStatus,
};

pub fn parse_provider_kind(value: &str) -> OcrProviderKind {
    match value.trim().to_ascii_lowercase().as_str() {
        "mineru" => OcrProviderKind::Mineru,
        "paddle" => OcrProviderKind::Paddle,
        "custom" | "custom_ocr" => OcrProviderKind::Custom,
        "local" => OcrProviderKind::Local,
        _ => OcrProviderKind::Unknown,
    }
}

pub fn require_supported_provider(value: &str) -> Result<OcrProviderKind> {
    let kind = parse_provider_kind(value);
    if is_supported_provider(&kind) {
        return Ok(kind);
    }
    if provider_config::is_configured_command_provider(value) {
        return Ok(OcrProviderKind::Local);
    }
    if !is_supported_provider(&kind) {
        bail!("unsupported OCR provider: {}", value.trim());
    }
    Ok(kind)
}

pub fn is_configured_command_provider(value: &str) -> bool {
    provider_config::is_configured_command_provider(value)
}
