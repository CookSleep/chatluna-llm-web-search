var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { StructuredTool } from "@langchain/core/tools";
import { ModelCapabilities } from "koishi-plugin-chatluna/llm-core/platform/types";
import { createLogger } from "koishi-plugin-chatluna/utils/logger";
import { modelSchema } from "koishi-plugin-chatluna/utils/schema";
import {
  getImageType,
  getMessageContent
} from "koishi-plugin-chatluna/utils/string";
import { z } from "zod";

// src/config.ts
import { Schema } from "koishi";
var name = "chatluna-llm-web-search";
var inject = ["chatluna", "http"];
var DEFAULT_WEB_SEARCH_PROMPT = `你是一个搜索引擎 Agent。针对用户的问题进行网页搜索，以简体中文 Markdown 格式给出详尽的回答。
要求：
- 引用来源时附上原始 URL
- 保留关键数据、引用和图片 URL
- 图片 URL 使用纯 URL 输出，不要使用 Markdown 链接或图片语法，不要描述图片内容
- 不要寒暄或提出后续建议——你的输出将直接作为另一个 AI Agent 的参考信息`;
var DEFAULT_WEB_READ_PROMPT = `你是一个网页读取 Agent。将用户给出的 URL 内容整理为简体中文 Markdown。
要求：
- 只处理用户提供的 URL，不要自行搜索其他内容
- 保留页面标题、正文要点、重要引用、图片 URL
- 图片 URL 使用纯 URL 输出，不要使用 Markdown 链接或图片语法，不要描述图片内容
- 不要寒暄或提出后续建议——你的输出将直接作为另一个 AI Agent 的参考信息`;
var DEFAULT_X_SEARCH_PROMPT = `你是一个 X/Twitter 搜索 Agent。针对用户的问题在 X 平台进行搜索，以简体中文 Markdown 格式给出详尽的回答。
要求：
- 包含帖子 URL、帖子正文、互动数据
- 图片 URL 使用纯 URL 输出，不要使用 Markdown 链接或图片语法，不要描述图片内容
- 不要寒暄或提出后续建议——你的输出将直接作为另一个 AI Agent 的参考信息`;
var DEFAULT_X_READ_PROMPT = `你是一个 X/Twitter 读取 Agent。将用户给出的 X URL 内容整理为简体中文 Markdown。
要求：
- 只处理用户提供的 URL，不要自行搜索其他内容
- 包含帖子 URL、帖子正文、图片 URL、热门评论、互动数据
- 图片 URL 使用纯 URL 输出，不要使用 Markdown 链接或图片语法，不要描述图片内容
- 不要寒暄或提出后续建议——你的输出将直接作为另一个 AI Agent 的参考信息`;
var DEFAULT_IMAGE_PROMPT = `你是一个图片描述工具。根据提供的图片生成 100-300 字中文描述。
重点：画面主体、场景、文字内容、图表数据、人物动作，以及与搜索/读取上下文相关的信息。
不要输出无关内容。`;
var Config = Schema.intersect([
  Schema.object({
    webModelService: Schema.object({
      model: Schema.dynamic("model").default("无").description("Web Search 使用的首选 ChatLuna 模型"),
      fallbackModel: Schema.dynamic("model").default("无").description("首选模型失败后重试使用的备选模型")
    }).description("Web 搜索模型配置")
  }),
  Schema.object({
    xModelService: Schema.object({
      model: Schema.dynamic("model").default("无").description("X Search / X Read 使用的首选 Grok 模型"),
      fallbackModel: Schema.dynamic("model").default("无").description("首选模型失败后重试使用的备选 Grok 模型")
    }).description("X 搜索/读取模型配置")
  }),
  Schema.object({
    webSearchTool: Schema.object({
      enable: Schema.boolean().default(false).description("是否注册 Web Search 工具"),
      name: Schema.string().default("web_search").description("工具名称"),
      description: Schema.string().default("调用 AI 搜索能力。").description("工具描述"),
      prompt: Schema.string().role("textarea").default(DEFAULT_WEB_SEARCH_PROMPT).description("Web Search 系统提示")
    }).description("Web Search")
  }),
  Schema.object({
    webReadTool: Schema.object({
      enable: Schema.boolean().default(false).description("是否注册 Web Read 工具"),
      name: Schema.string().default("web_read").description("工具名称"),
      description: Schema.string().default("读取链接，并返回对应的 Markdown 版本。").description("工具描述"),
      prompt: Schema.string().role("textarea").default(DEFAULT_WEB_READ_PROMPT).description("Web Read 系统提示")
    }).description("Web Read")
  }),
  Schema.object({
    xSearchTool: Schema.object({
      enable: Schema.boolean().default(false).description("是否注册 X Search 工具"),
      name: Schema.string().default("x_search").description("工具名称"),
      description: Schema.string().default("调用由 AI 支持的 X 平台搜索能力。").description("工具描述"),
      prompt: Schema.string().role("textarea").default(DEFAULT_X_SEARCH_PROMPT).description("X Search 系统提示")
    }).description("X Search")
  }),
  Schema.object({
    xReadTool: Schema.object({
      enable: Schema.boolean().default(false).description("是否注册 X Read 工具"),
      name: Schema.string().default("x_read").description("工具名称"),
      description: Schema.string().default("读取 X 平台帖子链接，并返回对应的 Markdown 版本。").description("工具描述"),
      prompt: Schema.string().role("textarea").default(DEFAULT_X_READ_PROMPT).description("X Read 系统提示")
    }).description("X Read")
  }),
  Schema.object({
    grokBuiltinTools: Schema.object({
      enable: Schema.boolean().default(false).description("是否为 Grok 模型启用下列内置工具"),
      imageUnderstanding: Schema.boolean().default(true).description("是否允许 Grok 查看搜索/读取结果中的图片（虽然 Grok 在 API 中的图像识别能力较差，但对于它的搜索过程我们无法干预，开启后可能在一定程度上会提高它对于搜索结果的总结质量）"),
      webSearchWithXSearch: Schema.boolean().default(true).description("是否允许 Grok 在 Web Search 时进行 X Search（丰富搜索结果）"),
      xVideoUnderstanding: Schema.boolean().default(false).description("是否允许 Grok 查看搜索/读取结果中的视频（仅限 X 平台，使用官方 API 时，可能会消耗更多 token）"),
      xReadImageUnderstanding: Schema.boolean().default(false).description("是否允许 Grok 在 X Read 中查看图片（不建议开启，Grok 在 API 中的图像识别能力较差，会降低返回质量。建议在本插件中配置图像描述服务代替此选项。）")
    }).description("Grok 内置工具配置")
  }),
  Schema.object({
    jinaReader: Schema.object({
      apiKey: Schema.string().role("secret").default("").description("Jina Reader API Key，可选。遇到速率限制时可填写"),
      timeoutSeconds: Schema.number().min(5).max(120).default(60).description("Jina 请求超时（秒）")
    }).description("Jina Reader 配置")
  }),
  Schema.object({
    imageService: Schema.object({
      enable: Schema.boolean().default(false).description("是否为搜索/读取结果中的图片 URL 生成描述"),
      model: Schema.dynamic("model").default("无").description("用于图片描述的多模态模型"),
      prompt: Schema.string().role("textarea").default(DEFAULT_IMAGE_PROMPT).description("图片描述提示词"),
      maxImages: Schema.number().min(1).max(20).default(10).description("每次工具调用最多描述的图片数"),
      taskConcurrency: Schema.number().min(1).max(20).default(3).description("图片描述并发数"),
      requestTimeoutSeconds: Schema.number().min(1).max(120).default(20).description("图片下载超时（秒）")
    }).description("图片描述服务")
  }),
  Schema.object({
    debug: Schema.boolean().default(false).description("输出调试日志")
  })
]);
var usage = `## chatluna-llm-web-search
为 ChatLuna 提供 Web Search、Web Read、X Search、X Read 工具，请在使用时尽量关闭其他插件或 MCP、Skills 提供的搜索、网页读取工具。

### GPT

**最适合非网络热梗的正经搜索**

如果需要使用 GPT 模型作为搜索服务使用的模型，需要：
1. 安装 \`chatluna-openai-adapter\` 或 \`chatluna-openai-like-adapter\`
2. 完成 API URL、API Key 配置
3. 在“模型配置”中启用 \`responsesApi\`
4. 在“模型配置”中将 \`maxContextRatio\` 拉满
5. 使用 ID 以 \`gpt-\` 开头的模型。本插件会自动为 Web Search 附加 \`web_search\`，无需在适配器的“其他设置”中启用 \`web_search\` 或维护 \`responseBuiltinToolSupportModel\`。

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

如果未开启“图片描述服务”，则搜索/读取结果中不会包含图片的文本描述信息，只有 URL。`;

