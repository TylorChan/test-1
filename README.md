# 说明文档

## 数据源说明

- **来源**：当前项目只使用 `NewsAPI /v2/everything` 作为新闻源，对应代码在 `scripts/build-snapshot.mjs`。
- **选择理由**：
  - 是成熟的官方新闻 API，接入简单，返回结构稳定。
  - 比 GitHub Releases 更像真正的「AI 新闻日报」场景。
  - 免费额度足够支撑本项目每天抓取少量新闻做分析。
- **数据特点**：
  - 通过 `config/news-query.json` 固定查询 AI 相关关键词，例如 `artificial intelligence`、`AI agent`、`large language model`、`OpenAI`、`Anthropic`、`Gemini`、`ChatGPT`。
  - 只搜索 `title,description`，语言固定为英文，按 `publishedAt` 排序。
  - 每次只抓取最近 `15` 条新闻，回看窗口为最近 `7` 天。
  - 原始快照写入 `data/raw/releases.json`，页面运行时消费的是本地快照，不在页面请求阶段直接访问 NewsAPI。

## 系统设计思路

- **整体架构**：
  - `scripts/build-snapshot.mjs`：负责抓原始新闻并生成快照。
  - `lib/insight-generator.js`：负责把新闻分批送给 AI，先做新闻级结构化抽取。
  - `lib/report-generator.js`：基于中间层 insight 再生成日报级结构化结果。
  - `shared/new_schema.js`：定义中间层与日报层的 schema，并用 `zod` 做运行时校验。
  - `shared/report-builder.js`：负责标准化原始新闻、补充来源信息、拼接 markdown、以及 fallback 逻辑。
  - `api/`：提供 dashboard 数据和右侧 AI 对话接口。
  - `src/`：左栏日报 + 右栏 AI 助手 UI。
- **关键决策**：
  - 只保留一个数据源，避免把项目做成多源聚合平台。
  - 不把 15 条原始新闻一次性丢给模型，而是拆成两阶段：
    1. 新闻级 insight 抽取
    2. 日报级聚合总结
  - 结构化结果必须经过 schema 校验，不能只靠 prompt 约束。
  - 页面重点展示日报本身，右侧助手只作为围绕当前日报继续追问的能力，不做独立聊天产品。

## AI使用方式

- **使用场景**：
  - 第一阶段：`lib/insight-generator.js` 中，AI 对每条新闻做轻量结构化抽取，输出 `summary`、`category`、`entities`、`signals`、`importanceHint`、`evidence`。
  - 第二阶段：`lib/report-generator.js` 中，AI 基于第一阶段的 insights 生成最终日报，输出 `reportTitle`、`executiveSummary`、`topEvents`、`deepDives`、`trendJudgments`。
  - 第三阶段：`api/lib/assistant.js` 中，右栏 AI 助手基于整页日报结构化信息回答用户追问。
- **具体 API 调用与 prompt**：
  - **第一阶段：新闻级 insight 抽取**
    - 调用位置：`lib/insight-generator.js`
    - 调用方式：`OpenAI Responses API`
    - 原始 prompt 如下：

```txt
你是一个 AI 新闻分析助手。
你会收到 1 到 5 条已经清洗过的新闻。请先对每条新闻做轻量结构化抽取，而不是直接生成整份日报。
输出必须满足给定 schema，并且对输入中的每一条新闻都返回一个 insight，不能省略、不能合并。
要求：
1. summary 写成 2 句以内的高密度摘要，不要复制标题。
2. category 只能是 technology、application、policy、capital 之一。
3. entities 提取公司、模型、产品或关键主体名称，最多 5 个。
4. signals 提取 1-4 条可以支撑日报趋势判断的信号。
5. importanceHint 取 1-5 的整数，表示这条新闻进入 Top 事件的潜在重要性。
6. evidence 只能引用或紧贴原始新闻表达，不要编造。
7. contextNewsId 必须与输入完全一致。

输入新闻：${JSON.stringify(batch)}
```

  - **第二阶段：日报级聚合分析**
    - 调用位置：`lib/report-generator.js`
    - 调用方式：`OpenAI Responses API`
    - 原始 prompt 如下：

```txt
你是一个负责生成 AI 日报的分析助手。
你会收到一组已经完成新闻级结构化抽取的 AI 新闻 insights。
请只基于输入 insights 完成日报级聚合分析，不要引入外部知识，不要编造不存在的事实。
输出必须满足给定 schema。
要求：
1. topEvents 选择 3-5 个最重要事件，避免重复表述。
2. topEvents.summary 和 topEvents.whyImportant 不要写成一句话，至少写成 2-3 句、信息密度高、适合直接渲染。
3. deepDives 选择 2-3 个关键事件，写清背景与影响。
4. deepDives.background、impact、riskOrOpportunity 都要写成适合 Markdown 渲染的完整段落，不要只写短句。
5. trendJudgments 的 judgment 也要写成完整段落，每个维度至少 2 句，能直接渲染成长文本。
6. trendJudgments 必须固定输出 technology、application、policy、capital 四个维度。
7. 所有 contextNewsIds 必须来自输入新闻的 id。
8. relatedEventIds 必须引用 topEvents 中的 id。
9. evidence 和 signals 必须来自输入 insight 中的 evidence、signals 或其直接归纳。
10. executiveSummary 要像日报开头摘要，而不是单句标题补充。
11. 优先利用 importanceHint、signals、entities 进行事件筛选和趋势归纳。

输入 insights：${JSON.stringify(insights)}
```

  - **第三阶段：右栏 AI 助手追问**
    - 调用位置：`api/lib/assistant.js`
    - 调用方式：`OpenAI Responses API`
    - system prompt 如下：

