# RetainPDF Language and Rate Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Docker 版 RetainPDF 增加目标语言、并发与限流控制，并提供一键启动脚本。

**Architecture:** 前端在现有“接口设置”弹窗中新增一个保持轻量风格的翻译偏好区，Rust API 透传新字段，Python 翻译链路在 prompt 构造与统一请求入口接入目标语言和限流。

**Tech Stack:** 原生前端 JS、Rust API、Python 翻译脚本、Windows CMD

---

### Task 1: 扩展前端设置模型

**Files:**
- Modify: `frontend/src/js/constants.js`
- Modify: `frontend/src/js/model-catalog.js`
- Modify: `frontend/src/js/config.js`
- Test: `frontend/tests/model-catalog.test.js`

- [ ] 补充默认目标语言、限流默认值与存储归一化
- [ ] 让测试先覆盖新字段
- [ ] 跑 `npm test`

### Task 2: 扩展弹窗与任务提交

**Files:**
- Modify: `frontend/src/partials/dialogs.html`
- Modify: `frontend/src/partials/main-content.html`
- Modify: `frontend/src/styles/components.css`
- Modify: `frontend/src/js/main.js`

- [ ] 在接口设置里新增“翻译偏好”卡片
- [ ] 保持高级参数折叠，避免破坏现有视觉层级
- [ ] 提交 payload 时带上目标语言 / 并发 / 限流参数
- [ ] 跑 `npm test` 与 `npm run build:css`

### Task 3: 打通 Rust API 参数

**Files:**
- Modify: `backend/rust_api/src/models/defaults.rs`
- Modify: `backend/rust_api/src/models/input.rs`
- Modify: `backend/rust_api/src/routes/job_requests.rs`
- Modify: `backend/rust_api/src/job_runner/commands.rs`

- [ ] 为 translation input 增加目标语言与限流字段
- [ ] 让 multipart / JSON 请求都能接收这些字段
- [ ] 让命令构建层透传 CLI 参数
- [ ] 跑 `cargo test`

### Task 4: 打通 Python 翻译链路

**Files:**
- Create: `backend/scripts/services/translation/llm/target_language.py`
- Create: `backend/scripts/services/translation/llm/request_limits.py`
- Modify: `backend/scripts/services/translation/llm/deepseek_client.py`
- Modify: `backend/scripts/services/translation/llm/translation_client.py`
- Modify: `backend/scripts/services/translation/llm/retrying_translator.py`
- Modify: `backend/scripts/services/translation/llm/fallbacks.py`
- Modify: `backend/scripts/services/translation/llm/segment_routing.py`
- Modify: `backend/scripts/services/translation/postprocess/garbled_reconstruction.py`
- Modify: `backend/scripts/runtime/pipeline/*.py`
- Modify: `backend/scripts/entrypoints/*.py`
- Test: `backend/scripts/devtools/tests/translation/test_target_language_and_rate_limits.py`

- [ ] 新增目标语言规范化与提示语覆盖
- [ ] 新增全局请求限流器，并在请求发送前统一生效
- [ ] 让公式窗口与乱码重建也使用目标语言
- [ ] 跑 Python 单测

### Task 5: 一键启动脚本与文档

**Files:**
- Create: `启动 RetainPDF.cmd`
- Create: `停止 RetainPDF.cmd`
- Create: `重启 RetainPDF.cmd`
- Modify: `docker/entrypoint-web.sh`
- Modify: `docker/delivery/docker/web.env`
- Modify: `README.md`
- Modify: `docker/delivery/README.md`

- [ ] 新增双击可用脚本
- [ ] 更新 Docker runtime config 支持目标语言与限流默认值
- [ ] 补充 README 使用说明
- [ ] 重建镜像并做运行态验证
