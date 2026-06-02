import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { StructuredTool } from '@langchain/core/tools'
import { Context } from 'koishi'
import { ModelCapabilities } from 'koishi-plugin-chatluna/llm-core/platform/types'
import { createLogger } from 'koishi-plugin-chatluna/utils/logger'
import { modelSchema } from 'koishi-plugin-chatluna/utils/schema'
import {
    getImageType,
    getMessageContent
} from 'koishi-plugin-chatluna/utils/string'
import { z } from 'zod'
import { name, type Config, type ToolConfig } from './config'

export { Config, inject, name, usage } from './config'

const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const urlCandidateRegex = /https?:\/\/[^\s<>\]"')]+/gi

const webSearchSchema = z.object({
    query: z.string().describe('需要搜索的关键词或问题。')
})

const webReadSchema = z.object({
    url: z.string().url().describe('需要读取的网页 URL。')
})

const xSearchSchema = z.object({
    query: z.string().describe('需要在 X/Twitter 中搜索的关键词或问题。')
})

const xReadSchema = z.object({
    url: z
        .string()
        .describe('需要读取的 X/Twitter URL，通常是推文、用户主页或搜索结果链接。')
})

type Deps = {
    ctx: Context
    cfg: Config
    action: 'web_search' | 'web_read' | 'x_search' | 'x_read'
    tool: ToolConfig
    ensureModelRef: (target?: string) => Promise<ModelRef | undefined>
    ensureImageModelRef: () => Promise<ModelRef | undefined>
}

type ModelRef = {
    value?: any
}

function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeUrlCandidate(value: string) {
    return value.replace(/[),.;!?]+$/, '')
}

function isLikelyImageUrl(value: string) {
    if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(value)) {
        return true
    }

    try {
        const url = new URL(value)
        const host = url.hostname.toLowerCase()
        const path = url.pathname || ''
        if (host === 'pbs.twimg.com' && path.startsWith('/media/')) {
            return true
        }
        const format = (url.searchParams.get('format') || '').toLowerCase()
        return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(format)
    } catch {
        return false
    }
}

function normalizeMarkdownLabel(value: string) {
    return value.replace(/[\r\n]+/g, ' ').replace(/[\[\]]/g, '').trim() || '图像'
}

function replaceImageUrlWithDescription(text: string, rawUrl: string, desc: string) {
    const label = normalizeMarkdownLabel(desc)
    const replacement = `[${label}](${rawUrl})`
    const pattern = escapeRegExp(rawUrl)

    let result = text
    result = result.replace(new RegExp(`\\[!\\[[^\\]]*\\]\\(${pattern}\\)\\]\\([^\\)]+\\)`, 'g'), replacement)
    result = result.replace(new RegExp(`!\\[[^\\]]*\\]\\(${pattern}\\)`, 'g'), replacement)
    result = result.replace(new RegExp(`\\[\\[[^\\]]*\\]\\]\\(${pattern}\\)`, 'g'), replacement)
    result = result.replace(new RegExp(`\\[[^\\]]*\\]\\(${pattern}\\)`, 'g'), replacement)
    result = result.replace(new RegExp(pattern, 'g'), (match, offset, source) => {
        const before = source.slice(0, offset)
        const after = source.slice(offset + match.length)
        const lastLinkOpen = before.lastIndexOf('](')
        const lastCloseParen = before.lastIndexOf(')')

        if (lastLinkOpen !== -1 && lastLinkOpen > lastCloseParen && after.trimStart().startsWith(')')) {
            return match
        }

        return replacement
    })

    return result
}

function getModelIdentity(configuredModel: string, chatModel: any) {
    const slashIndex = configuredModel.indexOf('/')
    const platform = slashIndex >= 0 ? configuredModel.slice(0, slashIndex) : ''
    const configuredName = slashIndex >= 0
        ? configuredModel.slice(slashIndex + 1)
        : configuredModel
    const modelName = String(chatModel?.modelName || configuredName || '')

    return {
        platform: platform.toLowerCase(),
        modelName,
        lowerModelName: modelName.toLowerCase()
    }
}

function getConfiguredModelName(configuredModel: string) {
    const slashIndex = configuredModel.indexOf('/')
    return slashIndex >= 0 ? configuredModel.slice(slashIndex + 1) : configuredModel
}

function isUsableModel(model: string) {
    return Boolean(model && model !== '无')
}

function isGrokModel(model: string) {
    return getConfiguredModelName(model).toLowerCase().startsWith('grok-')
}

function getModelCandidates(model: { model: string; fallbackModel?: string }) {
    return [model.model, model.fallbackModel]
        .filter((item): item is string => isUsableModel(item || ''))
        .filter((item, index, array) => array.indexOf(item) === index)
}

