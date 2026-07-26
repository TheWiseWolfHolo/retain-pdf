import { useEffect, useState } from "react";
import {
  API_PREFIX,
  createProviderProfile,
  deleteProviderProfile,
  listProviderModels,
  listProviderProfiles,
  testProviderProfile,
  updateProviderProfile,
} from "../../composition/external.js";
import type {
  ProviderAdapter,
  ProviderProfile,
  ProviderProfileInput,
} from "../../composition/external.js";

const PROFILE_CHANGED_EVENT = "retainpdf:provider-profiles-changed";

const ADAPTERS: Array<{ value: ProviderAdapter; label: string; baseUrl: string }> = [
  { value: "openai_chat_completions", label: "OpenAI Chat Completions", baseUrl: "https://api.openai.com/v1" },
  { value: "anthropic_messages", label: "Anthropic Messages", baseUrl: "https://api.anthropic.com/v1" },
  { value: "gemini_generate_content", label: "Gemini Generate Content", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  { value: "custom_json", label: "Custom JSON / SSE", baseUrl: "" },
];

const CUSTOM_FORMAT_EXAMPLE = {
  request: {
    method: "POST",
    path: "/chat/completions",
    headers: { Authorization: "Bearer {{api_key}}" },
    body: {
      model: "{{model}}",
      messages: "{{messages}}",
      temperature: "{{temperature}}",
    },
  },
  response: { content_path: "choices[0].message.content" },
  stream: {
    enabled: false,
    data_prefix: "data:",
    done_sentinel: "[DONE]",
    content_path: "choices[0].delta.content",
  },
  probe: {
    method: "GET",
    path: "/models",
    headers: { Authorization: "Bearer {{api_key}}" },
  },
  models: {
    method: "GET",
    path: "/models",
    headers: { Authorization: "Bearer {{api_key}}" },
    items_path: "data",
    id_path: "id",
  },
};

function blankInput(): ProviderProfileInput {
  return {
    name: "",
    adapter: "openai_chat_completions",
    base_url: ADAPTERS[0].baseUrl,
    default_model: "",
    api_key: "",
    request_format: {},
    capability_overrides: {},
  };
}

function inputFromProfile(profile: ProviderProfile): ProviderProfileInput {
  return {
    profile_id: profile.profile_id,
    name: profile.name,
    adapter: profile.adapter,
    base_url: profile.base_url,
    default_model: profile.default_model,
    api_key: "",
    request_format: profile.request_format || {},
    capability_overrides: {},
  };
}

export function ProviderProfilesPanel() {
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<ProviderProfileInput>(blankInput);
  const [requestFormatText, setRequestFormatText] = useState("{}");
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshProfiles(preferredId = editingId) {
    const result = await listProviderProfiles(API_PREFIX);
    setProfiles(result.items || []);
    const selected = result.items.find((item) => item.profile_id === preferredId);
    if (selected) {
      setEditingId(selected.profile_id);
      setForm(inputFromProfile(selected));
      setRequestFormatText(JSON.stringify(selected.request_format || {}, null, 2));
    }
  }

  useEffect(() => {
    void refreshProfiles().catch((error) => setStatus(error.message || String(error)));
  }, []);

  function chooseProfile(profileId: string) {
    const profile = profiles.find((item) => item.profile_id === profileId);
    setEditingId(profileId);
    setModels([]);
    if (!profile) {
      setForm(blankInput());
      setRequestFormatText("{}");
      return;
    }
    setForm(inputFromProfile(profile));
    setRequestFormatText(JSON.stringify(profile.request_format || {}, null, 2));
  }

  function changeAdapter(adapter: ProviderAdapter) {
    const definition = ADAPTERS.find((item) => item.value === adapter);
    setForm((current) => ({
      ...current,
      adapter,
      base_url: definition?.baseUrl || current.base_url,
      request_format: adapter === "custom_json" ? CUSTOM_FORMAT_EXAMPLE : {},
    }));
    setRequestFormatText(
      JSON.stringify(adapter === "custom_json" ? CUSTOM_FORMAT_EXAMPLE : {}, null, 2),
    );
  }

  async function saveProfile() {
    setBusy(true);
    setStatus("");
    try {
      const requestFormat = JSON.parse(requestFormatText || "{}");
      const payload = { ...form, request_format: requestFormat };
      const saved = editingId
        ? await updateProviderProfile(API_PREFIX, editingId, payload)
        : await createProviderProfile(API_PREFIX, payload);
      await refreshProfiles(saved.profile_id);
      window.dispatchEvent(new CustomEvent(PROFILE_CHANGED_EVENT, {
        detail: { profileId: saved.profile_id },
      }));
      setStatus("Provider 已保存");
    } catch (error) {
      setStatus((error as Error).message || String(error));
    } finally {
      setBusy(false);
    }
  }

  async function testProfile() {
    if (!editingId) return;
    setBusy(true);
    try {
      const result = await testProviderProfile(API_PREFIX, editingId);
      setStatus(result.message || "连接成功");
    } catch (error) {
      setStatus((error as Error).message || String(error));
    } finally {
      setBusy(false);
    }
  }

  async function loadModels() {
    if (!editingId) return;
    setBusy(true);
    try {
      const result = await listProviderModels(API_PREFIX, editingId);
      setModels(result.items || []);
      setStatus(`发现 ${result.items?.length || 0} 个模型`);
    } catch (error) {
      setStatus((error as Error).message || String(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeProfile() {
    if (!editingId || !window.confirm("删除这个 Provider Profile？")) return;
    setBusy(true);
    try {
      await deleteProviderProfile(API_PREFIX, editingId);
      chooseProfile("");
      await refreshProfiles("");
      window.dispatchEvent(new CustomEvent(PROFILE_CHANGED_EVENT));
      setStatus("Provider 已删除");
    } catch (error) {
      setStatus((error as Error).message || String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="credential-card provider-profile-card">
      <div className="credential-card-head">
        <h3>Provider Profiles</h3>
        <button type="button" className="app-button secondary" onClick={() => chooseProfile("")}>
          新建
        </button>
      </div>
      <label>
        <span className="developer-label">编辑现有 Provider</span>
        <select value={editingId} onChange={(event) => chooseProfile(event.target.value)}>
          <option value="">新 Provider</option>
          {profiles.map((profile) => (
            <option key={profile.profile_id} value={profile.profile_id}>{profile.name}</option>
          ))}
        </select>
      </label>
      <div className="provider-profile-form-grid">
        <label>
          <span className="developer-label">名称</span>
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="例如：公司 Claude 网关"
          />
        </label>
        <label>
          <span className="developer-label">请求格式</span>
          <select
            value={form.adapter}
            onChange={(event) => changeAdapter(event.target.value as ProviderAdapter)}
          >
            {ADAPTERS.map((adapter) => (
              <option key={adapter.value} value={adapter.value}>{adapter.label}</option>
            ))}
          </select>
        </label>
        <label className="provider-profile-wide">
          <span className="developer-label">Base URL</span>
          <input
            value={form.base_url}
            onChange={(event) => setForm((current) => ({ ...current, base_url: event.target.value }))}
            placeholder="https://gateway.example.com/v1"
          />
        </label>
        <label>
          <span className="developer-label">默认模型</span>
          <input
            value={form.default_model}
            onChange={(event) => setForm((current) => ({ ...current, default_model: event.target.value }))}
            list="provider-profile-models"
            placeholder="模型名可留空后按任务选择"
          />
          <datalist id="provider-profile-models">
            {models.map((model) => <option key={model} value={model} />)}
          </datalist>
        </label>
        <label>
          <span className="developer-label">API Key</span>
          <input
            type="password"
            autoComplete="off"
            value={form.api_key || ""}
            onChange={(event) => setForm((current) => ({ ...current, api_key: event.target.value }))}
            placeholder={editingId ? "留空则保留原 Key" : "必填"}
          />
        </label>
        {form.adapter === "custom_json" ? (
          <label className="provider-profile-wide">
            <span className="developer-label">Custom Request Format（JSON）</span>
            <textarea
              rows={10}
              value={requestFormatText}
              onChange={(event) => setRequestFormatText(event.target.value)}
              spellCheck={false}
            />
          </label>
        ) : null}
      </div>
      <div className="credential-card-actions">
        <button type="button" className="app-button" disabled={busy} onClick={() => void saveProfile()}>
          保存 Provider
        </button>
        <button type="button" className="app-button secondary" disabled={busy || !editingId} onClick={() => void testProfile()}>
          测试连接
        </button>
        <button type="button" className="app-button secondary" disabled={busy || !editingId} onClick={() => void loadModels()}>
          获取模型
        </button>
        <button type="button" className="app-button secondary" disabled={busy || !editingId} onClick={() => void removeProfile()}>
          删除
        </button>
        <span className="upload-status">{status}</span>
      </div>
    </section>
  );
}
