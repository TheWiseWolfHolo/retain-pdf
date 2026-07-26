import { useEffect, useState } from "react";
import { API_PREFIX, listProviderProfiles } from "../../composition/external.js";
import type { ProviderProfile } from "../../composition/external.js";
import { useHomeServices } from "../../home-services-context.js";
import { useCredentialsController } from "./useCredentialsController.js";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;
const PROFILE_CHANGED_EVENT = "retainpdf:provider-profiles-changed";

export function TaskOptionsPanel({ hidden = false } = {}) {
  const { elementsRef } = useCredentialsController();
  const services = useHomeServices();
  const initial = services.features.workflowFeature?.developerConfigWithDefaults?.() || {};
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState(
    `${initial.providerProfileId || initial.provider_profile_id || ""}`,
  );

  useEffect(() => {
    async function refresh(event?: Event) {
      try {
        const result = await listProviderProfiles(API_PREFIX);
        setProfiles(result.items || []);
        const preferred = (event as CustomEvent<{ profileId?: string }>)?.detail?.profileId;
        if (preferred) {
          setSelectedProfileId(preferred);
        }
      } catch {
        setProfiles([]);
      }
    }
    void refresh();
    window.addEventListener(PROFILE_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, refresh);
  }, []);

  function selectProfile(profileId: string) {
    setSelectedProfileId(profileId);
    const profile = profiles.find((item) => item.profile_id === profileId);
    if (profile?.default_model && elementsRef.modelNameInput) {
      elementsRef.modelNameInput.value = profile.default_model;
    }
  }

  return (
    <section
      className={`credential-card credential-panel${hidden ? "" : " is-active"}`}
      data-credential-panel="task"
      role="tabpanel"
      hidden={hidden}
    >
      <div className="credential-card-grid credential-card-grid-compact">
        <section className="credential-card">
          <div className="credential-card-head">
            <h3>任务选项</h3>
          </div>
          <label>
            <span className="developer-label">
              <span>Provider Profile</span>
            </span>
            <select
              id={BROWSER_IDS.providerProfileId}
              aria-label="Provider Profile"
              value={selectedProfileId}
              ref={(node) => { elementsRef.providerProfileIdInput = node || null; }}
              onChange={(event) => selectProfile(event.target.value)}
            >
              <option value="">兼容模式（直接使用下方地址与 API Key）</option>
              {profiles.map((profile) => (
                <option key={profile.profile_id} value={profile.profile_id}>
                  {profile.name} · {profile.adapter}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="developer-label">
              <span>任务模型</span>
            </span>
            <input
              id={BROWSER_IDS.modelName}
              name="model_name"
              type="text"
              defaultValue={`${initial.model || ""}`}
              placeholder="留空使用 Provider 默认模型"
              ref={(node) => { elementsRef.modelNameInput = node || null; }}
            />
          </label>
          <label>
            <span className="developer-label">
              <span>目标语言</span>
            </span>
            <select
              id={BROWSER_IDS.targetLanguage}
              defaultValue={`${initial.targetLanguage || initial.target_language || "zh-CN"}`}
              ref={(node) => { elementsRef.targetLanguageSelect = node || null; }}
            >
              <option value="zh-CN">简体中文</option>
              <option value="zh-TW">繁體中文</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
              <option value="ko">한국어</option>
              <option value="de">Deutsch</option>
              <option value="fr">Français</option>
            </select>
          </label>
          <label>
            <span className="developer-label">
              <span>公式模式</span>
            </span>
            <select
              id={BROWSER_IDS.mathMode}
              aria-label="公式模式"
              defaultValue="direct_typst"
              ref={(node) => { elementsRef.mathModeSelect = node || null; }}
            >
              <option value="placeholder">占位保护</option>
              <option value="direct_typst">直出公式</option>
            </select>
          </label>
          <label>
            <span className="developer-label">
              <span>兼容模式 Base URL</span>
            </span>
            <input
              id={BROWSER_IDS.modelBaseUrl}
              name="model_base_url"
              type="url"
              defaultValue={`${initial.baseUrl || ""}`}
              placeholder="仅未选择 Provider 时使用"
              ref={(node) => { elementsRef.modelBaseUrlInput = node || null; }}
            />
          </label>
          <label>
            <span className="developer-label">
              <span>每秒请求上限（0 = 不限制）</span>
            </span>
            <input
              id={BROWSER_IDS.rateLimitQps}
              type="number"
              min="0"
              step="1"
              defaultValue={`${initial.rateLimitQps || initial.rate_limit_qps || 0}`}
              ref={(node) => { elementsRef.rateLimitQpsInput = node || null; }}
            />
          </label>
          <label>
            <span className="developer-label">
              <span>每分钟请求上限（0 = 不限制）</span>
            </span>
            <input
              id={BROWSER_IDS.rateLimitRpm}
              type="number"
              min="0"
              step="1"
              defaultValue={`${initial.rateLimitRpm || initial.rate_limit_rpm || 0}`}
              ref={(node) => { elementsRef.rateLimitRpmInput = node || null; }}
            />
          </label>
        </section>
      </div>
    </section>
  );
}
