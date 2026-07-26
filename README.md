# RetainPDF：PDF 保留排版翻译工具

<p align="center">
  <img src="resources/brand/RetainPDF-github.svg" alt="RetainPDF" width="320" />
</p>


开源社区做保留排版的项目不少，但是都围绕可复制，可编辑的 PDF，以及行内公式不复杂的场景.

RetainPDF 从一开始就是要解决各类 PDF 的保留排版翻译问题，尤其是图片型/扫描版 PDF，以及行内公式的渲染问题.

在保留排版翻译这个领域，正面硬刚闭源模型,并且在一些场景下做得更好，比如翻译后的 PDF 体积、整体速度和字体大小控制。

此外本项目是前后端分离、OCR、翻译、排版与交付打通的全栈项目，整体结构尽量解耦，既能直接使用，也方便后续开发者继续扩展、替换模块和二次开发。

> 本仓库是基于上游 RetainPDF 持续同步的增强版。目前维护和发布 Windows 桌面版与 Docker 镜像。

## 本 Fork 增强

- 显式翻译 Provider Profile：支持 OpenAI Chat Completions、Anthropic Messages、Gemini Generate Content 和声明式自定义 JSON 请求格式。
- 每个翻译 Provider 可独立配置名称、Base URL、API Key、默认模型、目标语言与请求速率限制。
- 显式自定义 OCR：兼容 Mistral OCR / LiteLLM 的 `POST /v1/ocr` 请求格式。
- 自定义 OCR 可配置 Base URL、API Key 和模型；请求使用 Bearer Auth 与 multipart `model` + `file`。
- 保留上游原有 OCR、翻译、渲染、图书馆和任务系统，并把 Fork 差异集中在 Provider Adapter 边界。

相关设计和接口说明：

- [Provider 扩展设计](doc/core/provider-extensions.md)
- [自定义 /v1/ocr 使用说明](doc/api/03-OCR/06-custom-v1-ocr.md)


简单对比：

| 项目 | 扫描型 PDF | 复杂行内公式 | 代码不误翻 | 表格控制 | 自定义翻译策略 | 排版保留 | PDF 压缩优化 | API 自动化 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PDFMathTranslate | ❌ | ❌ | ❌ | 弱 | 弱 | 一般 | 一般 | ✅ |
| PolyglotPDF | ❌ | ❌ | ❌ | 弱 | 弱 | 一般 | 一般 | ✅ |
| Doc2X | ✅ | ✅ | ❌ | 中 | 弱 | 强 | 弱 | ❌ 不开放 |
| RetainPDF | ✅ | ✅ | ✅ | ✅ 可开关 | ✅ 可按规则配置 | 强 | ✅ 持续优化 | ✅ |

## 效果图

### SCI 论文

<p align="center">
  <img src="resources/brand/readme-gallery/image%201.png" alt="SCI 示例 1" width="860" />
</p>

<p align="center">
  <img src="resources/brand/readme-gallery/image%202.png" alt="SCI 示例 2" width="860" />
</p>

### 图片型 / 扫描版 PDF

<p align="center">
  <img src="resources/brand/readme-gallery/image%203.png" alt="扫描版示例 1" width="860" />
</p>

<p align="center">
  <img src="resources/brand/readme-gallery/image%207.png" alt="扫描版示例 2" width="860" />
</p>

### 图书类

<p align="center">
  <img src="resources/brand/readme-gallery/image%204.png" alt="图书示例 1" width="860" />
</p>

<p align="center">
  <img src="resources/brand/readme-gallery/image%205.png" alt="图书示例 2" width="860" />
</p>

<p align="center">
  <img src="resources/brand/readme-gallery/image%206.png" alt="图书示例 3" width="860" />
</p>

## 快速开始

