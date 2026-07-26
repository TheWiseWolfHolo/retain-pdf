import { unwrapEnvelope } from "../job/core.js";
import { buildApiEndpoint, fetchProtected, submitJson } from "./http.js";

export type ProviderAdapter =
  | "openai_chat_completions"
  | "anthropic_messages"
  | "gemini_generate_content"
  | "custom_json";

export interface ProviderCapabilities {
  stream: boolean;
  json_schema: boolean;
  json_object: boolean;
  model_listing: boolean;
  balance: boolean;
}

export interface ProviderProfile {
  profile_id: string;
  name: string;
  adapter: ProviderAdapter;
  base_url: string;
  default_model: string;
  has_credential: boolean;
  request_format: Record<string, unknown> | null;
  capabilities: ProviderCapabilities;
  created_at: string;
  updated_at: string;
}

export interface ProviderProfileInput {
  profile_id?: string;
  name: string;
  adapter: ProviderAdapter;
  base_url: string;
  default_model: string;
  api_key?: string;
  clear_api_key?: boolean;
  request_format?: Record<string, unknown>;
  capability_overrides?: Partial<ProviderCapabilities>;
}

async function readJsonResponse<T>(response: Response, action: string): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || `${response.status}`;
    throw new Error(`${action}失败: ${message}`);
  }
  return unwrapEnvelope(payload) as T;
}

export async function listProviderProfiles(apiPrefix: string) {
  const response = await fetchProtected(buildApiEndpoint(apiPrefix, "provider-profiles"));
  return readJsonResponse<{ items: ProviderProfile[] }>(response, "读取 Provider");
}

export function createProviderProfile(apiPrefix: string, payload: ProviderProfileInput) {
  return submitJson(buildApiEndpoint(apiPrefix, "provider-profiles"), payload) as Promise<ProviderProfile>;
}

export async function updateProviderProfile(
  apiPrefix: string,
  profileId: string,
  payload: ProviderProfileInput,
) {
  const response = await fetchProtected(
    buildApiEndpoint(apiPrefix, `provider-profiles/${encodeURIComponent(profileId)}`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return readJsonResponse<ProviderProfile>(response, "保存 Provider");
}

export async function deleteProviderProfile(apiPrefix: string, profileId: string) {
  const response = await fetchProtected(
    buildApiEndpoint(apiPrefix, `provider-profiles/${encodeURIComponent(profileId)}`),
    { method: "DELETE" },
  );
  return readJsonResponse<ProviderProfile>(response, "删除 Provider");
}

export function testProviderProfile(apiPrefix: string, profileId: string) {
  return submitJson(
    buildApiEndpoint(apiPrefix, `provider-profiles/${encodeURIComponent(profileId)}/test`),
    {},
  ) as Promise<{ ok: boolean; message: string }>;
}

export async function listProviderModels(apiPrefix: string, profileId: string) {
  const response = await fetchProtected(
    buildApiEndpoint(apiPrefix, `provider-profiles/${encodeURIComponent(profileId)}/models`),
  );
  return readJsonResponse<{ items: string[] }>(response, "读取模型");
}
