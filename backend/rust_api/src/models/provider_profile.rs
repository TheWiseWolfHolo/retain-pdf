use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::{build_job_id, now_iso};

pub const PROVIDER_ADAPTERS: &[&str] = &[
    "openai_chat_completions",
    "anthropic_messages",
    "gemini_generate_content",
    "custom_json",
];

#[derive(Debug, Serialize, Deserialize, Clone, Default, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct ProviderCapabilities {
    #[serde(default)]
    pub stream: bool,
    #[serde(default)]
    pub json_schema: bool,
    #[serde(default)]
    pub json_object: bool,
    #[serde(default)]
    pub model_listing: bool,
    #[serde(default)]
    pub balance: bool,
}

impl ProviderCapabilities {
    pub fn for_adapter(adapter: &str) -> Self {
        match adapter {
            "openai_chat_completions" => Self {
                stream: true,
                json_schema: true,
                json_object: true,
                model_listing: true,
                balance: false,
            },
            "anthropic_messages" => Self {
                stream: true,
                json_schema: false,
                json_object: false,
                model_listing: true,
                balance: false,
            },
            "gemini_generate_content" => Self {
                stream: true,
                json_schema: true,
                json_object: true,
                model_listing: true,
                balance: false,
            },
            _ => Self::default(),
        }
    }

    pub fn with_overrides(mut self, overrides: &Self) -> Self {
        if overrides.stream {
            self.stream = true;
        }
        if overrides.json_schema {
            self.json_schema = true;
        }
        if overrides.json_object {
            self.json_object = true;
        }
        if overrides.model_listing {
            self.model_listing = true;
        }
        if overrides.balance {
            self.balance = true;
        }
        self
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderProfileRecord {
    pub profile_id: String,
    pub name: String,
    pub adapter: String,
    pub base_url: String,
    pub default_model: String,
    pub credential_ref: String,
    pub request_format: Value,
    pub capability_overrides: ProviderCapabilities,
    pub created_at: String,
    pub updated_at: String,
}

impl ProviderProfileRecord {
    pub fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities::for_adapter(&self.adapter).with_overrides(&self.capability_overrides)
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
pub struct ProviderProfileUpsertInput {
    #[serde(default)]
    pub profile_id: String,
    pub name: String,
    pub adapter: String,
    pub base_url: String,
    #[serde(default)]
    pub default_model: String,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub clear_api_key: bool,
    #[serde(default)]
    pub request_format: Value,
    #[serde(default)]
    pub capability_overrides: ProviderCapabilities,
}

#[derive(Debug, Serialize, Clone)]
pub struct ProviderProfileView {
    pub profile_id: String,
    pub name: String,
    pub adapter: String,
    pub base_url: String,
    pub default_model: String,
    pub has_credential: bool,
    pub request_format: Value,
    pub capabilities: ProviderCapabilities,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct ProviderProfileListView {
    pub items: Vec<ProviderProfileView>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ProviderProfileProbeView {
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct ProviderModelListView {
    pub items: Vec<String>,
}

pub fn build_provider_profile_id() -> String {
    format!("provider-{}", build_job_id())
}

pub fn provider_profile_view(
    record: &ProviderProfileRecord,
    has_credential: bool,
) -> ProviderProfileView {
    ProviderProfileView {
        profile_id: record.profile_id.clone(),
        name: record.name.clone(),
        adapter: record.adapter.clone(),
        base_url: record.base_url.clone(),
        default_model: record.default_model.clone(),
        has_credential,
        request_format: record.request_format.clone(),
        capabilities: record.capabilities(),
        created_at: record.created_at.clone(),
        updated_at: record.updated_at.clone(),
    }
}

pub fn new_provider_profile_record(input: &ProviderProfileUpsertInput) -> ProviderProfileRecord {
    let now = now_iso();
    let profile_id = if input.profile_id.trim().is_empty() {
        build_provider_profile_id()
    } else {
        input.profile_id.trim().to_string()
    };
    ProviderProfileRecord {
        credential_ref: format!("provider-secret:{profile_id}"),
        profile_id,
        name: input.name.trim().to_string(),
        adapter: input.adapter.trim().to_ascii_lowercase(),
        base_url: input.base_url.trim().trim_end_matches('/').to_string(),
        default_model: input.default_model.trim().to_string(),
        request_format: input.request_format.clone(),
        capability_overrides: input.capability_overrides.clone(),
        created_at: now.clone(),
        updated_at: now,
    }
}
