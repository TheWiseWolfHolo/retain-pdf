use std::fs;
use std::path::{Path, PathBuf};

use reqwest::{Client, Method};
use serde_json::{Map, Value};

use crate::db::Db;
use crate::error::AppError;
use crate::models::api::{
    provider_profile_view, ProviderModelListView, ProviderProfileListView,
    ProviderProfileProbeView, ProviderProfileUpsertInput, ProviderProfileView,
};
use crate::models::domain::{
    new_provider_profile_record, now_iso, ProviderProfileRecord, PROVIDER_ADAPTERS,
};
use crate::models::request::CreateJobInput;

const SECRET_DIR: &str = "provider-profiles";

pub fn create_provider_profile(
    db: &Db,
    data_root: &Path,
    input: &ProviderProfileUpsertInput,
) -> Result<ProviderProfileView, AppError> {
    validate_provider_profile_input(input)?;
    let profile = new_provider_profile_record(input);
    if db.get_provider_profile(&profile.profile_id).is_ok() {
        return Err(AppError::conflict(format!(
            "provider profile already exists: {}",
            profile.profile_id
        )));
    }
    let api_key = input
        .api_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::bad_request("api_key is required"))?;
    write_provider_secret(data_root, &profile.profile_id, api_key)?;
    if let Err(err) = db.save_provider_profile(&profile) {
        let _ = delete_provider_secret(data_root, &profile.profile_id);
        return Err(AppError::internal(err.to_string()));
    }
    Ok(provider_profile_view(&profile, true))
}

pub fn list_provider_profiles(
    db: &Db,
    data_root: &Path,
) -> Result<ProviderProfileListView, AppError> {
    let records = db
        .list_provider_profiles()
        .map_err(|err| AppError::internal(err.to_string()))?;
    Ok(ProviderProfileListView {
        items: records
            .iter()
            .map(|record| {
                provider_profile_view(
                    record,
                    provider_secret_path(data_root, &record.profile_id).is_file(),
                )
            })
            .collect(),
    })
}

pub fn get_provider_profile(
    db: &Db,
    data_root: &Path,
    profile_id: &str,
) -> Result<ProviderProfileView, AppError> {
    let record = load_profile(db, profile_id)?;
    Ok(provider_profile_view(
        &record,
        provider_secret_path(data_root, profile_id).is_file(),
    ))
}

pub fn update_provider_profile(
    db: &Db,
    data_root: &Path,
    profile_id: &str,
    input: &ProviderProfileUpsertInput,
) -> Result<ProviderProfileView, AppError> {
    validate_provider_profile_input(input)?;
    let existing = load_profile(db, profile_id)?;
    let mut profile = new_provider_profile_record(input);
    profile.profile_id = existing.profile_id.clone();
    profile.credential_ref = existing.credential_ref.clone();
    profile.created_at = existing.created_at;
    profile.updated_at = now_iso();

    if input.clear_api_key {
        delete_provider_secret(data_root, profile_id)?;
    } else if let Some(api_key) = input
        .api_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        write_provider_secret(data_root, profile_id, api_key)?;
    }
    if !provider_secret_path(data_root, profile_id).is_file() {
        return Err(AppError::bad_request(
            "provider profile requires an api_key",
        ));
    }
    db.save_provider_profile(&profile)
        .map_err(|err| AppError::internal(err.to_string()))?;
    Ok(provider_profile_view(&profile, true))
}

pub fn delete_provider_profile(
    db: &Db,
    data_root: &Path,
    profile_id: &str,
) -> Result<ProviderProfileView, AppError> {
    let record = load_profile(db, profile_id)?;
    db.delete_provider_profile(profile_id)
        .map_err(|err| AppError::internal(err.to_string()))?;
    delete_provider_secret(data_root, profile_id)?;
    Ok(provider_profile_view(&record, false))
}

