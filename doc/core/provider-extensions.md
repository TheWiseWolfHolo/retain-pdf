# Translation Provider Extensions

本文定义 Fork 在最新上游基础上增加的显式 Provider、原生协议和自定义请求格式。实现必须遵守现有翻译层边界：`runtime/pipeline` 只负责编排，provider 私有 JSON 不得泄漏到 translation workflow。

## 目标

- 保持最新上游的 OCR、翻译、渲染、桌面端和任务系统功能可持续同步。
- 在设置中创建、编辑、复制、删除和测试实例级 Provider Profile。
- 内置支持 OpenAI Chat Completions、Anthropic Messages 和 Gemini Generate Content。
- 支持声明式自定义 HTTP JSON/SSE 请求和响应提取。
- 一个 Profile 提供默认模型和可选模型目录；每个任务可以选择具体模型。
- 任务记录可复现所用 Provider 配置，但不包含原始凭据。
- 保留旧版 `translation.base_url/model/api_key` 请求作为上游兼容路径。

## 非目标

- 不加载外部 Python、JavaScript 或二进制插件。
- 不根据任意 Base URL 自动猜测协议。
- 不建立用户、租户或 Profile 权限系统。
- 不把 RetainPDF 变成通用 HTTP 自动化平台。
- 不在不同 Provider 或模型之间自动路由、故障转移或负载均衡。
- 不强行统一不同厂商的计费和余额语义。

## 总体结构

```text
Frontend Provider Manager
        |
        v
Rust Provider Profile API ---- Provider secret store
        |
        v
Job provider resolution
        |
        +---- sanitized Provider Snapshot -> job DB / stage spec
        |
        +---- credential -> worker environment only
                              |
                              v
Python Provider Resolver
        |
        +---- openai_chat_completions
        +---- anthropic_messages
        +---- gemini_generate_content
        `---- custom_json
                              |
                              v
Existing translation workflow
```

### 上游接入点

Fork 应把上游文件修改限制在以下入口附近：

1. Rust `TranslationInput` 增加 Profile 引用和非敏感 Provider Snapshot。
2. Job 创建时解析 Profile；没有 Profile 时保持上游原始行为。
3. worker 启动时注入 Provider ID、凭据和自定义格式环境。
4. translate/provider stage spec 保存非敏感 Provider Snapshot。
5. Python `provider_registry` 根据显式 Adapter ID 选择 runtime。
6. 前端 workflow payload 增加 `provider_profile_id` 和模型选择。

Provider 私有请求体、响应体和错误结构不得进入 `runtime/pipeline`、translation workflow 或 rendering。

## 数据模型

### Provider Profile

服务端持久化表：

```text
provider_profiles
  profile_id              TEXT PRIMARY KEY
  name                    TEXT NOT NULL
  adapter                 TEXT NOT NULL
  base_url                TEXT NOT NULL
  default_model           TEXT NOT NULL
  credential_ref          TEXT NOT NULL
  request_format_json     TEXT NOT NULL DEFAULT '{}'
  capability_overrides_json TEXT NOT NULL DEFAULT '{}'
  created_at              TEXT NOT NULL
  updated_at              TEXT NOT NULL
```

约束：

- Profile 属于整个实例，不含 `user_id` 或 `tenant_id`。
- `adapter` 只允许 `openai_chat_completions`、`anthropic_messages`、`gemini_generate_content`、`custom_json`。
- 内置 Adapter 的请求结构由代码拥有；`request_format_json` 只用于 `custom_json`。
- Profile 只保存一个 `default_model`，不为每个模型建立子记录。
- 模型目录按需获取，不作为任务真相源。

### Provider Snapshot

创建任务时解析 Profile，生成不含凭据的快照：

```json
{
  "profile_id": "anthropic-main",
  "adapter": "anthropic_messages",
  "base_url": "https://api.anthropic.com",
  "model": "claude-sonnet-4-6",
  "request_format": {},
  "capabilities": {
    "stream": true,
    "json_schema": false,
    "json_object": false,
    "model_listing": true,
    "balance": false
  }
}
```

Job 选择的 `translation.model` 优先于 Profile 的 `default_model`。Profile 后续更新不会修改已有 Snapshot。

### Secret store

真实 Key 位于实例数据根目录：

```text
data/
  secrets/
    provider-profiles/
      <profile_id>.secret
