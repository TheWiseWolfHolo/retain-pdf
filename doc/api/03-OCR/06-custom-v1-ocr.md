# 自定义 `/v1/ocr`

`custom_ocr` 用于连接 Mistral OCR 或 LiteLLM OCR 兼容服务。它适合 Windows 桌面端直接上传 PDF。

## 设置

在“设置 -> API 设置 -> OCR”中选择“自定义 OCR”，填写：

- Base URL：服务根地址、以 `/v1` 结尾的地址，或完整 `/v1/ocr` 地址。
- OCR API Key：作为 Bearer Token 发送。
- OCR 模型：例如 `mistral-ocr-latest`。

## 请求契约

```http
POST {base_url}/v1/ocr
Authorization: Bearer <api-key>
Content-Type: multipart/form-data
```

multipart 字段：

- `model`：设置中填写的模型。
- `file`：当前 PDF，MIME 为 `application/pdf`。

如果 Base URL 已经以 `/v1` 或 `/v1/ocr` 结尾，RetainPDF 不会重复追加版本路径。

## 响应契约

最低要求：

```json
{
  "pages": [
    {
      "index": 0,
      "markdown": "# Title\n\nBody",
      "dimensions": {
        "width": 1000,
        "height": 1400
      }
    }
  ]
}
```

`index` 和 `dimensions` 可以省略；`pages` 必须是数组。RetainPDF 保存完整原始响应，然后把每页 Markdown 转成一个整页文本块，进入 `document.v1` 标准化链。

首版不支持 URL 输入，只支持本地上传 PDF。

兼容契约参考：

- [LiteLLM OCR](https://docs.litellm.ai/docs/ocr)
- [Mistral OCR API](https://docs.mistral.ai/api/endpoint/ocr)
