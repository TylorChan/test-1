import './load-env.js'
import OpenAI from 'openai'
import {
  createDashboardPayloadFromStructuredReport,
  createFallbackDashboardPayload,
} from '../shared/report-builder.js'
import { DAILY_REPORT_JSON_SCHEMA, dailyReportSchema } from '../shared/new_schema.js'
import { generateInsights } from './insight-generator.js'

function buildReportPrompt(insights) {
  return [
    '你是一个负责生成 AI 日报的分析助手。',
    '你会收到一组已经完成新闻级结构化抽取的 AI 新闻 insights。',
    '请只基于输入 insights 完成日报级聚合分析，不要引入外部知识，不要编造不存在的事实。',
    '输出必须满足给定 schema。',
    '要求：',
    '1. topEvents 选择 3-5 个最重要事件，避免重复表述。',
    '2. topEvents.summary 和 topEvents.whyImportant 不要写成一句话，至少写成 2-3 句、信息密度高、适合直接渲染。',
    '3. deepDives 选择 2-3 个关键事件，写清背景与影响。',
    '4. deepDives.background、impact、riskOrOpportunity 都要写成适合 Markdown 渲染的完整段落，不要只写短句。',
    '5. trendJudgments 的 judgment 也要写成完整段落，每个维度至少 2 句，能直接渲染成长文本。',
    '6. trendJudgments 必须固定输出 technology、application、policy、capital 四个维度。',
    '7. 所有 contextNewsIds 必须来自输入新闻的 id。',
    '8. relatedEventIds 必须引用 topEvents 中的 id。',
    '9. evidence 和 signals 必须来自输入 insight 中的 evidence、signals 或其直接归纳。',
    '10. executiveSummary 要像日报开头摘要，而不是单句标题补充。',
    '11. 优先利用 importanceHint、signals、entities 进行事件筛选和趋势归纳。',
    '',
    `输入 insights：${JSON.stringify(insights)}`,
  ].join('\n')
}

async function generateStructuredReport(extractedInsights) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
    input: [
      {
        role: 'user',
        content: buildReportPrompt(
          extractedInsights.map((item) => ({
            contextNewsId: item.contextNewsId,
            title: item.title,
            sourceName: item.sourceName,
            publishedAt: item.publishedAt,
            summary: item.summary,
            category: item.category,
            entities: item.entities,
            signals: item.signals,
            importanceHint: item.importanceHint,
            evidence: item.evidence,
          })),
        ),
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'daily_ai_news_report',
        strict: true,
        schema: DAILY_REPORT_JSON_SCHEMA,
      },
    },
  })

  const rawText = response.output_text?.trim()

  if (!rawText) {
    throw new Error('Responses API returned an empty structured report.')
  }

  const parsed = JSON.parse(rawText)
  return dailyReportSchema.parse(parsed)
}

export async function generateDashboardPayload(rawItems) {
  if (!process.env.OPENAI_API_KEY) {
    return createFallbackDashboardPayload(rawItems)
  }

  try {
    const { extractedInsights } = await generateInsights(rawItems)
    const report = await generateStructuredReport(extractedInsights)
    return createDashboardPayloadFromStructuredReport(rawItems, report, extractedInsights)
  } catch (error) {
    console.warn('Falling back to rule-based report generation:', error.message)
    return createFallbackDashboardPayload(rawItems)
  }
}
