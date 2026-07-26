use anyhow::{Context, Result};
use rusqlite::params;

use crate::models::domain::{ProviderCapabilities, ProviderProfileRecord};

use super::Db;

impl Db {
    pub fn save_provider_profile(&self, profile: &ProviderProfileRecord) -> Result<()> {
        let conn = self.connect()?;
        conn.execute(
            r#"
            INSERT INTO provider_profiles (
                profile_id, name, adapter, base_url, default_model, credential_ref,
                request_format_json, capability_overrides_json, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(profile_id) DO UPDATE SET
                name=excluded.name,
                adapter=excluded.adapter,
                base_url=excluded.base_url,
                default_model=excluded.default_model,
                credential_ref=excluded.credential_ref,
                request_format_json=excluded.request_format_json,
                capability_overrides_json=excluded.capability_overrides_json,
                created_at=excluded.created_at,
                updated_at=excluded.updated_at
            "#,
            params![
                profile.profile_id,
                profile.name,
                profile.adapter,
                profile.base_url,
                profile.default_model,
                profile.credential_ref,
                serde_json::to_string(&profile.request_format)?,
                serde_json::to_string(&profile.capability_overrides)?,
                profile.created_at,
                profile.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_provider_profile(&self, profile_id: &str) -> Result<ProviderProfileRecord> {
        let conn = self.connect()?;
        conn.query_row(
            r#"
            SELECT profile_id, name, adapter, base_url, default_model, credential_ref,
                   request_format_json, capability_overrides_json, created_at, updated_at
            FROM provider_profiles
            WHERE profile_id = ?1
            "#,
            params![profile_id],
            row_to_provider_profile,
        )
        .with_context(|| format!("provider profile not found: {profile_id}"))
    }

    pub fn list_provider_profiles(&self) -> Result<Vec<ProviderProfileRecord>> {
        let conn = self.connect()?;
        let mut stmt = conn.prepare(
            r#"
            SELECT profile_id, name, adapter, base_url, default_model, credential_ref,
                   request_format_json, capability_overrides_json, created_at, updated_at
            FROM provider_profiles
            ORDER BY updated_at DESC
            "#,
        )?;
        let rows = stmt.query_map([], row_to_provider_profile)?;
        let mut profiles = Vec::new();
        for row in rows {
            profiles.push(row?);
        }
        Ok(profiles)
    }

    pub fn delete_provider_profile(&self, profile_id: &str) -> Result<bool> {
        let conn = self.connect()?;
        let changed = conn.execute(
            "DELETE FROM provider_profiles WHERE profile_id = ?1",
            params![profile_id],
        )?;
        Ok(changed > 0)
    }
}

fn row_to_provider_profile(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProviderProfileRecord> {
    let request_format_json: String = row.get(6)?;
    let capability_overrides_json: String = row.get(7)?;
    Ok(ProviderProfileRecord {
        profile_id: row.get(0)?,
        name: row.get(1)?,
        adapter: row.get(2)?,
        base_url: row.get(3)?,
        default_model: row.get(4)?,
        credential_ref: row.get(5)?,
        request_format: serde_json::from_str(&request_format_json).unwrap_or_default(),
        capability_overrides: serde_json::from_str::<ProviderCapabilities>(
            &capability_overrides_json,
        )
        .unwrap_or_default(),
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}