function validateXModelCandidates(candidates: string[]) {
    if (!candidates.length) {
        throw new Error('未配置 X Search / X Read 使用的 Grok 模型。')
    }

    const invalid = candidates.find((model) => !isGrokModel(model))
    if (invalid) {
        throw new Error(`X Search / X Read 只支持 ID 以 grok- 开头的模型：${invalid}`)
    }
}

let logger: ReturnType<typeof createLogger>

export function apply(ctx: Context, cfg: Config) {
    logger = createLogger(ctx, name)
    const webModelRefs = new Map<string, ModelRef>()
    const xModelRefs = new Map<string, ModelRef>()
    let imageModelRef: ModelRef | undefined
    let imageModelName = ''

    async function ensureWebModelRef(target = cfg.webModelService.model) {
        if (!target || target === '无') return undefined

        const cached = webModelRefs.get(target)
        if (cached) {
            return cached
        }

        try {
            const ref = await ctx.chatluna.createChatModel(target)
            webModelRefs.set(target, ref)
            return ref
        } catch (err) {
            logger.warn('加载 Web 搜索/读取模型失败: %s', err?.message || String(err))
            return undefined
        }
    }

    async function ensureXModelRef(target = cfg.xModelService.model) {
        if (!target || target === '无') return undefined

        const cached = xModelRefs.get(target)
        if (cached) {
            return cached
        }

        try {
            const ref = await ctx.chatluna.createChatModel(target)
            xModelRefs.set(target, ref)
            return ref
        } catch (err) {
            logger.warn('加载 X 搜索/读取模型失败: %s', err?.message || String(err))
            return undefined
        }
    }

    async function ensureImageModelRef() {
        const target = cfg.imageService.model
        if (!target || target === '无') return undefined

        if (imageModelRef && imageModelName === target) {
            return imageModelRef
        }

        try {
            imageModelRef = await ctx.chatluna.createChatModel(target)
            imageModelName = target
            return imageModelRef
        } catch (err) {
            logger.warn('加载图片描述模型失败: %s', err?.message || String(err))
            return undefined
        }
    }

    ctx.on('ready', async () => {
        modelSchema(ctx)
        for (const model of getModelCandidates(cfg.webModelService)) {
            await ensureWebModelRef(model)
        }
        for (const model of getModelCandidates(cfg.xModelService)) {
            await ensureXModelRef(model)
        }
        await ensureImageModelRef()

        if (cfg.webSearchTool.enable) {
            const tool = new WebSearchTool({
                ctx,
                cfg,
                action: 'web_search',
                tool: cfg.webSearchTool,
                ensureModelRef: ensureWebModelRef,
                ensureImageModelRef
            })
            ctx.effect(() =>
                ctx.chatluna.platform.registerTool(tool.name, {
                    description: tool.description,
                    selector() {
                        return true
                    },
                    createTool() {
                        return new WebSearchTool({
                            ctx,
                            cfg,
                            action: 'web_search',
                            tool: cfg.webSearchTool,
                            ensureModelRef: ensureWebModelRef,
                            ensureImageModelRef
                        })
                    },
                    meta: meta('web-search')
                })
            )
        }

        if (cfg.webReadTool.enable) {
            const tool = new WebReadTool({
                ctx,
                cfg,
                action: 'web_read',
                tool: cfg.webReadTool,
                ensureModelRef: ensureWebModelRef,
                ensureImageModelRef
            })
            ctx.effect(() =>
                ctx.chatluna.platform.registerTool(tool.name, {
                    description: tool.description,
                    selector() {
                        return true
                    },
                    createTool() {
                        return new WebReadTool({
                            ctx,
                            cfg,
                            action: 'web_read',
                            tool: cfg.webReadTool,
                            ensureModelRef: ensureWebModelRef,
                            ensureImageModelRef
                        })
                    },
                    meta: meta('web-search')
                })
            )
        }

        if (cfg.xSearchTool.enable) {
            const tool = new XSearchTool({
                ctx,
                cfg,
                action: 'x_search',
                tool: cfg.xSearchTool,
                ensureModelRef: ensureXModelRef,
                ensureImageModelRef
            })
            ctx.effect(() =>
                ctx.chatluna.platform.registerTool(tool.name, {
                    description: tool.description,
                    selector() {
                        return true
                    },
                    createTool() {
                        return new XSearchTool({
                            ctx,
                            cfg,
                            action: 'x_search',
                            tool: cfg.xSearchTool,
                            ensureModelRef: ensureXModelRef,
                            ensureImageModelRef
                        })
                    },
                    meta: meta('web-search')
                })
            )
        }

        if (cfg.xReadTool.enable) {
            const tool = new XReadTool({
                ctx,
                cfg,
                action: 'x_read',
                tool: cfg.xReadTool,
                ensureModelRef: ensureXModelRef,
                ensureImageModelRef
            })
            ctx.effect(() =>
                ctx.chatluna.platform.registerTool(tool.name, {
                    description: tool.description,
                    selector() {
                        return true
                    },
                    createTool() {
                        return new XReadTool({
                            ctx,
                            cfg,
                            action: 'x_read',
                            tool: cfg.xReadTool,
                            ensureModelRef: ensureXModelRef,
                            ensureImageModelRef
                        })
                    },
                    meta: meta('web-search')
                })
            )
        }
    })
}

