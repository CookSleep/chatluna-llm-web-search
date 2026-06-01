# ChatLuna LLM Web Search

![npm](https://img.shields.io/npm/v/koishi-plugin-chatluna-llm-web-search) ![License](https://img.shields.io/badge/license-GPLv3-brightgreen)

为 Koishi ChatLuna 提供基于 LLM 内置搜索能力的 **Web Search**、**Web Read**、**X Search** 与 **X Read** 工具，支持 GPT、Gemini、Grok 等模型组合使用，并可自动为搜索/读取结果中的图片 URL 生成描述。

## ✨ 功能特性

### 1. 🔎 Web Search
- 支持调用 ChatLuna 模型完成网页搜索任务。
- 使用 OpenAI 适配器的 `gpt-` 模型时，会自动为本次调用附加 OpenAI Responses API 的 `web_search` 工具。
- 支持配置首选模型与备选模型，首选模型加载或调用失败后会自动切换重试。

### 2. 📖 Web Read
- 使用 Jina Reader 读取网页 URL，并直接返回 Markdown 内容。
- Jina Reader 默认超时 60 秒，可配置 API Key 以缓解速率限制。
- 可配合图片描述服务，将返回内容中的图片 URL 替换为带描述的 Markdown 链接。

### 3. 🐦 X Search / X Read
- 支持通过 Grok 模型搜索或读取 X/Twitter 内容。
- X Search 与 X Read 仅允许使用 ID 以 `grok-` 开头的模型，首选模型与备选模型都会校验。
- 可配置 Grok 内置 `web_search` / `x_search` 工具能力，包括图片理解、视频理解和 Web Search 时附加 X Search。

### 4. 🖼️ 图片描述服务
- 支持从搜索/读取结果中提取图片 URL 并调用多模态模型生成描述。
- 支持普通图片后缀、`pbs.twimg.com/media` 与 `?format=jpg/png/webp/gif` 等图片 URL。
- 描述生成后会将原文中的图片 URL 替换为 `[图片描述](图片 URL)`，方便下游模型直接阅读。

## ⚙️ 主要配置

- `webModelService`：Web Search 使用的首选模型与备选模型。
- `xModelService`：X Search / X Read 使用的首选 Grok 模型与备选 Grok 模型。
- `webSearchTool`：Web Search 工具配置，默认工具名为 `web_search`。
- `webReadTool`：Web Read 工具配置，默认工具名为 `web_read`。
- `xSearchTool`：X Search 工具配置，默认工具名为 `x_search`。
- `xReadTool`：X Read 工具配置，默认工具名为 `x_read`。
- `grokBuiltinTools`：Grok 官方 API 内置工具配置。
- `jinaReader`：Jina Reader API Key 与请求超时配置。
- `imageService`：图片描述模型、提示词、最多处理图片数、并发与下载超时配置。

## ✅ 使用前置条件

根据你选择的搜索模型，请先完成对应适配器配置：

- GPT：安装 `chatluna-openai-adapter`，启用 `responsesApi`，并将 `maxContextRatio` 拉满。
- Gemini：安装 `chatluna-google-gemini-adapter`，启用 `googleSearch` 与 `urlContext`，并将 `maxContextRatio` 拉满。
- Grok：安装 `chatluna-openai-adapter`，启用 `responsesApi`，并使用 ID 以 `grok-` 开头的模型。

建议关闭其他插件、MCP 或 Skills 提供的搜索与网页读取工具，避免模型在工具选择时混淆。

## 🧭 模型建议

- Grok：大部分情况下的首选，适合网络热梗、X 平台信息与实时搜索。
- GPT：适合非网络热梗的严肃搜索，复杂问题表现通常更稳定。
- Gemini：适合作为最新新闻搜索的备用模型，但引用 URL 表现有限。

## 🛡️ 使用声明

- 本插件依赖模型与上游搜索工具返回结果，信息准确性、时效性和完整性由上游服务共同决定。
- X/Twitter 内容读取与搜索能力依赖 Grok 或对应兼容服务，请自行遵守相关平台规则。
- 使用者需自行确保符合当地法律法规与平台规则。

## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来改进代码。