pub fn resolve_provider_profile_for_job(
    db: &Db,
    data_root: &Path,
    input: &CreateJobInput,
) -> Result<CreateJobInput, AppError> {
    let profile_id = input.translation.provider_profile_id.trim();
    if profile_id.is_empty() {
        return Ok(input.clone());
    }
    let profile = load_profile(db, profile_id)?;
    if !provider_secret_path(data_root, profile_id).is_file() {
        return Err(AppError::bad_request(format!(
            "provider profile has no credential: {profile_id}"
        )));
    }
    let capabilities = profile.capabilities();
    let mut resolved = input.clone();
    resolved.translation.provider_profile_id = profile.profile_id;
    resolved.translation.provider_adapter = profile.adapter;
    resolved.translation.base_url = profile.base_url;
    if resolved.translation.model.trim().is_empty() {
        resolved.translation.model = profile.default_model;
    }
    resolved.translation.provider_request_format = profile.request_format;
    resolved.translation.provider_capabilities =
        serde_json::to_value(capabilities).unwrap_or_default();
    Ok(resolved)
}

pub fn read_provider_secret(data_root: &Path, profile_id: &str) -> Result<String, AppError> {
    validate_profile_id(profile_id)?;
    let path = provider_secret_path(data_root, profile_id);
    let secret = fs::read_to_string(&path)
        .map_err(|err| AppError::internal(format!("read provider secret failed: {err}")))?;
    let secret = secret.trim().to_string();
    if secret.is_empty() {
        return Err(AppError::bad_request(format!(
            "provider profile has no credential: {profile_id}"
        )));
    }
    Ok(secret)
}

pub async fn probe_provider_profile(
    db: &Db,
    data_root: &Path,
    profile_id: &str,
) -> Result<ProviderProfileProbeView, AppError> {
    let profile = load_profile(db, profile_id)?;
    let api_key = read_provider_secret(data_root, profile_id)?;
    if profile.adapter == "custom_json" {
        execute_custom_operation(&profile, &api_key, "probe").await?;
    } else {
        fetch_builtin_models(&profile, &api_key).await?;
    }
    Ok(ProviderProfileProbeView {
        ok: true,
        message: "Provider 连接成功".to_string(),
    })
}

pub async fn list_provider_profile_models(
    db: &Db,
    data_root: &Path,
    profile_id: &str,
) -> Result<ProviderModelListView, AppError> {
    let profile = load_profile(db, profile_id)?;
    let api_key = read_provider_secret(data_root, profile_id)?;
    let payload = if profile.adapter == "custom_json" {
        execute_custom_operation(&profile, &api_key, "models").await?
    } else {
        fetch_builtin_models(&profile, &api_key).await?
    };
    let mut items = if profile.adapter == "custom_json" {
        extract_custom_models(&profile.request_format, &payload)?
    } else {
        extract_builtin_models(&profile.adapter, &payload)
    };
    items.sort();
    items.dedup();
    Ok(ProviderModelListView { items })
}

async fn fetch_builtin_models(
    profile: &ProviderProfileRecord,
    api_key: &str,
) -> Result<Value, AppError> {
    let client = Client::new();
    let base_url = profile.base_url.trim_end_matches('/');
    let request = match profile.adapter.as_str() {
        "openai_chat_completions" => client
            .get(format!("{base_url}/models"))
            .bearer_auth(api_key),
        "anthropic_messages" => client
            .get(format!("{base_url}/models"))
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01"),
        "gemini_generate_content" => client
            .get(format!("{base_url}/models"))
            .query(&[("key", api_key)]),
        _ => {
            return Err(AppError::bad_request(format!(
                "model listing is not supported for adapter {}",
                profile.adapter
            )))
        }
    };
    json_response(request.send().await).await
}

fn extract_builtin_models(adapter: &str, payload: &Value) -> Vec<String> {
    let (items, id_key) = match adapter {
        "gemini_generate_content" => (payload.get("models").and_then(Value::as_array), "name"),
        _ => (payload.get("data").and_then(Value::as_array), "id"),
    };
    items
        .into_iter()
        .flatten()
        .filter_map(|item| item.get(id_key).and_then(Value::as_str))
        .map(|id| id.strip_prefix("models/").unwrap_or(id).to_string())
        .collect()
}