function meta(group: string) {
    return {
        source: 'extension',
        group,
        tags: ['web-search', 'web-read', 'x-search', 'x-read'],
        defaultAvailability: {
            enabled: true,
            main: true,
            chatluna: true,
            characterScope: 'all' as const
        }
    }
}

class WebSearchTool extends StructuredTool {
    name: string
    description: string
    schema = webSearchSchema

    constructor(private deps: Deps) {
        super({})
        this.name = deps.tool.name.trim() || 'web_search'
        this.description = deps.tool.description.trim()
    }

    async _call(input: z.infer<typeof webSearchSchema>) {
        return run(this.deps, {
            query: input.query
        })
    }
}

class WebReadTool extends StructuredTool {
    name: string
    description: string
    schema = webReadSchema

    constructor(private deps: Deps) {
        super({})
        this.name = deps.tool.name.trim() || 'web_read'
        this.description = deps.tool.description.trim()
    }

    async _call(input: z.infer<typeof webReadSchema>) {
        return run(this.deps, {
            url: input.url
        })
    }
}

class XSearchTool extends StructuredTool {
    name: string
    description: string
    schema = xSearchSchema

    constructor(private deps: Deps) {
        super({})
        this.name = deps.tool.name.trim() || 'x_search'
        this.description = deps.tool.description.trim()
    }

    async _call(input: z.infer<typeof xSearchSchema>) {
        return run(this.deps, {
            query: input.query
        })
    }
}

class XReadTool extends StructuredTool {
    name: string
    description: string
    schema = xReadSchema

    constructor(private deps: Deps) {
        super({})
        this.name = deps.tool.name.trim() || 'x_read'
        this.description = deps.tool.description.trim()
    }

    async _call(input: z.infer<typeof xReadSchema>) {
        return run(this.deps, {
            url: input.url
        })
    }
}

async function run(
    deps: Deps,
    input: { query?: string; url?: string }
) {
    try {
        if (deps.action.startsWith('x_')) {
            validateXModelCandidates(getModelCandidates(deps.cfg.xModelService))
        }

        if (deps.action === 'web_read' && input.url) {
            const read = await callJinaReader(deps, input.url)
            return await withImages(
                deps.ctx,
                deps.cfg,
                read,
                deps.ensureImageModelRef
            )
        }

        const result = await callModel(deps, input)
        return await withImages(deps.ctx, deps.cfg, result, deps.ensureImageModelRef)
    } catch (err) {
        if (deps.cfg.debug) {
            logger.warn(err)
        }
        return `${deps.action} failed: ${err?.message || String(err)}`
    }
}

