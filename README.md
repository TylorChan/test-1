# Daily AI Insight Engine

一个面向 **AI 新闻分析** 的日报系统 MVP。系统只使用 **NewsAPI** 作为消息源，围绕 15 条近期 AI 相关新闻完成：

- 原始数据整理
- 结构化抽取
- 热点/趋势分析
- Markdown 日报生成
- 左栏日报 + 右栏 AI 追问助手的单页展示

## 为什么只选 NewsAPI

本题允许消息源自由选择。这里刻意收敛到 **NewsAPI**，原因是：

1. 是成熟的官方新闻 API，接入成本低，返回结构稳定
2. 比 GitHub Releases 更贴近“AI 新闻日报”这个题目本身
3. 免费开发额度足够支撑当前 15 条 AI 新闻的抓取与分析

> 当前版本通过 **NewsAPI `/v2/everything`** 拉取 AI 相关新闻，再生成本地快照与分析产物；前端运行时消费的是这份快照，避免页面请求阶段直接依赖外部新闻 API。

## 项目结构

```txt
config/                 新闻查询配置
data/raw/               原始新闻快照
data/structured/        结构化 insight 结果
data/report/            dashboard 与 markdown 日报
api/                    Vercel / Express API
scripts/                快照与日报生成脚本
shared/                 结构化抽取与报告生成逻辑
src/                    React 前端（Jotai 状态管理）
```

## 核心流程

### 1. Snapshot

`scripts/build-snapshot.mjs`

- 通过 NewsAPI `/v2/everything` 抓取 AI 相关新闻
- 统一保留：标题、摘要、来源媒体、发布时间、链接
- 生成 `data/raw/releases.json`

### 2. Structured extraction

`shared/new_schema.js`

先做**新闻级 insight 抽取**，再做**日报级聚合生成**，避免把原始 15 条新闻一次性丢给模型。

新闻级 insight 字段包括：

- `contextNewsId`
- `summary`
- `category`
- `entities`
- `signals`
- `importanceHint`
- `evidence`

日报级结构化输出字段包括：

- `reportTitle`
- `executiveSummary`
- `topEvents`
- `deepDives`
- `trendJudgments`

每个事件再通过 `contextNewsIds` 回指原始新闻，后续在前端补充 `sourceNames`、`sourceUrls` 和 AI 助手上下文。

### 3. Analysis

基于结构化日报做二次分析与渲染：

- `Top 3-5` 新闻热点
- `Top 2-3` 深度总结
- `technology / application / policy / capital` 四维趋势判断
- 原文链接回跳与右侧 AI 追问上下文注入

### 4. Report rendering

- 左栏展示日报分析
- 右栏为 AI 助手
- 用户在左栏点击 `问AI` 后，右栏才展开

## 为什么不是 one-shot prompt

题目明确要求不能把原始数据一次性丢给 AI 生成全部结果。这里拆成了：

1. `fetch / snapshot`
2. `normalize`
3. `batched insight extraction`
4. `structured report generation`
5. `analysis-ready enrichment`
6. `report rendering`

这样可以明确体现：

- 数据清洗逻辑
- 分批处理
- schema 设计
- 分析依据
- UI 上下文注入方式

## AI 使用方式

### 1. 右侧 AI 助手

`POST /api/chat`

- 输入：当前选中事件 + 当日热点 + 趋势判断
- 输出：流式返回 AI 分析回复

如果配置了 `OPENAI_API_KEY`，则调用 OpenAI 生成回答；否则退化为本地上下文模板回答，保证 demo 可运行。

### 2. Prompt 设计原则

- 只允许基于当前日报上下文回答
- 不允许编造不存在的信息
- 优先解释：
  - 事件背景
  - 为什么重要
  - 对技术/应用/资本方向的影响

## UI 设计决策

参考 `/Users/daqingchen/AI-Review-Console` 的极简白底风格：

- 默认只有左栏日报
- 点击 `问AI` 后，右栏弹开
- 中间只保留一条分割线
- 不增加额外视觉装饰，重点突出信息结构和问答链路

## 运行方式

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

### 重新生成快照与日报

```bash
npm run pipeline
```

### 构建

```bash
npm run build
```

## 环境变量

复制 `.env.example` 为 `.env.local`（或自行设置 shell 环境变量）

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `NEWS_API_KEY` 或 `NEWS_API`（必填，用于访问 NewsAPI）

## 当前限制

- 只覆盖 NewsAPI 新闻流，不覆盖社交媒体 / 自建抓取
- 免费计划下可用请求数有限，因此当前只抓取 15 条 AI 相关新闻
- 没有做历史日报管理
- 没有做复杂聚类或向量检索
- AI 助手上下文来自当前日报，不是长期记忆系统
