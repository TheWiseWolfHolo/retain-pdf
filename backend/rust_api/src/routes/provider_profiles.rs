use axum::extract::{Path, State};
use axum::Json;

use crate::error::AppError;
use crate::models::api::{
    ApiResponse, ProviderModelListView, ProviderProfileListView, ProviderProfileProbeView,
    ProviderProfileUpsertInput, ProviderProfileView,
};
use crate::routes::common::{build_provider_route_deps, ok_json};
use crate::services::provider_profiles::{
    create_provider_profile, delete_provider_profile, get_provider_profile,
    list_provider_profile_models, list_provider_profiles, probe_provider_profile,
    update_provider_profile,
};
use crate::AppState;

pub async fn create_provider_profile_route(
    State(state): State<AppState>,
    Json(payload): Json<ProviderProfileUpsertInput>,
) -> Result<Json<ApiResponse<ProviderProfileView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    Ok(ok_json(create_provider_profile(
        deps.db,
        deps.data_root,
        &payload,
    )?))
}

pub async fn probe_provider_profile_route(
    State(state): State<AppState>,
    Path(profile_id): Path<String>,
) -> Result<Json<ApiResponse<ProviderProfileProbeView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    Ok(ok_json(
        probe_provider_profile(deps.db, deps.data_root, &profile_id).await?,
    ))
}

pub async fn list_provider_profile_models_route(
    State(state): State<AppState>,
    Path(profile_id): Path<String>,
) -> Result<Json<ApiResponse<ProviderModelListView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    Ok(ok_json(
        list_provider_profile_models(deps.db, deps.data_root, &profile_id).await?,
    ))
}

pub async fn list_provider_profiles_route(
    State(state): State<AppState>,
) -> Result<Json<ApiResponse<ProviderProfileListView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    Ok(ok_json(list_provider_profiles(deps.db, deps.data_root)?))
}

pub async fn get_provider_profile_route(
    State(state): State<AppState>,
    Path(profile_id): Path<String>,
) -> Result<Json<ApiResponse<ProviderProfileView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    Ok(ok_json(get_provider_profile(
        deps.db,
        deps.data_root,
        &profile_id,
    )?))
}

pub async fn update_provider_profile_route(
    State(state): State<AppState>,
    Path(profile_id): Path<String>,
    Json(payload): Json<ProviderProfileUpsertInput>,
) -> Result<Json<ApiResponse<ProviderProfileView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    Ok(ok_json(update_provider_profile(
        deps.db,
        deps.data_root,
        &profile_id,
        &payload,
    )?))
}

pub async fn delete_provider_profile_route(
    State(state): State<AppState>,
    Path(profile_id): Path<String>,
) -> Result<Json<ApiResponse<ProviderProfileView>>, AppError> {
    let deps = build_provider_route_deps(&state);
    Ok(ok_json(delete_provider_profile(
        deps.db,
        deps.data_root,
        &profile_id,
    )?))
}
