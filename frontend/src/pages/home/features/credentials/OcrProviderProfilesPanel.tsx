import { useState } from "react";
import {
  loadBrowserStoredConfig,
  OCR_PROVIDER_DEFINITIONS,
  savePersistedBrowserStoredConfig,
} from "../../composition/external.js";
import { useHomeServices } from "../../home-services-context.js";
import { useCredentialsController } from "./useCredentialsController.js";

type OcrProfile = {
  profileId: string;
  name: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
};

function defaultProfile(provider = "paddle"): OcrProfile {
  const custom = provider === "custom_ocr";
  return {
    profileId: "",
    name: custom ? "自定义 OCR" : "PaddleOCR",
    provider,
    baseUrl: custom ? "https://api.mistral.ai" : "",
    model: custom ? "mistral-ocr-latest" : "",
    apiKey: "",
  };
}

function normalizeProfile(value: any): OcrProfile | null {
  if (!value || typeof value !== "object") return null;
  const profileId = `${value.profileId || value.profile_id || ""}`.trim();
  const provider = value.provider === "custom_ocr" ? "custom_ocr" : "paddle";
  if (!profileId) return null;
  return {
    profileId,
    name: `${value.name || ""}`.trim() || (provider === "custom_ocr" ? "自定义 OCR" : "PaddleOCR"),
    provider,
    baseUrl: `${value.baseUrl || value.base_url || ""}`.trim(),
    model: `${value.model || ""}`.trim(),
    apiKey: `${value.apiKey || value.api_key || ""}`.trim(),
  };
}

function newProfileId() {
  return `ocr-${Date.now().toString(36)}`;
}

