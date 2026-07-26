use std::path::Path;

use anyhow::{Context, Result};

use crate::models::domain::{now_iso, JobRuntimeState};
use crate::ocr_provider::custom::{resolved_model, to_generic_layout, CustomOcrClient};

use super::artifacts::persist_provider_result;
use super::save_ocr_job;
use crate::job_runner::ProcessRuntimeDeps;

pub(super) async fn run_local_custom_ocr_transport(
    deps: &ProcessRuntimeDeps,
    job: &mut JobRuntimeState,
    client: &CustomOcrClient,
    upload_path: &Path,
    provider_result_json_path: &Path,
    layout_json_path: &Path,
    parent_job_id: Option<&str>,
) -> Result<()> {
    let model = resolved_model(&job.request_payload.ocr.custom_ocr_model).to_string();
    job.request_payload.ocr.custom_ocr_model = model.clone();
    job.stage = Some("ocr_processing".to_string());
    job.stage_detail = Some(format!("自定义 OCR 正在解析，模型 {model}"));
    job.updated_at = now_iso();
    save_ocr_job(deps, job, parent_job_id).await?;

    let payload = client.recognize_file(upload_path, &model).await?;
    persist_provider_result(job, provider_result_json_path, &payload).await?;

    let layout = to_generic_layout(&payload)?;
    if let Some(parent) = layout_json_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(
        layout_json_path,
        serde_json::to_vec_pretty(&layout).context("failed to serialize custom OCR layout")?,
    )
    .await
    .with_context(|| format!("failed to write {}", layout_json_path.display()))?;

    let page_count = payload
        .get("pages")
        .and_then(serde_json::Value::as_array)
        .map(|pages| pages.len() as i64);
    job.progress_current = page_count;
    job.progress_total = page_count;
    job.append_log(&format!(
        "custom OCR completed: {} page(s)",
        page_count.unwrap_or(0)
    ));
    Ok(())
}
