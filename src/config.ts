import { Schema } from 'koishi'

export const name = 'chatluna-llm-web-search'
export const inject = ['chatluna', 'http']

export interface Config {
    webModelService: {
        model: string
        fallbackModel: string
    }
    xModelService: {
        model: string
        fallbackModel: string
    }
    webSearchTool: ToolConfig
    webReadTool: ToolConfig
    xSearchTool: ToolConfig
    xReadTool: ToolConfig
    grokBuiltinTools: {
        enable: boolean
        imageUnderstanding: boolean
        webSearchWithXSearch: boolean
        xVideoUnderstanding: boolean
        xReadImageUnderstanding: boolean
    }
    jinaReader: {
        apiKey: string
        timeoutSeconds: number
    }
    imageService: {
        enable: boolean
        model: string
        prompt: string
        maxImages: number
        taskConcurrency: number
        requestTimeoutSeconds: number
    }
    debug: boolean
}

export interface ToolConfig {
    enable: boolean
    name: string
    description: string
    prompt: string
}

const DEFAULT_WEB_SEARCH_PROMPT = `你是一个搜索引擎 Agent。针对用户的问题进行网页搜索，以简体中文 Markdown 格式给出详尽的回答。
要求：
- 引用来源时附上原始 URL
- 保留关键数据、引用和图片 URL
- 图片 URL 使用纯 URL 输出，不要使用 Markdown 链接或图片语法，不要描述图片内容
- 不要寒暄或提出后续建议——你的输出将直接作为另一个 AI Agent 的参考信息`

const DEFAULT_WEB_READ_PROMPT = `你是一个网页读取 Agent。将用户给出的 URL 内容整理为简体中文 Markdown。
要求：
- 只处理用户提供的 URL，不要自行搜索其他内容
- 保留页面标题、正文要点、重要引用、图片 URL
- 图片 URL 使用纯 URL 输出，不要使用 Markdown 链接或图片语法，不要描述图片内容
- 不要寒暄或提出后续建议——你的输出将直接作为另一个 AI Agent 的参考信息`

const DEFAULT_X_SEARCH_PROMPT = `你是一个 X/Twitter 搜索 Agent。针对用户的问题在 X 平台进行搜索，以简体中文 Markdown 格式给出详尽的回答。
要求：
- 包含帖子 URL、帖子正文、互动数据
- 图片 URL 使用纯 URL 输出，不要使用 Markdown 链接或图片语法，不要描述图片内容
- 不要寒暄或提出后续建议——你的输出将直接作为另一个 AI Agent 的参考信息`

const DEFAULT_X_READ_PROMPT = `你是一个 X/Twitter 读取 Agent。将用户给出的 X URL 内容整理为简体中文 Markdown。
要求：
- 只处理用户提供的 URL，不要自行搜索其他内容
- 包含帖子 URL、帖子正文、图片 URL、热门评论、互动数据
- 图片 URL 使用纯 URL 输出，不要使用 Markdown 链接或图片语法，不要描述图片内容
- 不要寒暄或提出后续建议——你的输出将直接作为另一个 AI Agent 的参考信息`

const DEFAULT_IMAGE_PROMPT = `你是一个图片描述工具。根据提供的图片生成 100-300 字中文描述。
重点：画面主体、场景、文字内容、图表数据、人物动作，以及与搜索/读取上下文相关的信息。
不要输出无关内容。`