async function callModel(
    deps: Deps,
    input: { query?: string; url?: string }
) {
    const model = deps.action.startsWith('x_')
        ? deps.cfg.xModelService
        : deps.cfg.webModelService
    const candidates = getModelCandidates(model)

    if (!candidates.length) {
        throw new Error('未配置搜索/读取模型。')
    }

    const parts: string[] = []
    if (input.query) parts.push(input.query)
    if (input.url) parts.push(input.url)

    let lastError: unknown
    for (const candidate of candidates) {
        try {
            const ref = await deps.ensureModelRef(candidate)
            if (!ref?.value) {
                throw new Error(`模型加载失败：${candidate}`)
            }

            const overrideRequestParams = buildOverrideRequestParams(
                deps,
                candidate,
                ref.value
            )
            const msg = await ref.value.invoke(
                [
                    new SystemMessage(deps.tool.prompt),
                    new HumanMessage(parts.join('\n'))
                ],
                {
                    overrideRequestParams
                } as never
            )
            return getMessageContent(msg.content).trim()
        } catch (err) {
            lastError = err
            if (candidate !== candidates[candidates.length - 1]) {
                logger.warn(
                    '搜索/读取模型 %s 调用失败，切换到备选模型: %s',
                    candidate,
                    err?.message || String(err)
                )
            }
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error(String(lastError || '搜索/读取模型调用失败。'))
}

function buildOverrideRequestParams(
    deps: Deps,
    configuredModel: string,
    chatModel: any
) {
    const { lowerModelName } = getModelIdentity(configuredModel, chatModel)
    const llmType = String(chatModel._llmType?.() || '').toLowerCase()
    const responseApi = chatModel._requester?._pluginConfig?.responseApi === true

    if (
        deps.action === 'web_search' &&
        llmType === 'openai' &&
        responseApi &&
        lowerModelName.startsWith('gpt-')
    ) {
        return {
            tools: [{ type: 'web_search' }]
        }
    }

    if (
        deps.cfg.grokBuiltinTools.enable &&
        llmType === 'openai' &&
        responseApi &&
        lowerModelName.startsWith('grok-')
    ) {
        return {
            tools: buildGrokTools(deps.cfg, deps.action)
        }
    }

    return undefined
}

function buildGrokTools(
    cfg: Config,
    action: 'web_search' | 'web_read' | 'x_search' | 'x_read'
) {
    if (action === 'web_search') {
        return [
            {
                type: 'web_search',
                enable_image_understanding:
                    cfg.grokBuiltinTools.imageUnderstanding
            },
            ...(cfg.grokBuiltinTools.webSearchWithXSearch
                ? [
                      {
                          type: 'x_search',
                          enable_image_understanding:
                              cfg.grokBuiltinTools.imageUnderstanding,
                          enable_video_understanding:
                              cfg.grokBuiltinTools.xVideoUnderstanding
                      }
                  ]
                : [])
        ]
    }

    if (action === 'web_read') {
        return [
            {
                type: 'web_search',
                enable_image_understanding:
                    cfg.grokBuiltinTools.imageUnderstanding
            }
        ]
    }

    if (action === 'x_search') {
        return [
            {
                type: 'x_search',
                enable_image_understanding:
                    cfg.grokBuiltinTools.imageUnderstanding,
                enable_video_understanding:
                    cfg.grokBuiltinTools.xVideoUnderstanding
            }
        ]
    }

    return [
        {
            type: 'x_search',
            enable_image_understanding:
                cfg.grokBuiltinTools.xReadImageUnderstanding,
            enable_video_understanding:
                cfg.grokBuiltinTools.xVideoUnderstanding
        }
    ]
}

async function callJinaReader(deps: Deps, url: string) {
    const headers: Record<string, string> = {
        'User-Agent': ua,
        Accept: 'text/plain'
    }
    if (deps.cfg.jinaReader.apiKey) {
        headers.Authorization = `Bearer ${deps.cfg.jinaReader.apiKey}`
    }

    return deps.ctx.http.get<string>(`https://r.jina.ai/${url}`, {
        timeout: deps.cfg.jinaReader.timeoutSeconds * 1000,
        responseType: 'text',
        headers
    })
}

async function withImages(
    ctx: Context,
    cfg: Config,
    text: string,
    ensureImageModelRef: () => Promise<ModelRef | undefined>
) {
    if (!cfg.imageService.enable) {
        return text
    }
    if (!cfg.imageService.model || cfg.imageService.model === '无') {
        return text
    }

    const urls = Array.from(
        new Set(
            Array.from(text.matchAll(urlCandidateRegex))
                .map((item) => normalizeUrlCandidate(item[0]))
                .filter(isLikelyImageUrl)
        )
    ).slice(0, cfg.imageService.maxImages)

    if (!urls.length) {
        return text
    }

    const ref = await ensureImageModelRef()
    if (!ref?.value) {
        return text
    }
    if (
        !Array.isArray(ref.value.modelInfo?.capabilities) ||
        !ref.value.modelInfo.capabilities.includes(ModelCapabilities.ImageInput)
    ) {
        return text
    }

    const descriptions: Record<string, string> = {}
    let idx = 0
    await Promise.all(
        Array.from(
            { length: Math.min(cfg.imageService.taskConcurrency, urls.length) },
            async () => {
                while (idx < urls.length) {
                    const url = urls[idx]
                    idx += 1
                    try {
                        const data = await ctx.http.get<ArrayBuffer>(url, {
                            responseType: 'arraybuffer',
                            timeout: cfg.imageService.requestTimeoutSeconds * 1000,
                            headers: {
                                'User-Agent': ua
                            }
                        })
                        const buf = Buffer.from(data)
                        const mime = getImageType(buf) || 'image/jpeg'
                        if (mime === 'image/gif') {
                            continue
                        }
                        const msg = await ref.value.invoke([
                            new HumanMessage({
                                content: [
                                    {
                                        type: 'text',
                                        text: cfg.imageService.prompt
                                    },
                                    {
                                        type: 'image_url',
                                        image_url: {
                                            url: `data:${mime};base64,${buf.toString('base64')}`
                                        }
                                    }
                                ]
                            })
                        ])
                        const desc = getMessageContent(msg.content).trim()
                        if (desc) {
                            descriptions[url] = desc
                        }
                    } catch {}
                }
            }
        )
    )

    if (!Object.keys(descriptions).length) {
        return text
    }

    let processed = text
    for (const [url, desc] of Object.entries(descriptions)) {
        processed = replaceImageUrlWithDescription(processed, url, desc)
    }

    return processed
}
