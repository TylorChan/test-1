import OpenAI from 'openai'

function extractText(response) {
  if (response.output_text) {
    return response.output_text
  }

  const textParts = []

  for (const item of response.output || []) {
    for (const part of item.content || []) {
      if (part.type === 'output_text' && part.text) {
        textParts.push(part.text)
      }
    }
  }

  return textParts.join('\n').trim()
}

function buildFallbackAnswer(context, prompt) {
  const selected = context?.selectedItem
  const topTitles = (context?.topEvents || []).slice(0, 3).map((item) => item.title)
  const trendLabels = (context?.trendJudgments || []).slice(0, 4).map((item) => item.dimension)
  const contextNews = context?.contextNews || []

  return [
    `### 结论`,
    selected
      ? `当前追问聚焦 **${selected.title || selected.dimension}**。结合日报上下文，这条动态属于 **${selected.category || selected.dimension || 'technology'}** 方向。`
      : '当前问题将基于当日日报的整体上下文回答。',
    '',
    `### 支撑信息`,
    selected?.summary || selected?.background
      ? `- 事件摘要：${selected.summary || selected.background}`
      : `- 今日热点集中在：${topTitles.join('、') || 'AI 工具链与 Agent 生态更新'}`,
    selected?.whyImportant || selected?.impact
      ? `- 影响分析：${selected.whyImportant || selected.impact}`
      : `- 主要趋势标签：${trendLabels.join('、') || 'technology、application、policy、capital'}`,
    selected?.evidence?.length
      ? `- 原始证据：${selected.evidence.join('；')}`
      : contextNews.length
        ? `- 相关原始新闻：${contextNews.map((item) => item.title).join('；')}`
        : '- 当前可用上下文来自结构化日报，而不是整站全文抓取。',
    '',
    `### 回答用户问题`,
    `针对“${prompt}”，建议从 **事件背景、影响范围、趋势信号** 三个维度理解。如果需要更细粒度分析，可以继续追问“为什么重要”或“对资本/技术方向意味着什么”。`,
  ].join('\n')
}

function buildSystemPrompt(context) {
  return [
    '你是 Daily AI Insight Engine 的日报分析助手。',
    '你只能基于当前日报上下文回答，不要编造不存在的信息。',
    '优先回答：事件背景、为什么重要、影响范围、技术/应用/资本趋势。',
    '如上下文不足，要明确说“当前日报里没有足够证据”。',
    `日报标题：${context.reportTitle || 'AI 新闻日报'}`,
    `执行摘要：${context.executiveSummary || ''}`,
    `今日热点：${(context.topEvents || []).map((item) => item.title).join(' | ')}`,
    `深度总结：${(context.deepDives || []).map((item) => item.title).join(' | ')}`,
    `趋势判断：${(context.trendJudgments || []).map((item) => `${item.dimension}:${item.judgment}`).join(' | ')}`,
  ].join('\n')
}

async function generateOpenAiAnswer(context, messages) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const prompt = messages[messages.length - 1]?.content || ''
  const response = await client.responses.create({
    input: [
      {
        role: 'system',
        content: buildSystemPrompt(context),
      },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      {
        role: 'system',
        content: `结构化上下文：${JSON.stringify(context)}`,
      },
    ],
    model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
  })

  const text = extractText(response)
  return text || buildFallbackAnswer(context, prompt)
}

export async function createAssistantAnswer(context, messages) {
  const prompt = messages[messages.length - 1]?.content || ''

  if (!process.env.OPENAI_API_KEY) {
    return buildFallbackAnswer(context, prompt)
  }

  return generateOpenAiAnswer(context, messages)
}

export async function streamText(res, text) {
  const parts = text.match(/.{1,32}(\s|$)|.{1,32}/g) || [text]

  for (const part of parts) {
    res.write(`data: ${JSON.stringify({ type: 'delta', delta: part })}\n\n`)
    await new Promise((resolve) => setTimeout(resolve, 24))
  }

  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
  res.end()
}