export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
        webModelService: Schema.object({
            model: Schema.dynamic('model')
                .default('无')
                .description('Web Search 使用的首选 ChatLuna 模型'),
            fallbackModel: Schema.dynamic('model')
                .default('无')
                .description('首选模型失败后重试使用的备选模型')
        }).description('Web 搜索模型配置')
    }),
    Schema.object({
        xModelService: Schema.object({
            model: Schema.dynamic('model')
                .default('无')
                .description('X Search / X Read 使用的首选 Grok 模型'),
            fallbackModel: Schema.dynamic('model')
                .default('无')
                .description('首选模型失败后重试使用的备选 Grok 模型')
        }).description('X 搜索/读取模型配置')
    }),
    Schema.object({
        webSearchTool: Schema.object({
            enable: Schema.boolean()
                .default(false)
                .description('是否注册 Web Search 工具'),
            name: Schema.string()
                .default('web_search')
                .description('工具名称'),
            description: Schema.string()
                .default('调用 AI 搜索能力。')
                .description('工具描述'),
            prompt: Schema.string()
                .role('textarea')
                .default(DEFAULT_WEB_SEARCH_PROMPT)
                .description('Web Search 系统提示')
        }).description('Web Search')
    }),
    Schema.object({
        webReadTool: Schema.object({
            enable: Schema.boolean()
                .default(false)
                .description('是否注册 Web Read 工具'),
            name: Schema.string().default('web_read').description('工具名称'),
            description: Schema.string()
                .default('读取链接，并返回对应的 Markdown 版本。')
                .description('工具描述'),
            prompt: Schema.string()
                .role('textarea')
                .default(DEFAULT_WEB_READ_PROMPT)
                .description('Web Read 系统提示')
        }).description('Web Read')
    }),
    Schema.object({
        xSearchTool: Schema.object({
            enable: Schema.boolean()
                .default(false)
                .description('是否注册 X Search 工具'),
            name: Schema.string().default('x_search').description('工具名称'),
            description: Schema.string()
                .default('调用由 AI 支持的 X 平台搜索能力。')
                .description('工具描述'),
            prompt: Schema.string()
                .role('textarea')
                .default(DEFAULT_X_SEARCH_PROMPT)
                .description('X Search 系统提示')
        }).description('X Search')
    }),
    Schema.object({
        xReadTool: Schema.object({
            enable: Schema.boolean()
                .default(false)
                .description('是否注册 X Read 工具'),
            name: Schema.string().default('x_read').description('工具名称'),
            description: Schema.string()
                .default('读取 X 平台帖子链接，并返回对应的 Markdown 版本。')
                .description('工具描述'),
            prompt: Schema.string()
                .role('textarea')
                .default(DEFAULT_X_READ_PROMPT)
                .description('X Read 系统提示')
        }).description('X Read')
    }),
    Schema.object({
        grokBuiltinTools: Schema.object({
            enable: Schema.boolean()
                .default(false)
                .description('是否为 Grok 模型启用下列内置工具'),
            imageUnderstanding: Schema.boolean()
                .default(true)
                .description('是否允许 Grok 查看搜索/读取结果中的图片（虽然 Grok 在 API 中的图像识别能力较差，但对于它的搜索过程我们无法干预，开启后可能在一定程度上会提高它对于搜索结果的总结质量）'),
            webSearchWithXSearch: Schema.boolean()
                .default(true)
                .description('是否允许 Grok 在 Web Search 时进行 X Search（丰富搜索结果）'),
            xVideoUnderstanding: Schema.boolean()
                .default(false)
                .description('是否允许 Grok 查看搜索/读取结果中的视频（仅限 X 平台，使用官方 API 时，可能会消耗更多 token）'),
            xReadImageUnderstanding: Schema.boolean()
                .default(false)
                .description('是否允许 Grok 在 X Read 中查看图片（不建议开启，Grok 在 API 中的图像识别能力较差，会降低返回质量。建议在本插件中配置图像描述服务代替此选项。）')
        }).description('Grok 内置工具配置')
    }),
    Schema.object({
        jinaReader: Schema.object({
            apiKey: Schema.string()
                .role('secret')
                .default('')
                .description('Jina Reader API Key，可选。遇到速率限制时可填写'),
            timeoutSeconds: Schema.number()
                .min(5)
                .max(120)
                .default(60)
                .description('Jina 请求超时（秒）')
        }).description('Jina Reader 配置')
    }),
    Schema.object({
        imageService: Schema.object({
            enable: Schema.boolean()
                .default(false)
                .description('是否为搜索/读取结果中的图片 URL 生成描述'),
            model: Schema.dynamic('model')
                .default('无')
                .description('用于图片描述的多模态模型'),
            prompt: Schema.string()
                .role('textarea')
                .default(DEFAULT_IMAGE_PROMPT)
                .description('图片描述提示词'),
            maxImages: Schema.number()
                .min(1)
                .max(20)
                .default(10)
                .description('每次工具调用最多描述的图片数'),
            taskConcurrency: Schema.number()
                .min(1)
                .max(20)
                .default(3)
                .description('图片描述并发数'),
            requestTimeoutSeconds: Schema.number()
                .min(1)
                .max(120)
                .default(20)
                .description('图片下载超时（秒）')
        }).description('图片描述服务')
    }),
    Schema.object({
        debug: Schema.boolean().default(false).description('输出调试日志')
    })
])