export function OcrProviderProfilesPanel() {
  const services = useHomeServices();
  const { credentials, elementsRef } = useCredentialsController();
  const developerConfig = services.features.workflowFeature?.developerConfigWithDefaults?.() || {};
  const storedProfiles = Array.isArray(developerConfig.ocrProfiles)
    ? developerConfig.ocrProfiles.map(normalizeProfile).filter(Boolean) as OcrProfile[]
    : [];
  const legacyProfile = {
    ...defaultProfile(credentials.ocrProvider),
    profileId: "ocr-default",
    apiKey: credentials.paddleToken || "",
    baseUrl: `${developerConfig.ocrBaseUrl || "https://api.mistral.ai"}`,
    model: `${developerConfig.ocrModel || "mistral-ocr-latest"}`,
  };
  const initialProfiles = storedProfiles.length ? storedProfiles : [legacyProfile];
  const initialActiveId = `${developerConfig.ocrProfileId || ""}`.trim()
    || initialProfiles[0].profileId;
  const initialForm = initialProfiles.find((item) => item.profileId === initialActiveId)
    || initialProfiles[0];

  const [profiles, setProfiles] = useState<OcrProfile[]>(initialProfiles);
  const [activeId, setActiveId] = useState(initialActiveId);
  const [editingId, setEditingId] = useState(initialForm.profileId);
  const [form, setForm] = useState<OcrProfile>({ ...initialForm });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function chooseProfile(id: string) {
    const selected = profiles.find((item) => item.profileId === id);
    setEditingId(id);
    setForm(selected ? { ...selected } : defaultProfile());
    setStatus("");
  }

  function changeProvider(provider: string) {
    const next = defaultProfile(provider);
    setForm((current) => ({
      ...current,
      provider: next.provider,
      baseUrl: next.baseUrl,
      model: next.model,
    }));
  }

  async function persistActiveProfile(nextProfiles: OcrProfile[], selected: OcrProfile) {
    const browserConfig = loadBrowserStoredConfig();
    await savePersistedBrowserStoredConfig({
      ...browserConfig,
      ocrProvider: selected.provider,
      paddleToken: selected.apiKey,
    });
    await services.features.workflowFeature?.updateDeveloperConfig?.({
      ocrProfiles: nextProfiles,
      ocrProfileId: selected.profileId,
      ocrBaseUrl: selected.baseUrl,
      ocrModel: selected.model,
    });
    services.ports.credentialsStatePort.setCredentials({
      ocrProvider: selected.provider,
      paddleToken: selected.apiKey,
      modelApiKey: credentials.modelApiKey,
    });
    window.dispatchEvent(new CustomEvent("retainpdf:ocr-profiles-changed", {
      detail: { profileId: selected.profileId },
    }));
  }

  async function saveProfile() {
    const name = form.name.trim();
    const apiKey = form.apiKey.trim();
    if (!name || !apiKey) {
      setStatus("请填写名称和 API Key");
      return;
    }
    if (form.provider === "custom_ocr" && (!form.baseUrl.trim() || !form.model.trim())) {
      setStatus("自定义 OCR 需要 Base URL 和模型");
      return;
    }
    setBusy(true);
    try {
      const saved = {
        ...form,
        profileId: editingId || newProfileId(),
        name,
        apiKey,
        baseUrl: form.baseUrl.trim(),
        model: form.model.trim(),
      };
      const nextProfiles = editingId
        ? profiles.map((item) => item.profileId === editingId ? saved : item)
        : [...profiles, saved];
      setProfiles(nextProfiles);
      setEditingId(saved.profileId);
      setForm(saved);
      setActiveId(saved.profileId);
      await persistActiveProfile(nextProfiles, saved);
      setStatus("OCR Profile 已保存并启用");
    } catch (error) {
      setStatus((error as Error).message || String(error));
    } finally {
      setBusy(false);
    }
  }

  async function activateProfile(id: string) {
    const selected = profiles.find((item) => item.profileId === id);
    if (!selected) return;
    setBusy(true);
    try {
      setActiveId(id);
      setEditingId(id);
      setForm({ ...selected });
      await persistActiveProfile(profiles, selected);
      setStatus(`已启用 ${selected.name}`);
    } catch (error) {
      setStatus((error as Error).message || String(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeProfile() {
    if (!editingId || profiles.length <= 1) return;
    const nextProfiles = profiles.filter((item) => item.profileId !== editingId);
    const nextActive = activeId === editingId
      ? nextProfiles[0]
      : nextProfiles.find((item) => item.profileId === activeId) || nextProfiles[0];
    setProfiles(nextProfiles);
    setEditingId(nextActive.profileId);
    setForm({ ...nextActive });
    setActiveId(nextActive.profileId);
    await persistActiveProfile(nextProfiles, nextActive);
    setStatus("OCR Profile 已删除");
  }

  return (
    <section className="credential-card provider-profile-card">
      <div className="credential-card-head provider-profile-card-head">
        <h3>OCR Provider Profiles</h3>
        <div className="provider-profile-head-actions">
          <button id="browser-ocr-profile-new-btn" type="button" className="app-button secondary" onClick={() => chooseProfile("")}>
            新建
          </button>
          <button
            id="browser-ocr-profile-save-btn"
            type="button"
            className="app-button"
            disabled={busy}
            onClick={() => void saveProfile()}
          >
            保存并启用
          </button>
        </div>
      </div>
      <label>
        <span className="developer-label">当前 OCR Profile</span>
        <select
          id="browser-ocr-profile-select"
          value={activeId}
          disabled={busy}
          onChange={(event) => void activateProfile(event.target.value)}
        >
          {profiles.map((profile) => (
            <option key={profile.profileId} value={profile.profileId}>
              {profile.name} · {profile.provider}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="developer-label">编辑 Profile</span>
        <select id="browser-ocr-profile-edit-select" value={editingId} onChange={(event) => chooseProfile(event.target.value)}>
          <option value="">新 OCR Profile</option>
          {profiles.map((profile) => (
            <option key={profile.profileId} value={profile.profileId}>{profile.name}</option>
          ))}
        </select>
      </label>
      <div className="provider-profile-form-grid">
        <label>
          <span className="developer-label">名称</span>
          <input
            id="browser-ocr-profile-name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="例如：公司 OCR 网关"
          />
        </label>
        <label>
          <span className="developer-label">Provider</span>
          <select
            id="browser-ocr-provider-select"
            value={form.provider}
            onChange={(event) => changeProvider(event.target.value)}
          >
            {OCR_PROVIDER_DEFINITIONS.map((provider) => (
              <option key={provider.id} value={provider.id}>{provider.label}</option>
            ))}
          </select>
        </label>
        <label className="provider-profile-wide">
          <span className="developer-label">API Key</span>
          <input
            id="browser-ocr-profile-api-key"
            type="password"
            autoComplete="off"
            value={form.apiKey}
            ref={(node) => { elementsRef.activeOcrTokenInput = node || null; }}
            onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
          />
        </label>
        {form.provider === "custom_ocr" ? (
          <>
            <label className="provider-profile-wide">
              <span className="developer-label">Base URL</span>
              <input
                id="browser-custom-ocr-base-url"
                type="url"
                value={form.baseUrl}
                ref={(node) => { elementsRef.ocrBaseUrlInput = node || null; }}
                onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))}
                placeholder="服务根地址、/v1 或完整 /v1/ocr"
              />
            </label>
            <label>
              <span className="developer-label">OCR 模型</span>
              <input
                id="browser-custom-ocr-model"
                value={form.model}
                ref={(node) => { elementsRef.ocrModelInput = node || null; }}
                onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
                placeholder="mistral-ocr-latest"
              />
            </label>
            <p className="credential-card-description provider-profile-wide">
              请求使用 Bearer Key 与 multipart 的 model、file 字段。
            </p>
          </>
        ) : null}
      </div>
      <div className="credential-card-actions">
        <button
          type="button"
          className="app-button secondary"
          disabled={busy || !editingId || profiles.length <= 1}
          onClick={() => void removeProfile()}
        >
          删除
        </button>
        {status ? (
          <span id="browser-ocr-profile-status" className="upload-status">{status}</span>
        ) : null}
      </div>
    </section>
  );
}