async fn execute_custom_operation(
    profile: &ProviderProfileRecord,
    api_key: &str,
    operation_name: &str,
) -> Result<Value, AppError> {
    let operation = profile
        .request_format
        .get(operation_name)
        .and_then(Value::as_object)
        .ok_or_else(|| {
            AppError::bad_request(format!(
                "custom_json request_format.{operation_name} is required"
            ))
        })?;
    let method = operation
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or("GET")
        .parse::<Method>()
        .map_err(|_| AppError::bad_request("custom operation method is invalid"))?;
    let path = operation.get("path").and_then(Value::as_str).unwrap_or("");
    let url = if path.starts_with("http://") || path.starts_with("https://") {
        path.to_string()
    } else {
        format!(
            "{}/{}",
            profile.base_url.trim_end_matches('/'),
            path.trim_start_matches('/')
        )
    };
    let values = Map::from_iter([
        ("api_key".to_string(), Value::String(api_key.to_string())),
        (
            "model".to_string(),
            Value::String(profile.default_model.clone()),
        ),
    ]);
    let client = Client::new();
    let mut request = client.request(method, url);
    if let Some(headers) = operation.get("headers").and_then(Value::as_object) {
        for (name, value) in headers {
            let rendered_value = render_custom_value(value, &values);
            if let Some(rendered) = rendered_value.as_str() {
                request = request.header(name, rendered);
            }
        }
    }
    if let Some(body) = operation.get("body") {
        request = request.json(&render_custom_value(body, &values));
    }
    json_response(request.send().await).await
}

fn extract_custom_models(request_format: &Value, payload: &Value) -> Result<Vec<String>, AppError> {
    let operation = request_format
        .get("models")
        .and_then(Value::as_object)
        .ok_or_else(|| AppError::bad_request("custom_json request_format.models is required"))?;
    let items_path = operation
        .get("items_path")
        .and_then(Value::as_str)
        .unwrap_or("data");
    let id_path = operation
        .get("id_path")
        .and_then(Value::as_str)
        .unwrap_or("id");
    Ok(value_at_path(payload, items_path)
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| value_at_path(item, id_path).and_then(Value::as_str))
        .map(str::to_string)
        .collect())
}

fn value_at_path<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
    path.split('.')
        .filter(|part| !part.is_empty())
        .try_fold(value, |current, part| {
            part.parse::<usize>()
                .ok()
                .and_then(|index| current.as_array()?.get(index))
                .or_else(|| current.get(part))
        })
}

fn render_custom_value(value: &Value, values: &Map<String, Value>) -> Value {
    match value {
        Value::String(template) => {
            if let Some(name) = template
                .strip_prefix("{{")
                .and_then(|value| value.strip_suffix("}}"))
            {
                if let Some(rendered) = values.get(name.trim()) {
                    return rendered.clone();
                }
            }
            let rendered = values.iter().fold(template.clone(), |text, (name, value)| {
                let replacement = value
                    .as_str()
                    .map(str::to_string)
                    .unwrap_or_else(|| value.to_string());
                text.replace(&format!("{{{{{name}}}}}"), &replacement)
            });
            Value::String(rendered)
        }
        Value::Array(items) => Value::Array(
            items
                .iter()
                .map(|item| render_custom_value(item, values))
                .collect(),
        ),
        Value::Object(object) => Value::Object(
            object
                .iter()
                .map(|(key, value)| (key.clone(), render_custom_value(value, values)))
                .collect(),
        ),
        _ => value.clone(),
    }
}

async fn json_response(
    result: Result<reqwest::Response, reqwest::Error>,
) -> Result<Value, AppError> {
    let response = result.map_err(|err| AppError::bad_gateway(err.to_string()))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|err| AppError::bad_gateway(err.to_string()))?;
    if !status.is_success() {
        return Err(AppError::bad_gateway(format!(
            "provider returned {status}: {text}"
        )));
    }
    serde_json::from_str(&text)
        .map_err(|err| AppError::bad_gateway(format!("provider returned invalid JSON: {err}")))
}

fn load_profile(db: &Db, profile_id: &str) -> Result<ProviderProfileRecord, AppError> {
    validate_profile_id(profile_id)?;
    db.get_provider_profile(profile_id)
        .map_err(|_| AppError::not_found(format!("provider profile not found: {profile_id}")))
}