export const usage = `## chatluna-llm-web-search
为 ChatLuna 提供 Web Search、Web Read、X Search、X Read 工具，请在使用时尽量关闭其他插件或 MCP、Skills 提供的搜索、网页读取工具。

### GPT

**最适合非网络热梗的正经搜索**

如果需要使用 GPT 模型作为搜索服务使用的模型，需要：
1. 安装 \`chatluna-openai-adapter\`
2. 完成 API URL、API Key 配置
3. 在“模型配置”中启用 \`responsesApi\`
4. 在“模型配置”中将 \`maxContextRatio\` 拉满
5. 使用来自 OpenAI 适配器且 ID 以 \`gpt-\` 开头的模型。本插件会自动为 Web Search 附加 \`web_search\`，无需在 OpenAI 适配器的“其他设置”中启用 \`web_search\` 或维护 \`responseBuiltinToolSupportModel\`。

### Gemini

**效果一般，只适合搜索最新的新闻，或是当做备用/无奈之选，并且该模型无法给出引用的 URL。就算将 API 返回的引用 URL 拼接到上下文中，也只能自行打开需要跳转一次的追踪链接。**

如果需要使用 Gemini 模型作为搜索服务使用的模型，需要：
1. 安装 \`chatluna-google-gemini-adapter\`
2. 完成 API URL、API Key 配置
3. 在“模型配置”中启用 \`googleSearch\` 和 \`urlContext\`
4. 在“模型配置”中将 \`maxContextRatio\` 拉满
5. 由于 Gemini API 不完全支持在开启内置工具的情况下使用自定义工具，请为其他插件创建独立的 \`chatluna-google-gemini-adapter\` 配置（可点击配置界面右上角的“克隆配置”，并在新的配置中关闭 \`googleSearch\` 和 \`urlContext\`）。

### Grok

**大部分情况下的最佳首选模型，适合处理网络热梗，且可以获取 X 平台信息，搜索效果又快又好，但在处理复杂请求时表现弱于 GPT**

如果需要使用 Grok 模型作为搜索服务使用的模型，需要：
1. 安装 \`chatluna-openai-like-adapter\`
2. 完成 API URL、API Key 配置
3. 在“模型配置”中启用 \`responsesApi\`
4. 在“模型配置”中将 \`maxContextRatio\` 拉满
5. 使用 ID 以 \`grok-\` 开头的模型，并在本插件的“Grok 内置工具配置”中启用相关的 Grok 内置工具（使用官方 API 时）。

使用逆向服务（如 [**chenyme/grok2api**](https://github.com/chenyme/grok2api)）时，建议关闭本插件的“Grok 内置工具配置”中的 \`grokBuiltinTools\` 选项，相关项目默认会自行提供等价的功能。

### X Search/Read
仅支持 Grok 模型。

### Jina Reader
Jina Reader 只用于 Web Read 的网页读取。默认无需 API Key 即可使用，但如果你遇到速率限制，仍需前往 [**官网**](https://jina.ai/reader) 获取 API Key 并在本插件中配置。

### 图片描述
开启“图片描述服务”后，会自动处理搜索/读取结果中出现的图片 URL，调用所选 ChatLuna 多模态模型生成描述，并将原文中的图片 URL 替换为带描述的 Markdown 链接。

如果未开启“图片描述服务”，则搜索/读取结果中不会包含图片的文本描述信息，只有 URL。`