// src/index.ts
var ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var urlCandidateRegex = /https?:\/\/[^\s<>\]"')]+/gi;
var webSearchSchema = z.object({
  query: z.string().describe("需要搜索的关键词或问题。")
});
var webReadSchema = z.object({
  url: z.string().url().describe("需要读取的网页 URL。")
});
var xSearchSchema = z.object({
  query: z.string().describe("需要在 X/Twitter 中搜索的关键词或问题。")
});
var xReadSchema = z.object({
  url: z.string().describe("需要读取的 X/Twitter URL，通常是推文、用户主页或搜索结果链接。")
});
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
__name(escapeRegExp, "escapeRegExp");
function normalizeUrlCandidate(value) {
  return value.replace(/[),.;!?]+$/, "");
}
__name(normalizeUrlCandidate, "normalizeUrlCandidate");
function isLikelyImageUrl(value) {
  if (/\.(png|jpe?g|webp|gif)(\?|$)/i.test(value)) {
    return true;
  }
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const path = url.pathname || "";
    if (host === "pbs.twimg.com" && path.startsWith("/media/")) {
      return true;
    }
    const format = (url.searchParams.get("format") || "").toLowerCase();
    return ["jpg", "jpeg", "png", "webp", "gif"].includes(format);
  } catch {
    return false;
  }
}
__name(isLikelyImageUrl, "isLikelyImageUrl");
function normalizeMarkdownLabel(value) {
  return value.replace(/[\r\n]+/g, " ").replace(/[\[\]]/g, "").trim() || "图像";
}
__name(normalizeMarkdownLabel, "normalizeMarkdownLabel");
function replaceImageUrlWithDescription(text, rawUrl, desc) {
  const label = normalizeMarkdownLabel(desc);
  const replacement = `[${label}](${rawUrl})`;
  const pattern = escapeRegExp(rawUrl);
  let result = text;
  result = result.replace(new RegExp(`\\[!\\[[^\\]]*\\]\\(${pattern}\\)\\]\\([^\\)]+\\)`, "g"), replacement);
  result = result.replace(new RegExp(`!\\[[^\\]]*\\]\\(${pattern}\\)`, "g"), replacement);
  result = result.replace(new RegExp(`\\[\\[[^\\]]*\\]\\]\\(${pattern}\\)`, "g"), replacement);
  result = result.replace(new RegExp(`\\[[^\\]]*\\]\\(${pattern}\\)`, "g"), replacement);
  result = result.replace(new RegExp(pattern, "g"), (match, offset, source) => {
    const before = source.slice(0, offset);
    const after = source.slice(offset + match.length);
    const lastLinkOpen = before.lastIndexOf("](");
    const lastCloseParen = before.lastIndexOf(")");
    if (lastLinkOpen !== -1 && lastLinkOpen > lastCloseParen && after.trimStart().startsWith(")")) {
      return match;
    }
    return replacement;
  });
  return result;
}
__name(replaceImageUrlWithDescription, "replaceImageUrlWithDescription");
function getModelIdentity(configuredModel, chatModel) {
  const slashIndex = configuredModel.indexOf("/");
  const platform = slashIndex >= 0 ? configuredModel.slice(0, slashIndex) : "";
  const configuredName = slashIndex >= 0 ? configuredModel.slice(slashIndex + 1) : configuredModel;
  const modelName = String(chatModel?.modelName || configuredName || "");
  return {
    platform: platform.toLowerCase(),
    modelName,
    lowerModelName: modelName.toLowerCase()
  };
}
__name(getModelIdentity, "getModelIdentity");
function getConfiguredModelName(configuredModel) {
  const slashIndex = configuredModel.indexOf("/");
  return slashIndex >= 0 ? configuredModel.slice(slashIndex + 1) : configuredModel;
}
__name(getConfiguredModelName, "getConfiguredModelName");
function isUsableModel(model) {
  return Boolean(model && model !== "无");
}
__name(isUsableModel, "isUsableModel");
function isGrokModel(model) {
  return getConfiguredModelName(model).toLowerCase().startsWith("grok-");
}
__name(isGrokModel, "isGrokModel");
function getModelCandidates(model) {
  return [model.model, model.fallbackModel].filter((item) => isUsableModel(item || "")).filter((item, index, array) => array.indexOf(item) === index);
}
__name(getModelCandidates, "getModelCandidates");
function validateXModelCandidates(candidates) {
  if (!candidates.length) {
    throw new Error("未配置 X Search / X Read 使用的 Grok 模型。");
  }
  const invalid = candidates.find((model) => !isGrokModel(model));
  if (invalid) {
    throw new Error(`X Search / X Read 只支持 ID 以 grok- 开头的模型：${invalid}`);
  }
}
__name(validateXModelCandidates, "validateXModelCandidates");
var logger;
function apply(ctx, cfg) {
  logger = createLogger(ctx, name);
  const webModelRefs = /* @__PURE__ */ new Map();
  const xModelRefs = /* @__PURE__ */ new Map();
  let imageModelRef;
  let imageModelName = "";
  async function ensureWebModelRef(target = cfg.webModelService.model) {
    if (!target || target === "无") return void 0;
    const cached = webModelRefs.get(target);
    if (cached) {
      return cached;
    }
    try {
      const ref = await ctx.chatluna.createChatModel(target);
      webModelRefs.set(target, ref);
      return ref;
    } catch (err) {
      logger.warn("加载 Web 搜索/读取模型失败: %s", err?.message || String(err));
      return void 0;
    }
  }
  __name(ensureWebModelRef, "ensureWebModelRef");
  async function ensureXModelRef(target = cfg.xModelService.model) {
    if (!target || target === "无") return void 0;
    const cached = xModelRefs.get(target);
    if (cached) {
      return cached;
    }
    try {
      const ref = await ctx.chatluna.createChatModel(target);
      xModelRefs.set(target, ref);
      return ref;
    } catch (err) {
      logger.warn("加载 X 搜索/读取模型失败: %s", err?.message || String(err));
      return void 0;
    }
  }
  __name(ensureXModelRef, "ensureXModelRef");
  async function ensureImageModelRef() {
    const target = cfg.imageService.model;
    if (!target || target === "无") return void 0;
    if (imageModelRef && imageModelName === target) {
      return imageModelRef;
    }
    try {
      imageModelRef = await ctx.chatluna.createChatModel(target);
      imageModelName = target;
      return imageModelRef;
    } catch (err) {
      logger.warn("加载图片描述模型失败: %s", err?.message || String(err));
      return void 0;
    }
  }
  __name(ensureImageModelRef, "ensureImageModelRef");
  ctx.on("ready", async () => {
    modelSchema(ctx);
    for (const model of getModelCandidates(cfg.webModelService)) {
      await ensureWebModelRef(model);
    }
    for (const model of getModelCandidates(cfg.xModelService)) {
      await ensureXModelRef(model);
    }
    await ensureImageModelRef();
    if (cfg.webSearchTool.enable) {
      const tool = new WebSearchTool({
        ctx,
        cfg,
        action: "web_search",
        tool: cfg.webSearchTool,
        ensureModelRef: ensureWebModelRef,
        ensureImageModelRef
      });
      ctx.effect(
        () => ctx.chatluna.platform.registerTool(tool.name, {
          description: tool.description,
          selector() {
            return true;
          },
          createTool() {
            return new WebSearchTool({
              ctx,
              cfg,
              action: "web_search",
              tool: cfg.webSearchTool,
              ensureModelRef: ensureWebModelRef,
              ensureImageModelRef
            });
          },
          meta: meta("web-search")
        })
      );
    }
    if (cfg.webReadTool.enable) {
      const tool = new WebReadTool({
        ctx,
        cfg,
        action: "web_read",
        tool: cfg.webReadTool,
        ensureModelRef: ensureWebModelRef,
        ensureImageModelRef
      });
      ctx.effect(
        () => ctx.chatluna.platform.registerTool(tool.name, {
          description: tool.description,
          selector() {
            return true;
          },
          createTool() {
            return new WebReadTool({
              ctx,
              cfg,
              action: "web_read",
              tool: cfg.webReadTool,
              ensureModelRef: ensureWebModelRef,
              ensureImageModelRef
            });
          },
          meta: meta("web-search")
        })
      );
    }
    if (cfg.xSearchTool.enable) {
      const tool = new XSearchTool({
        ctx,
        cfg,
        action: "x_search",
        tool: cfg.xSearchTool,
        ensureModelRef: ensureXModelRef,
        ensureImageModelRef
      });
      ctx.effect(
        () => ctx.chatluna.platform.registerTool(tool.name, {
          description: tool.description,
          selector() {
            return true;
          },
          createTool() {
            return new XSearchTool({
              ctx,
              cfg,
              action: "x_search",
              tool: cfg.xSearchTool,
              ensureModelRef: ensureXModelRef,
              ensureImageModelRef
            });
          },
          meta: meta("web-search")
        })
      );
    }
    if (cfg.xReadTool.enable) {
      const tool = new XReadTool({
        ctx,
        cfg,
        action: "x_read",
        tool: cfg.xReadTool,
        ensureModelRef: ensureXModelRef,
        ensureImageModelRef
      });
      ctx.effect(
        () => ctx.chatluna.platform.registerTool(tool.name, {
          description: tool.description,
          selector() {
            return true;
          },
          createTool() {
            return new XReadTool({
              ctx,
              cfg,
              action: "x_read",
              tool: cfg.xReadTool,
              ensureModelRef: ensureXModelRef,
              ensureImageModelRef
            });
          },
          meta: meta("web-search")
        })
      );
    }
  });
}
__name(apply, "apply");
function meta(group) {
  return {
    source: "extension",
    group,
    tags: ["web-search", "web-read", "x-search", "x-read"],
    defaultAvailability: {
      enabled: true,
      main: true,
      chatluna: true,
      characterScope: "all"
    }
  };
}
__name(meta, "meta");
var WebSearchTool = class extends StructuredTool {
  constructor(deps) {
    super({});
    this.deps = deps;
    this.name = deps.tool.name.trim() || "web_search";
    this.description = deps.tool.description.trim();
  }
  static {
    __name(this, "WebSearchTool");
  }
  name;
  description;
  schema = webSearchSchema;
  async _call(input) {
    return run(this.deps, {
      query: input.query
    });
  }
};
var WebReadTool = class extends StructuredTool {
  constructor(deps) {
    super({});
    this.deps = deps;
    this.name = deps.tool.name.trim() || "web_read";
    this.description = deps.tool.description.trim();
  }
  static {
    __name(this, "WebReadTool");
  }
  name;
  description;
  schema = webReadSchema;
  async _call(input) {
    return run(this.deps, {
      url: input.url
    });
  }
};
var XSearchTool = class extends StructuredTool {
  constructor(deps) {
    super({});
    this.deps = deps;
    this.name = deps.tool.name.trim() || "x_search";
    this.description = deps.tool.description.trim();
  }
  static {
    __name(this, "XSearchTool");
  }
  name;
  description;
  schema = xSearchSchema;
  async _call(input) {
    return run(this.deps, {
      query: input.query
    });
  }
};
var XReadTool = class extends StructuredTool {
  constructor(deps) {
    super({});
    this.deps = deps;
    this.name = deps.tool.name.trim() || "x_read";
    this.description = deps.tool.description.trim();
  }
  static {
    __name(this, "XReadTool");
  }
  name;
  description;
  schema = xReadSchema;
  async _call(input) {
    return run(this.deps, {
      url: input.url
    });
  }
};
async function run(deps, input) {
  try {
    if (deps.action.startsWith("x_")) {
      validateXModelCandidates(getModelCandidates(deps.cfg.xModelService));
    }
    if (deps.action === "web_read" && input.url) {
      const read = await callJinaReader(deps, input.url);
      return await withImages(
        deps.ctx,
        deps.cfg,
        read,
        deps.ensureImageModelRef
      );
    }
    const result = await callModel(deps, input);
    return await withImages(deps.ctx, deps.cfg, result, deps.ensureImageModelRef);
  } catch (err) {
    if (deps.cfg.debug) {
      logger.warn(err);
    }
    return `${deps.action} failed: ${err?.message || String(err)}`;
  }
}
__name(run, "run");
async function callModel(deps, input) {
  const model = deps.action.startsWith("x_") ? deps.cfg.xModelService : deps.cfg.webModelService;
  const candidates = getModelCandidates(model);
  if (!candidates.length) {
    throw new Error("未配置搜索/读取模型。");
  }
  const parts = [];
  if (input.query) parts.push(input.query);
  if (input.url) parts.push(input.url);
  let lastError;
  for (const candidate of candidates) {
    try {
      const ref = await deps.ensureModelRef(candidate);
      if (!ref?.value) {
        throw new Error(`模型加载失败：${candidate}`);
      }
      const overrideRequestParams = buildOverrideRequestParams(
        deps,
        candidate,
        ref.value
      );
      const msg = await ref.value.invoke(
        [
          new SystemMessage(deps.tool.prompt),
          new HumanMessage(parts.join("\n"))
        ],
        {
          overrideRequestParams
        }
      );
      return getMessageContent(msg.content).trim();
    } catch (err) {
      lastError = err;
      if (candidate !== candidates[candidates.length - 1]) {
        logger.warn(
          "搜索/读取模型 %s 调用失败，切换到备选模型: %s",
          candidate,
          err?.message || String(err)
        );
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError || "搜索/读取模型调用失败。"));
}
__name(callModel, "callModel");
function buildOverrideRequestParams(deps, configuredModel, chatModel) {
  const { lowerModelName } = getModelIdentity(configuredModel, chatModel);
  const llmType = String(chatModel._llmType?.() || "").toLowerCase();
  const responseApi = chatModel._requester?._pluginConfig?.responseApi === true;
  if (deps.action === "web_search" && llmType === "openai" && responseApi && lowerModelName.startsWith("gpt-")) {
    return {
      tools: [{ type: "web_search" }]
    };
  }
  if (deps.cfg.grokBuiltinTools.enable && llmType === "openai" && responseApi && lowerModelName.startsWith("grok-")) {
    return {
      tools: buildGrokTools(deps.cfg, deps.action)
    };
  }
  return void 0;
}
__name(buildOverrideRequestParams, "buildOverrideRequestParams");
function buildGrokTools(cfg, action) {
  if (action === "web_search") {
    return [
      {
        type: "web_search",
        enable_image_understanding: cfg.grokBuiltinTools.imageUnderstanding
      },
      ...cfg.grokBuiltinTools.webSearchWithXSearch ? [
        {
          type: "x_search",
          enable_image_understanding: cfg.grokBuiltinTools.imageUnderstanding,
          enable_video_understanding: cfg.grokBuiltinTools.xVideoUnderstanding
        }
      ] : []
    ];
  }
  if (action === "web_read") {
    return [
      {
        type: "web_search",
        enable_image_understanding: cfg.grokBuiltinTools.imageUnderstanding
      }
    ];
  }
  if (action === "x_search") {
    return [
      {
        type: "x_search",
        enable_image_understanding: cfg.grokBuiltinTools.imageUnderstanding,
        enable_video_understanding: cfg.grokBuiltinTools.xVideoUnderstanding
      }
    ];
  }
  return [
    {
      type: "x_search",
      enable_image_understanding: cfg.grokBuiltinTools.xReadImageUnderstanding,
      enable_video_understanding: cfg.grokBuiltinTools.xVideoUnderstanding
    }
  ];
}
__name(buildGrokTools, "buildGrokTools");
async function callJinaReader(deps, url) {
  const headers = {
    "User-Agent": ua,
    Accept: "text/plain"
  };
  if (deps.cfg.jinaReader.apiKey) {
    headers.Authorization = `Bearer ${deps.cfg.jinaReader.apiKey}`;
  }
  return deps.ctx.http.get(`https://r.jina.ai/${url}`, {
    timeout: deps.cfg.jinaReader.timeoutSeconds * 1e3,
    responseType: "text",
    headers
  });
}
__name(callJinaReader, "callJinaReader");
async function withImages(ctx, cfg, text, ensureImageModelRef) {
  if (!cfg.imageService.enable) {
    return text;
  }
  if (!cfg.imageService.model || cfg.imageService.model === "无") {
    return text;
  }
  const urls = Array.from(
    new Set(
      Array.from(text.matchAll(urlCandidateRegex)).map((item) => normalizeUrlCandidate(item[0])).filter(isLikelyImageUrl)
    )
  ).slice(0, cfg.imageService.maxImages);
  if (!urls.length) {
    return text;
  }
  const ref = await ensureImageModelRef();
  if (!ref?.value) {
    return text;
  }
  if (!Array.isArray(ref.value.modelInfo?.capabilities) || !ref.value.modelInfo.capabilities.includes(ModelCapabilities.ImageInput)) {
    return text;
  }
  const descriptions = {};
  let idx = 0;
  await Promise.all(
    Array.from(
      { length: Math.min(cfg.imageService.taskConcurrency, urls.length) },
      async () => {
        while (idx < urls.length) {
          const url = urls[idx];
          idx += 1;
          try {
            const data = await ctx.http.get(url, {
              responseType: "arraybuffer",
              timeout: cfg.imageService.requestTimeoutSeconds * 1e3,
              headers: {
                "User-Agent": ua
              }
            });
            const buf = Buffer.from(data);
            const mime = getImageType(buf) || "image/jpeg";
            if (mime === "image/gif") {
              continue;
            }
            const msg = await ref.value.invoke([
              new HumanMessage({
                content: [
                  {
                    type: "text",
                    text: cfg.imageService.prompt
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${mime};base64,${buf.toString("base64")}`
                    }
                  }
                ]
              })
            ]);
            const desc = getMessageContent(msg.content).trim();
            if (desc) {
              descriptions[url] = desc;
            }
          } catch {
          }
        }
      }
    )
  );
  if (!Object.keys(descriptions).length) {
    return text;
  }
  let processed = text;
  for (const [url, desc] of Object.entries(descriptions)) {
    processed = replaceImageUrlWithDescription(processed, url, desc);
  }
  return processed;
}
__name(withImages, "withImages");
export {
  Config,
  apply,
  inject,
  name,
  usage
};