Windows 桌面版请前往 [TheWiseWolfHolo/retain-pdf Releases](https://github.com/TheWiseWolfHolo/retain-pdf/releases/latest)，下载：

- `RetainPDF-Windows-<版本>-Setup.exe`

Docker 镜像发布到：

- `ghcr.io/thewisewolfholo/retainpdf-app:<版本>`
- `ghcr.io/thewisewolfholo/retainpdf-web:<版本>`

当前稳定增强版为 [v4.2.3](https://github.com/TheWiseWolfHolo/retain-pdf/releases/tag/v4.2.3)。

### Windows 桌面端

<p align="center">
  <img src="resources/brand/RetainPDF-desktop.png" alt="RetainPDF Windows 桌面端" width="860" />
</p>

首次使用时，在“设置 -> API 设置”中：

1. 选择并配置 OCR Provider。使用自定义接口时选择“自定义 OCR”，填写 Base URL、API Key 和模型。
2. 创建或选择翻译 Provider Profile。
3. 在“任务选项”中选择翻译模型、目标语言和请求速率限制。
4. 上传 PDF 并开始任务。

自定义 OCR 首版只接受本地上传 PDF。由于 `/v1/ocr` 的通用响应只提供每页 Markdown、不保证提供文本坐标，RetainPDF 会把每页 Markdown 映射为整页文本块后进入现有翻译和渲染链。

## 开发者


### 文档入口

建议按下面顺序阅读。

- [贡献指南](CONTRIBUTING.md)
- [文档目录](doc/README.md)
- [主线文档](doc/core/README.md)
- [参考资料](doc/reference/README.md)
- [运维与过程记录](doc/ops/README.md)
- [Pipeline 阶段契约](backend/scripts/runtime/pipeline/README.md)

### 代码与子模块说明

- [后端脚本说明](backend/scripts/README.md)
- `frontend/`：当前生产使用的前端，也是桌面端 bundle 的输入目录；index/reader/detail 三页均已迁移为 React SPA（`src/pages/` 是新世界入口，esbuild 打包，`src/js/` 保留纯逻辑核心）。
- `frontend-react/`：另一条 React 前端迁移区（独立技术栈：Vite + TypeScript），当前不直接替代 `frontend/`。
- `desktop/`：Electron 桌面端打包与运行壳。

### 当前目录结构

- `frontend/`
  当前生产使用的前端，三页 React SPA（esbuild 打包），源码见 `frontend/src/pages/`。
- `frontend-react/`
  另一条 React 前端迁移区（独立技术栈）。
- `desktop/`
  Electron 桌面端打包、运行壳和桌面端前端 bundle。
- `backend/`
  Rust API、Python 脚本、嵌入式 Python、历史工作区。
- `docker/`
  Dockerfile、发布脚本、交付用 compose 配置。
- `experiments/`
  独立实验、验证记录和临时 POC。
- `data/`
  本地运行输出、任务目录、历史样本数据。
- `resources/`
  仓库级品牌图、README 展示图、动画、示例文件和后续本地 runtime 归档入口。

### 当前开发状态

RetainPDF 目前已经形成完整产品链路：

- Rust API 负责上传、任务、图书馆、事件、产物、断点恢复和 Provider 调度。
- Python pipeline 负责 OCR 归一化、翻译、诊断、渲染和 PDF 处理。
- `frontend/` 是当前生产入口，已是三页 React SPA；`frontend-react/` 是另一条独立技术栈的迁移区。
- 本 Fork 当前只维护 Windows 桌面端发布包。
- API、数据库、artifact、reader、glossary 和 stage spec 已有主线文档维护。

当前开发优先级以主线契约为准，主要集中在：

- 前端图书馆、reader、任务进度和术语表体验。
- Rust API 的边界收口、数据库持久化和 artifact 管理。
- Python 翻译一致性、公式保护、渲染稳定性和诊断能力。
- Windows 桌面端、CI 和测试样本的可复现交付。
- 文档与真实 API / 配置 / 目录结构保持同步。

### 欢迎一起参与

如果你也对下面这些方向感兴趣，欢迎一起把这个项目继续往前做：

- 高精度 OCR / 疑难版面解析
- 长文块与公式场景下的翻译稳定性
- 排版回填、字体自适应与 PDF 渲染
- 桌面端、Docker 交付与工程化完善

不管你更擅长算法、前端、后端还是部署，只要你也想把“真正能用的 PDF 保留排版翻译”这件事做深，欢迎进来一起搞。

## License

This project is distributed under the MIT License. See [LICENSE](LICENSE) for the full text.