```

规则：

- Profile API 的读响应只返回 `has_credential`。
- 新建 Profile 必须提交凭据。
- 更新 Profile 未提交凭据时保留旧 secret。
- 更新时显式要求清除凭据才删除 secret。
- Unix 下创建文件时限制为当前服务用户可读写。
- Job、日志、错误和测试响应不得包含 secret 内容。

## Job API

### 新 Profile 路径

```json
{
  "workflow": "book",
  "source": {
    "upload_id": "upload-1"
  },
  "translation": {
    "provider_profile_id": "anthropic-main",
    "model": "claude-sonnet-4-6",
    "workers": 4,
    "batch_size": 8
  }
}
```

服务端解析后才运行现有 validation 和 worker command 构造。

### 上游兼容路径

没有 `provider_profile_id` 时继续接受：

```json
{
  "translation": {
    "api_key": "<runtime key>",
    "model": "deepseek-chat",
    "base_url": "https://api.deepseek.com/v1"
  }
}
```

兼容路径不获得 Profile 管理、模型目录或自定义格式能力，不在新 UI 中继续暴露。

## Provider Profile API

```text
GET    /api/v1/provider-profiles
POST   /api/v1/provider-profiles
GET    /api/v1/provider-profiles/:profile_id
PUT    /api/v1/provider-profiles/:profile_id
DELETE /api/v1/provider-profiles/:profile_id
POST   /api/v1/provider-profiles/:profile_id/test
GET    /api/v1/provider-profiles/:profile_id/models
```

`test` 使用 Profile 的真实 Adapter 和凭据发送模型目录请求；`custom_json` 使用
`request_format.probe`。失败直接返回 Provider 状态和错误摘要，不自动改写配置。

`models` 是可选能力。失败不清空手工填写的模型，也不阻止保存 Profile。

余额仍保留为 capability 声明，但首版不把不同厂商的计费接口强行统一成一个 API。

## Canonical LLM request

translation workflow 向 Adapter 传递统一输入：

```text
ChatRequest
  messages
  model
  temperature
  response_format
  stream
  timeout
  request_label
```

Adapter 返回：

```text
ChatResult
  content
  usage
  provider_request_id