```txt
你是 Daily AI Insight Engine 的日报分析助手。
你只能基于当前日报上下文回答，不要编造不存在的信息。
优先回答：事件背景、为什么重要、影响范围、技术/应用/资本趋势。
如上下文不足，要明确说“当前日报里没有足够证据”。
日报标题：${context.reportTitle || 'AI 新闻日报'}
执行摘要：${context.executiveSummary || ''}
今日热点：${(context.topEvents || []).map((item) => item.title).join(' | ')}
深度总结：${(context.deepDives || []).map((item) => item.title).join(' | ')}
趋势判断：${(context.trendJudgments || []).map((item) => `${item.dimension}:${item.judgment}`).join(' | ')}
```

    - 同一次调用里还会额外传入：

```txt
结构化上下文：${JSON.stringify(context)}
```

- **错误处理**：
  - 如果没有配置 `OPENAI_API_KEY`，日报和助手都走本地 fallback。
  - 新闻级 insight 抽取会校验：
    - 返回条数必须和输入批次一致。
    - `contextNewsId` 不能重复，且必须来自输入。
  - 日报级结果会用 `dailyReportSchema` 再做一次校验。
  - 任意一步失败后，会回退到 `shared/report-builder.js` 里的规则生成逻辑，保证 demo 可运行。
- **AI Coding**：
  - 这个项目不只是调用线上模型，也使用了 Codex 的 skill 体系辅助开发。
  - React / 前端实现这类工作流，可以结合 React 相关 skill 做代码质量和组件实现约束。
  - `addMoreNews` 是一个开发型 skill，用来更新 `NewsAPI` 查询参数，例如增量加入 `domains`、写入 `excludeDomains`、覆盖 `from / to`，避免手改代码。
  - `publishDemo` 是一个发布型 skill，用来把本地 demo 项目发布到 GitHub，并部署到 Vercel。
  - 这两个 skill 都属于开发效率工具，不是产品面向终端用户的功能。

## 核心流程说明

1. **抓取原始新闻**
   - `scripts/build-snapshot.mjs` 调用 NewsAPI。
   - 把返回结果统一映射为项目内部的原始新闻对象，只保留标题、来源、正文、链接、发布时间等字段。
   - 输出到 `data/raw/releases.json`。

2. **标准化原始新闻**
   - `shared/report-builder.js` 中的 `buildNormalizedNewsItems` 会把原始新闻清洗成统一结构。
   - 这里会生成 `contextId`（例如 `news_1`），后面所有结构化分析都用这个 id 回指原始新闻。
   - 同时会从正文中拆出 `description`、`content`、`evidence`，减少后续模型输入噪音。

3. **分批做新闻级 insight 抽取**
   - `lib/insight-generator.js` 会把 15 条新闻按 `5` 条一批切分。
   - 每批交给 `OpenAI Responses API` 输出结构化 insight。
   - 抽取结果会补回原始新闻的 `title`、`sourceName`、`url`、`publishedAt`，方便后续 UI 和助手直接使用。

4. **生成日报级结构化结果**
   - `lib/report-generator.js` 不再直接使用原始新闻，而是把上一步得到的 insights 再送给模型。
   - 模型输出最终日报结构：
     - `topEvents`
     - `deepDives`
     - `trendJudgments`
   - 这些结果再通过 `contextNewsIds` 关联回原始新闻。

5. **富化与渲染准备**
   - `shared/report-builder.js` 会把来源名、原文链接、关联新闻补回到日报对象里。
   - 同时生成一份 markdown 版本，写入 `data/report/daily-report.md`。
   - 结构化 dashboard 数据写入 `data/report/dashboard.json`。
   - 中间层 insight 和最终日报一起写入 `data/structured/insights.json`，方便检查处理链路。

6. **前端展示与继续追问**
   - 左栏展示三部分：
     - 今日 AI 领域主要热点
     - 重要事件深度总结
     - 趋势判断
   - 右上角 `问AI` 按钮打开右栏助手。
   - 右栏助手拿到的是**整页结构化日报 + 关联原始新闻**，所以用户可以继续问事件背景、趋势方向、资本含义等问题。

## 总结

这个项目的核心不是“抓 15 条新闻然后让 AI 写一篇报告”，而是：

- 先抓原始新闻
- 再做标准化
- 再做分批 insight 抽取
- 再做日报级聚合分析
- 最后把结构化结果渲染成页面，并提供上下文化问答

这样能更清楚地体现：

- 数据清洗
- 分批处理
- schema 校验
- AI 使用边界
- 从原始数据到最终报告的完整工程链路
