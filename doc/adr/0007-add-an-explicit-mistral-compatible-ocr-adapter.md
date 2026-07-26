# 0007 增加显式的 Mistral 兼容 OCR Adapter

## 背景

现有远程 OCR Provider 使用各自的提交、轮询和产物协议。Mistral OCR 以及 LiteLLM 的兼容代理提供同步 `POST /v1/ocr` 接口，输入是 PDF，输出是 `pages[].markdown`。通过 `remote_command` wrapper 可以间接接入，但 Windows 桌面用户需要在设置中直接填写服务地址、API Key 和模型。

## 决策

增加显式的 `custom_ocr` Provider，只实现 Mistral/LiteLLM 兼容契约：

- `POST {base_url}/v1/ocr`
- Bearer API Key
- multipart `model` 与 `file`
- 读取 `pages[].index`、`pages[].markdown` 和可选 `pages[].dimensions`

Provider 保存原始响应，并把每页 Markdown 映射为 `generic_flat_ocr` 的整页文本块，再进入既有 `document.v1` 标准化、翻译和渲染链。首版只接受本地上传 PDF，不增加任意请求模板或自动协议探测。

## 后果

- Windows 设置界面可以显式选择自定义 OCR，并填写 Base URL、API Key 和模型。
- Base URL 可填写服务根地址、`/v1` 地址或完整 `/v1/ocr` 地址。
- 没有通用坐标的 Markdown 使用整页 bbox；原始响应仍保留，后续可在 Provider 返回坐标时升级映射。
- 其他 OCR HTTP 协议仍通过专用 Adapter 或 command Provider 接入。

## 替代方案

- 使用 `remote_command` wrapper：无需修改 Rust，但 Windows 用户需要额外维护脚本和运行时配置。
- 任意 OCR 请求模板 DSL：覆盖面更广，但会同时引入 multipart 模板、响应表达式和能力协商，超过当前需求。