```

现有批次切分、prompt 构建、结果校验、缓存和翻译重试继续属于共享翻译层，不复制到各 Adapter。

## Built-in Adapters

### OpenAI Chat Completions

- 请求：`POST {base_url}/chat/completions`
- 鉴权：`Authorization: Bearer`
- 文本：`choices[0].message.content`
- 流式：SSE `choices[].delta.content`
- 模型：`GET {base_url}/models`

DeepSeek 官方和 OpenAI-compatible 端点使用该 Adapter；DeepSeek 余额能力作为该 Profile 的可选扩展保留。

### Anthropic Messages

- 请求：`POST {base_url}/v1/messages`
- 鉴权：`x-api-key` 和 `anthropic-version`
- system message 映射到顶层 `system`
- 文本：拼接 `content[]` 中的 text block
- 流式：解析 Anthropic SSE content block delta
- 模型目录由 Adapter 实现；不可用时允许手工模型

### Gemini Generate Content

- 请求：`POST {base_url}/v1beta/models/{model}:generateContent`
- 鉴权：`x-goog-api-key`
- messages 映射到 `contents[].parts[]`
- 文本：拼接 `candidates[0].content.parts[].text`
- 流式：调用 streamGenerateContent 并解析事件
- 模型：调用 Gemini models endpoint

## Custom Request Format

Custom Provider Profile 拥有声明式格式：

```json
{
  "request": {
    "method": "POST",
    "path": "/v1/messages",
    "headers": {
      "x-api-key": "{{api_key}}",
      "content-type": "application/json"
    },
    "body": {
      "model": "{{model}}",
      "system": "{{system_prompt}}",
      "messages": "{{messages}}",
      "temperature": "{{temperature}}"
    }
  },
  "response": {
    "content_path": "content[0].text",
    "input_tokens_path": "usage.input_tokens",
    "output_tokens_path": "usage.output_tokens",
    "request_id_header": "request-id"
  },
  "stream": {
    "enabled": false,
    "data_prefix": "data:",
    "done_sentinel": "[DONE]",
    "content_path": "delta.text"
  },
  "probe": {
    "method": "GET",
    "path": "/v1/models",
    "headers": {
      "Authorization": "Bearer {{api_key}}"
    }
  },
  "models": {
    "method": "GET",
    "path": "/v1/models",
    "headers": {
      "Authorization": "Bearer {{api_key}}"
    },
    "items_path": "data",
    "id_path": "id"
  }
}
```

### 模板规则

固定变量：

```text
{{api_key}}
{{model}}
{{system_prompt}}
{{messages}}
{{temperature}}
{{response_schema}}
```

- JSON 值完全等于一个占位符时，注入其原始 JSON 类型。
- 字符串中的占位符只进行字符串替换。
- Header 中允许 `api_key`，但日志和预览必须遮蔽替换后的值。
- `content_path` 使用受限的点号/数组下标路径，不执行 JSONPath 脚本或表达式。
- 请求和响应只支持 JSON；流式只支持逐事件 JSON 的 SSE。

## Capabilities

Capabilities 是 Adapter 的显式静态声明，不通过任意探测请求猜测：

```text
supports_stream
supports_json_schema
supports_json_object
supports_model_listing
supports_balance
```

Custom Profile 可以在格式实际定义了对应映射时启用能力。运行时只根据声明选择路径；不静默切换 Provider 或模型。

## Retry and errors

保留上游共享 transport 语义：

- timeout、连接错误、429、408、500、502、503、504 可以重试。
- 默认请求最多两次；DNS 解析问题沿用上游最小尝试次数。
- 尊重 `Retry-After` 和上游累计等待上限。
- 400、401、403、404 和模型不存在不重试。
- 结构化输出可以从 `json_schema` 降级到 `json_object`；不跨 Provider 降级。

Provider Adapter 只负责把厂商错误映射为统一错误字段，不建立庞大的厂商错误码知识库：

```text
category
status_code
provider_code
message
request_id
retryable
```

## Frontend

设置中心新增“翻译 Provider”管理：

```text
Provider 列表
  + 新建 Provider
  + 复制为自定义
  + 编辑
  + 测试
  + 删除
```

内置 Profile 编辑字段：

- 名称
- Adapter
- Base URL
- API Key
- 默认模型
- 刷新模型

Custom Profile 额外显示完整 JSON 格式编辑器，统一编辑 Method、Path、Headers、
Body 模板、响应路径、SSE、probe 和模型目录规则。

任务面板显式选择 Profile 和模型。刷新模型失败时保留文本输入，用户仍可手工提交模型 ID。

任务还可以显式选择目标语言，并设置 QPS/RPM 请求上限。`0` 表示不限制；
两项同时设置时采用更严格的最小请求间隔。限速作用于当前 worker 内所有翻译
Provider 请求，不修改 Provider Profile。

## Fork 迁移

当前 Fork 相对最新上游落后 347 个提交并有 6 个独有提交。迁移不在旧分支上合并 347 个提交，而是：

1. 以最新 `upstream/main` 为新基线。
2. 实现本文 Provider 扩展。
3. 从旧 Fork 迁移仍有价值的目标语言和请求限速能力。
4. 复用旧模型目录测试中的归一化用例，不复用旧页面和 Rust route 的分叉结构。
5. 删除被上游替代的旧兼容 shim。
6. 完成测试和实际 Provider smoke 后替换 Fork 默认分支。

## 验证

最小自动验证：

```text
Rust
  provider profile CRUD
  secret 不出现在 API/Job/stage spec
  profile resolution 和 legacy request
  test/models capability routing

Python
  OpenAI/Anthropic/Gemini request mapping
  response and SSE extraction
  custom template typed substitution
  adapter selection per worker
  shared retry contract

Frontend
  Profile CRUD state
  explicit adapter selection
  optional model listing with manual fallback
  custom format serialization
  workflow payload references profile and model

Architecture
  provider raw JSON 不越过 llm/provider boundary
  upstream legacy job contract remains accepted
```

发布前还必须执行现有仓库的 Rust、Python translation、frontend type/build 和 architecture checks，并用至少一个 OpenAI-compatible 测试端点完成实际端到端翻译。