fn validate_provider_profile_input(input: &ProviderProfileUpsertInput) -> Result<(), AppError> {
    if input.name.trim().is_empty() {
        return Err(AppError::bad_request("name is required"));
    }
    if !PROVIDER_ADAPTERS.contains(&input.adapter.trim().to_ascii_lowercase().as_str()) {
        return Err(AppError::bad_request(format!(
            "adapter must be one of: {}",
            PROVIDER_ADAPTERS.join(", ")
        )));
    }
    let base_url = input.base_url.trim();
    if !(base_url.starts_with("https://") || base_url.starts_with("http://")) {
        return Err(AppError::bad_request(
            "base_url must start with http:// or https://",
        ));
    }
    if input.adapter.trim().eq_ignore_ascii_case("custom_json") && !input.request_format.is_object()
    {
        return Err(AppError::bad_request(
            "custom_json requires an object request_format",
        ));
    }
    if !input.profile_id.trim().is_empty() {
        validate_profile_id(&input.profile_id)?;
    }
    Ok(())
}

fn validate_profile_id(profile_id: &str) -> Result<(), AppError> {
    let valid = !profile_id.is_empty()
        && profile_id.len() <= 128
        && profile_id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'));
    if valid {
        Ok(())
    } else {
        Err(AppError::bad_request(
            "profile_id must contain only letters, numbers, '-' or '_'",
        ))
    }
}

fn provider_secret_path(data_root: &Path, profile_id: &str) -> PathBuf {
    data_root
        .join("secrets")
        .join(SECRET_DIR)
        .join(format!("{profile_id}.secret"))
}

fn write_provider_secret(data_root: &Path, profile_id: &str, secret: &str) -> Result<(), AppError> {
    validate_profile_id(profile_id)?;
    let path = provider_secret_path(data_root, profile_id);
    let parent = path
        .parent()
        .ok_or_else(|| AppError::internal("provider secret path has no parent"))?;
    fs::create_dir_all(parent)?;
    fs::write(&path, secret.trim())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

fn delete_provider_secret(data_root: &Path, profile_id: &str) -> Result<(), AppError> {
    validate_profile_id(profile_id)?;
    let path = provider_secret_path(data_root, profile_id);
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(AppError::internal(format!(
            "delete provider secret failed: {err}"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use serde_json::json;

    use super::*;
    use crate::models::api::ProviderProfileUpsertInput;
    use crate::models::domain::ProviderCapabilities;

    #[test]
    fn profile_secret_stays_out_of_views_and_resolved_jobs() {
        let root = std::env::temp_dir().join(format!(
            "retain-provider-profile-{}-{}",
            std::process::id(),
            fastrand::u64(..)
        ));
        let data_root = root.join("data");
        fs::create_dir_all(&data_root).expect("create data root");
        let db = Db::new(data_root.join("jobs.db"), data_root.clone());
        db.init().expect("init db");
        let input = ProviderProfileUpsertInput {
            profile_id: "provider-test".to_string(),
            name: "Test Provider".to_string(),
            adapter: "anthropic_messages".to_string(),
            base_url: "https://api.anthropic.com/v1".to_string(),
            default_model: "claude-test".to_string(),
            api_key: Some("secret-value".to_string()),
            clear_api_key: false,
            request_format: serde_json::json!({}),
            capability_overrides: ProviderCapabilities::default(),
        };

        let view = create_provider_profile(&db, &data_root, &input).expect("create profile");
        let serialized = serde_json::to_string(&view).expect("serialize view");
        assert!(!serialized.contains("secret-value"));

        let mut job = CreateJobInput::default();
        job.translation.provider_profile_id = "provider-test".to_string();
        let resolved =
            resolve_provider_profile_for_job(&db, &data_root, &job).expect("resolve profile");
        assert_eq!(resolved.translation.model, "claude-test");
        assert_eq!(resolved.translation.provider_adapter, "anthropic_messages");
        assert!(resolved.translation.api_key.is_empty());

        fs::remove_dir_all(root).expect("remove test root");
    }
}
