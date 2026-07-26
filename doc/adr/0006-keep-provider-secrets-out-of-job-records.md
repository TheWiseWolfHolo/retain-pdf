# 0006 Provider 凭据不进入任务记录

## 背景

Provider Profile 需要在单实例中长期复用，但上游任务会持久化 `request_json`，stage spec 和调试产物也会长期保留。把 API Key 复制进这些记录会让删除、轮换和导出任务数据变得不可靠。

## 决策

Provider Profile 表只保存非敏感配置和 `credential_ref`。真实凭据由实例数据目录下的 provider secret store 保存；API 响应、Provider Snapshot、Job 记录和 stage spec 都不返回或持久化原始凭据。Rust worker 启动时根据 `provider_profile_id` 读取凭据并注入进程环境。

## 后果

- 更新 Provider Profile 时，未提交新的 Key 就保留旧凭据。
- 删除 Profile 时同时删除对应 secret；历史 Job 仍可查看，但不能直接重跑。
- 旧版直接提交 `translation.api_key` 的 API 路径保持兼容，但新 UI 只使用 Profile。
- secret store 是实例备份和迁移时必须一并保护的状态。

## 替代方案

- 在 SQLite 或 Job JSON 中保存明文 Key：实现更少，但会扩大凭据暴露面。
- 强制所有凭据只来自预设环境变量：更简单，但无法满足 UI 中创建多个可复用 Provider Profile 的目标。
