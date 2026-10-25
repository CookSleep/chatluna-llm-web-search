<div align="center">

# ChatLuna LLM Web Search

[![npm](https://img.shields.io/npm/v/koishi-plugin-chatluna-llm-web-search?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-chatluna-llm-web-search)
[![License](https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square)](LICENSE)

**用模型自带的联网搜索给 ChatLuna 当搜索引擎**

为 [ChatLuna](https://github.com/ChatLunaLab/chatluna) 提供 Web Search、Web Read、X Search 与 X Read 四个工具。<br>
搜索交给 GPT、Gemini、Grok 的内置搜索，网页读取交给 [Jina Reader](https://jina.ai/reader)，结果中的图片还能自动配上文字描述。

</div>

---

## ✨ 功能

### 🔎 Web Search
- **模型内置搜索**：把问题交给你选定的 ChatLuna 模型，由它的内置搜索完成检索，返回带来源 URL 的 Markdown。
- **GPT 自动附加搜索工具**：模型名以 `gpt-` 开头时，为本次调用附加 Responses API 的 `web_search` 工具，不用在适配器中另行开启。
- **首选与备选**：首选模型加载或调用失败时，自动换备选模型重试。

### 📖 Web Read
- **Jina Reader**：读取网页 URL，返回 Markdown。默认超时 60 秒；遇到速率限制时可以填写 API Key。

### 🐦 X Search / X Read
- **搜索与读取 X**：用 Grok 模型搜索 X 平台，或读取指定帖子，返回帖子链接、正文、互动数据等。
- **只用 Grok**：首选与备选模型的 ID 都必须包含 `grok`，否则直接报错。
- **Grok 内置工具**：使用官方 API 时，可为 Grok 开启内置的 `web_search` / `x_search`，并分别控制图片理解、视频理解，以及 Web Search 时是否同时搜索 X。

### 🖼️ 图片描述
- **自动描述**：从搜索、读取结果中找出图片 URL，调用多模态模型生成描述，把原文中的 URL 替换为 `[描述](图片 URL)`。
- **识别范围**：常见图片后缀（png、jpg、webp、gif）、`pbs.twimg.com/media` 以及带 `?format=jpg` 等参数的链接。
- **数量与并发**：每次调用默认最多描述 10 张，并发 3。

---

## ✅ 前置条件

- Koishi，以及已安装的 [ChatLuna](https://github.com/ChatLunaLab/chatluna)（`koishi-plugin-chatluna` 1.3.36 及以上），需要 `http` 服务。
- 至少一个支持内置搜索的模型，按所选模型配置对应的适配器：

**GPT**
1. 安装 `chatluna-openai-adapter` 或 `chatluna-openai-like-adapter`，填好 API URL 与 API Key。
2. 在「模型配置」中启用 `responsesApi`，并把 `maxContextRatio` 拉满。
3. 使用 ID 以 `gpt-` 开头的模型。插件会自动附加 `web_search`，不用在适配器的「其他设置」中启用 `web_search` 或维护 `responseBuiltinToolSupportModel`。

**Gemini**
1. 安装 `chatluna-google-gemini-adapter`，填好 API URL 与 API Key。
2. 在「模型配置」中启用 `googleSearch` 和 `urlContext`，并把 `maxContextRatio` 拉满。
3. Gemini API 不完全支持在开启内置工具时使用自定义工具，请为其他插件另建一份 `chatluna-google-gemini-adapter` 配置（点击配置界面右上角的「克隆配置」，在新配置中关闭 `googleSearch` 和 `urlContext`）。

**Grok**
1. 安装 `chatluna-openai-like-adapter`，填好 API URL 与 API Key。
2. 在「模型配置」中启用 `responsesApi`，并把 `maxContextRatio` 拉满。
3. 使用 ID 包含 `grok` 的模型。使用官方 API 时，在本插件的「Grok 内置工具配置」中启用内置工具；使用逆向服务（如 [chenyme/grok2api](https://github.com/chenyme/grok2api)）时建议关闭，这类服务通常自带等价功能。

- 使用图片描述时，需要一个支持图片输入的模型。
- 建议关闭其他插件、MCP 或 Skills 提供的搜索与网页读取工具，避免模型选错工具。

## 📦 安装

在 Koishi 控制台的插件市场中搜索 `chatluna-llm-web-search` 安装，或在 Koishi 项目目录中运行：

```bash
npm install koishi-plugin-chatluna-llm-web-search
```

## 🧭 怎么选模型

- **Grok**：大多数情况下的首选，搜索快、效果好，擅长网络热梗与 X 平台信息；复杂请求上弱于 GPT。
- **GPT**：适合非网络热梗的严肃搜索，复杂问题更稳定。
- **Gemini**：只适合搜最新新闻或作为备选。它给不出可直接打开的引用 URL，返回的引用都是需要跳转一次的追踪链接。

## ⚙️ 配置

四个工具默认都不注册，需要在配置中逐个开启。

| 分组 | 说明 |
| --- | --- |
| `webModelService` | Web Search 的首选与备选模型。 |
| `xModelService` | X Search / X Read 的首选与备选 Grok 模型。 |
| `webSearchTool` | 开关、工具名（默认 `web_search`）、工具描述、系统提示。 |
| `webReadTool` | 开关、工具名（默认 `web_read`）、工具描述。 |
| `xSearchTool` | 开关、工具名（默认 `x_search`）、工具描述、系统提示。 |
| `xReadTool` | 开关、工具名（默认 `x_read`）、工具描述、系统提示。 |
| `grokBuiltinTools` | 是否为 Grok 启用内置工具（默认关闭），以及图片理解、Web Search 时附加 X Search、X 视频理解、X Read 图片理解四个选项。 |
| `jinaReader` | Jina Reader 的 API Key（可选）与超时。 |
| `imageService` | 图片描述开关（默认关闭）、多模态模型、提示词、每次最多描述的图片数、并发数、图片下载超时。 |
| `debug` | 输出调试日志。 |

## ⚠️ 使用声明

- 本插件依赖模型与上游搜索工具返回的结果，信息的准确性、时效性和完整性由上游服务决定。
- X 平台内容的搜索与读取依赖 Grok 或兼容服务，请自行遵守相关平台规则。
- 使用者需自行确保符合当地法律法规与平台规则。

## 📄 许可

本项目基于 [GPL-3.0](LICENSE) 开源。

## 🙏 致谢

- [ChatLuna](https://github.com/ChatLunaLab/chatluna)：插件所扩展的 Koishi 大模型对话框架，模型调用都通过它完成。
- [Koishi](https://koishi.chat/)：机器人框架。
- [Jina Reader](https://jina.ai/reader)：Web Read 所用的网页转 Markdown 服务。
