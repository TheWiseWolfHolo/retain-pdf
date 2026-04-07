# RetainPDF 浏览器端开放模型 Base URL 与模型列表设计

## 目标

在本地 Docker 版本中，把当前仅支持固定 DeepSeek 预设的浏览器端接口设置，扩展为：

- 用户可配置模型 API Key
- 用户可配置模型 Base URL
- 用户可主动拉取模型列表并选择模型 ID
- 提交任务时把用户选择的 model/base_url/api_key 带入现有后端链路
- 保持现有页面语言、层级与视觉风格统一，不做大拆大改

## 设计判断

1. Rust API 已经支持 `translation.base_url` / `translation.model` / `translation.api_key`，因此模型提交链路不需要推翻重做。
2. 当前前端虽然已有对 `${baseUrl}/models` 的浏览器直连尝试，但真实环境容易被 CORS 卡住，因此模型列表应改成后端代理接口。
3. 浏览器端设置弹窗仍维持双卡片结构：
   - MinerU OCR
   - 模型服务
   但模型服务卡片需要新增 Base URL、模型 ID 输入与模型列表获取交互。
4. 本次改动以 Docker/browser 路线为主，不扩大到桌面端持久化协议重构；桌面端保持兼容现状。

## 验收标准

- 浏览器弹窗内可见并可编辑模型 Base URL、模型 API Key、模型 ID
- 点击获取模型后，后端代理成功返回模型列表，前端可选择并回填模型 ID
- 浏览器本地刷新后仍保留自定义 baseUrl/model/apiKey/mineruToken
- 创建任务时 payload 使用用户自定义值
- 本地 Docker 镜像可重建并成功启动
- README 与 docker/delivery/README 明确说明 fork 背景、感谢原项目、以及新增配置能力
