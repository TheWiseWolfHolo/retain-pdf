# 0005 通过显式 Provider Adapter 扩展上游

## 背景

Fork 需要持续同步 RetainPDF 上游，同时支持 OpenAI、Anthropic、Gemini 原生协议和用户声明的自定义 JSON/SSE 请求格式。继续在 DeepSeek transport、翻译编排和页面设置中分散增加条件分支，会扩大每次同步上游的冲突面。

## 决策

以上游 `main` 为实现基线，只在任务输入、worker 启动、LLM provider runtime 和设置界面保留少量接入点。翻译业务继续消费统一的 LLM 请求；显式选择的 Provider Adapter 负责协议转换。内置 Adapter 使用代码实现，自定义 Provider 使用声明式请求格式，不支持运行时加载外部代码。

## 后果

- 上游没有 `provider_profile_id` 时继续走原有 DeepSeek/OpenAI-compatible 路径。
- OpenAI、Anthropic、Gemini 和 `custom_json` 共享同一 Provider Profile 生命周期。
- 新 Provider 必须实现明确的 Adapter 或使用声明式格式，不能靠 Base URL 自动猜测协议。
- Fork 差异集中在 Provider 扩展边界，避免复制或替换上游翻译编排。

## 替代方案

- 继续扩展 DeepSeek client：初始修改较小，但厂商协议差异会持续泄漏到上游代码。
- 动态 Python 插件：扩展性更强，但需要稳定插件 ABI、依赖隔离和信任模型，不符合当前单实例自托管目标。
