import './load-env.js'
import OpenAI from 'openai'
import { buildNormalizedNewsItems, createFallbackInsights } from '../shared/report-builder.js'
import {
  NEWS_INSIGHT_BATCH_JSON_SCHEMA,
  newsInsightBatchSchema,
} from '../shared/new_schema.js'

const DEFAULT_BATCH_SIZE = 5

function chunk(items, size = DEFAULT_BATCH_SIZE) {
  const batches = []

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size))
  }

  return batches
}

function buildInsightInput(rawNewsItems) {
  return rawNewsItems.map((item) => ({
    contextNewsId: item.contextId,
    title: item.title,
    source: item.source,
    publishedAt: item.publishedAt,
    url: item.url,
    description: item.description,
    content: item.content.slice(0, 800),
  }))
}

function buildInsightPrompt(batch) {
  return [
    '你是一个 AI 新闻分析助手。',
    '你会收到 1 到 5 条已经清洗过的新闻。请先对每条新闻做轻量结构化抽取，而不是直接生成整份日报。',
    '输出必须满足给定 schema，并且对输入中的每一条新闻都返回一个 insight，不能省略、不能合并。',
    '要求：',
    '1. summary 写成 2 句以内的高密度摘要，不要复制标题。',
    '2. category 只能是 technology、application、policy、capital 之一。',
    '3. entities 提取公司、模型、产品或关键主体名称，最多 5 个。',
    '4. signals 提取 1-4 条可以支撑日报趋势判断的信号。',
    '5. importanceHint 取 1-5 的整数，表示这条新闻进入 Top 事件的潜在重要性。',
    '6. evidence 只能引用或紧贴原始新闻表达，不要编造。',
    '7. contextNewsId 必须与输入完全一致。',
    '',
    `输入新闻：${JSON.stringify(batch)}`,
  ].join('\n')
}

function validateBatchOutput(batch, payload) {
  const parsed = newsInsightBatchSchema.parse(payload)
  const expectedIds = new Set(batch.map((item) => item.contextNewsId))
  const actualIds = parsed.insights.map((item) => item.contextNewsId)

  if (parsed.insights.length !== batch.length) {
    throw new Error(`Insight extraction returned ${parsed.insights.length} items for a batch of ${batch.length}.`)
  }

  if (new Set(actualIds).size !== actualIds.length) {
    throw new Error('Insight extraction returned duplicate contextNewsId values.')
  }

  for (const insight of parsed.insights) {
    if (!expectedIds.has(insight.contextNewsId)) {
      throw new Error(`Insight extraction returned an unknown contextNewsId: ${insight.contextNewsId}`)
    }
  }

  return parsed.insights
}

async function extractInsightBatch(client, batch) {
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
    input: [
      {
        role: 'user',
        content: buildInsightPrompt(batch),
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'daily_ai_news_insight_batch',
        strict: true,
        schema: NEWS_INSIGHT_BATCH_JSON_SCHEMA,
      },
    },
  })

  const rawText = response.output_text?.trim()

  if (!rawText) {
    throw new Error('Responses API returned an empty insight batch.')
  }

  return validateBatchOutput(batch, JSON.parse(rawText))
}

export async function generateInsights(rawItems) {
  const rawNewsItems = buildNormalizedNewsItems(rawItems)

  if (!process.env.OPENAI_API_KEY) {
    return {
      rawNewsItems,
      extractedInsights: createFallbackInsights(rawItems),
      mode: 'fallback',
    }
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const insightInput = buildInsightInput(rawNewsItems)
  const extractedInsights = []

  for (const batch of chunk(insightInput)) {
    const batchInsights = await extractInsightBatch(client, batch)

    for (const insight of batchInsights) {
      const news = rawNewsItems.find((item) => item.contextId === insight.contextNewsId)

      if (!news) {
        continue
      }

      extractedInsights.push({
        ...insight,
        title: news.title,
        sourceName: news.source,
        publishedAt: news.publishedAt,
        url: news.url,
        description: news.description,
      })
    }
  }

  return {
    rawNewsItems,
    extractedInsights,
    mode: 'openai',
  }
}
