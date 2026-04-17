function groupBy(items, getKey) {
  return items.reduce((groups, item) => {
    const key = getKey(item)
    groups[key] ??= []
    groups[key].push(item)
    return groups
  }, {})
}

function sanitizeIdList(ids = []) {
  return ids
    .map((value) => String(value).trim().replace(/[，,。；;]+$/g, ''))
    .filter(Boolean)
}

function splitBody(body = '') {
  const lines = body
    .split('\n')
    .map((line) => line.replace(/^[-*#>\s]+/, '').trim())
    .filter(Boolean)

  return {
    description: lines[0] || '',
    content: lines.slice(1).join(' '),
    evidence: lines.slice(0, 3),
  }
}

function normalizeDimension(text) {
  const lower = text.toLowerCase()

  if (['funding', 'investment', 'series a', 'series b', 'capital', 'valuation', 'raised $'].some((token) => lower.includes(token))) {
    return 'capital'
  }

  if (['policy', 'regulation', 'government', 'law', 'compliance', 'copyright'].some((token) => lower.includes(token))) {
    return 'policy'
  }

  if (['agent', 'assistant', 'copilot', 'workspace', 'robot', 'product', 'app', 'client'].some((token) => lower.includes(token))) {
    return 'application'
  }

  return 'technology'
}

function importanceFrom(item, description) {
  const lower = `${item.title}\n${description}\n${item.body}`.toLowerCase()
  let score = 2.5

  if (['funding', 'raises', 'launches', 'ships', 'release', 'general availability', 'breakthrough'].some((token) => lower.includes(token))) {
    score += 0.8
  }

  if (['openai', 'anthropic', 'google', 'meta', 'microsoft', 'nvidia'].some((token) => lower.includes(token))) {
    score += 0.8
  }

  const ageDays = Math.max(
    0,
    (Date.now() - new Date(item.publishedAt).getTime()) / (1000 * 60 * 60 * 24),
  )

  if (ageDays <= 2) {
    score += 0.6
  }

  return Math.max(1, Math.min(5, Math.round(score)))
}

function buildNormalizedNewsItem(item, index) {
  const { description, content, evidence } = splitBody(item.body || '')

  return {
    id: item.id,
    contextId: `news_${index + 1}`,
    title: item.title || 'Untitled article',
    source: item.repo || 'Unknown Source',
    publishedAt: item.publishedAt || '',
    url: item.url || '',
    description,
    content,
    evidence,
  }
}

function deriveEntityCandidates(item) {
  const text = `${item.title}\n${item.description}\n${item.content}`.trim()
  const matches = text.match(/\b([A-Z][A-Za-z0-9.+-]*(?:\s+[A-Z][A-Za-z0-9.+-]*){0,2})\b/g) || []

  return [...new Set(matches)]
    .filter((value) => value.length > 1)
    .filter((value) => !['The', 'And', 'For', 'With', 'This', 'That'].includes(value))
    .slice(0, 5)
}

function deriveSignals(item, category) {
  const text = `${item.title}\n${item.description}\n${item.content}`.toLowerCase()
  const signals = []

  if (text.includes('funding') || text.includes('raised') || text.includes('valuation')) {
    signals.push('资本持续关注 AI 赛道融资与估值')
  }
  if (text.includes('agent') || text.includes('assistant') || text.includes('copilot')) {
    signals.push('Agent 与助手形态继续向具体场景渗透')
  }
  if (text.includes('regulation') || text.includes('policy') || text.includes('government')) {
    signals.push('政策和监管因素正在影响 AI 发展节奏')
  }
  if (text.includes('model') || text.includes('inference') || text.includes('compute') || text.includes('chip')) {
    signals.push('模型能力与基础设施仍是技术主线')
  }
  if (text.includes('enterprise') || text.includes('workflow') || text.includes('productivity')) {
    signals.push('企业应用和工作流集成成为落地方向')
  }

  if (!signals.length) {
    signals.push(
      category === 'capital'
        ? '资本方向仍需继续关注后续融资与商业化信号'
        : category === 'policy'
          ? '政策方向需要结合后续监管动作持续跟踪'
          : category === 'application'
            ? '应用方向的产品化与场景落地仍是观察重点'
            : '技术方向的迭代与基础设施升级仍是观察重点',
    )
  }

  return signals.slice(0, 4)
}

function attachInsightMetadata(rawNewsItems, insights) {
  const newsIndex = new Map(rawNewsItems.map((item) => [item.contextId, item]))

  return insights
    .map((insight) => {
      const news = newsIndex.get(insight.contextNewsId)

      if (!news) {
        return null
      }

      return {
        ...insight,
        title: news.title,
        sourceName: news.source,
        publishedAt: news.publishedAt,
        url: news.url,
        description: news.description,
      }
    })
    .filter(Boolean)
}

export function createFallbackInsights(rawItems) {
  const rawNewsItems = buildNormalizedNewsItems(rawItems)
  const insights = rawNewsItems.map((item) => {
    const combined = `${item.title}\n${item.description}\n${item.content}`
    const category = normalizeDimension(combined)
    const importanceHint = importanceFrom(item, item.description)
    const summary = item.description
      ? `${item.description} 这条新闻可以视为今日 AI 议题中的一个代表性样本，既包含明确事件，也能反映更大的行业变化。`
      : `${item.title} 反映了当前 AI 领域的一个重要变化点，适合纳入后续日报分析。`

    return {
      contextNewsId: item.contextId,
      summary,
      category,
      entities: deriveEntityCandidates(item),
      signals: deriveSignals(item, category),
      importanceHint,
      evidence: item.evidence.slice(0, 3),
    }
  })

  return attachInsightMetadata(rawNewsItems, insights)
}

function buildFallbackTopEvent(newsItem, index) {
  const combined = `${newsItem.title}\n${newsItem.description}\n${newsItem.content}`
  const category = normalizeDimension(combined)
  const importanceScore = importanceFrom(newsItem, newsItem.description)

  return {
    id: `event_${index + 1}`,
    title: newsItem.title,
    summary:
      newsItem.description
        ? `${newsItem.description} 结合当前新闻源与发布时间看，这条动态代表了最近 AI 领域里一个较清晰的变化点，既有具体事件，也有后续延展空间。`
        : `${newsItem.source} 报道了一条 AI 相关新闻。当前可确认的是，它并非孤立噪音，而是可以纳入当日日报重点观察范围的事件。`,
    whyImportant: `这条新闻属于 ${category} 方向。综合考虑话题热度、时间新鲜度与主体影响力，重要度评估为 ${importanceScore}/5。它之所以值得放进日报，是因为它能直接反映技术、产品或资本层面的阶段性变化，而不只是一次普通信息更新。`,
    category,
    contextNewsIds: [newsItem.contextId],
    evidence: newsItem.evidence.slice(0, 2),
    sourceNames: [newsItem.source],
    sourceUrls: newsItem.url ? [newsItem.url] : [],
    importanceScore,
  }
}

function buildFallbackDeepDive(event, newsIndex) {
  const related = event.contextNewsIds
    .map((contextId) => newsIndex.get(contextId))
    .filter(Boolean)

  const news = related[0]

  return {
    eventId: event.id,
    title: event.title,
    background:
      news?.description
        ? `${news.description} 从背景上看，这条新闻对应的是近期 AI 行业里一个正在加速的主题，因此不只适合作为单点信息阅读，也适合作为趋势样本来理解。`
        : event.summary,
    impact: `${event.whyImportant} 如果后续同类消息持续增加，它很可能进一步影响技术路线、产品节奏或市场关注点。`,
    riskOrOpportunity:
      event.category === 'capital'
        ? '这更偏资本机会信号，可继续关注商业化效率、融资节奏与基础设施落地。如果后续缺乏真实需求承接，也要警惕“融资热度高于实际落地”的偏差。'
        : event.category === 'policy'
          ? '这更偏政策约束信号，需要继续关注合规、版权与监管变化。政策信号一旦持续强化，往往会直接影响模型上线、数据使用与商业化边界。'
          : '这更偏技术或应用机会信号，适合继续跟踪产品化和生态扩散。但如果后续只停留在概念层，没有真实用户或开发者采用，热度也可能快速回落。',
    contextNewsIds: event.contextNewsIds,
    evidence: event.evidence,
    sourceNames: event.sourceNames,
    sourceUrls: event.sourceUrls,
  }
}

function buildFallbackTrendJudgments(topEvents) {
  const grouped = groupBy(topEvents, (event) => event.category)
  const dimensions = ['technology', 'application', 'policy', 'capital']

  return dimensions.map((dimension) => {
    const items = grouped[dimension] || []
    const defaultJudgment = {
      technology: '今天的技术向新闻主要围绕模型、基础设施或推理能力升级。',
      application: '今天的应用向新闻主要围绕产品功能、Agent 场景或用户体验演进。',
      policy: '今天的政策向新闻较少，说明监管议题不是今日主导变量。',
      capital: '今天的资本向新闻较少，说明融资与商业化信息不是今日绝对主线。',
    }[dimension]

      return {
      dimension,
      judgment:
        items.length > 0
          ? `${dimension} 方向出现 ${items.length} 条高相关信号，核心事件包括 ${items.slice(0, 2).map((item) => item.title).join('、')}。这些新闻共同说明，该方向并非单点波动，而是正在形成更连续的行业观察线索。`
          : defaultJudgment,
      signals: items.slice(0, 3).map((item) => item.summary).filter(Boolean),
      relatedEventIds: items.map((item) => item.id),
      contextNewsIds: [...new Set(items.flatMap((item) => item.contextNewsIds || []))],
    }
  })
}

function buildMarkdown(payload) {
  const topSection = payload.topEvents
    .map(
      (event, index) =>
        `${index + 1}. **${event.title}**\n   - 摘要：${event.summary}\n   - 为什么重要：${event.whyImportant}`,
    )
    .join('\n')

  const deepDives = payload.deepDives
    .map(
      (item) =>
        `### ${item.title}\n- 背景：${item.background}\n- 影响：${item.impact}\n- 风险/机会：${item.riskOrOpportunity}\n`,
    )
    .join('\n')

  const trends = payload.trendJudgments
    .map((item) => `- **${item.dimension}**：${item.judgment}`)
    .join('\n')

  return [
    `# ${payload.reportTitle}`,
    '',
    `> 生成时间：${new Date(payload.generatedAt).toLocaleString('zh-CN')}`,
    '',
    payload.executiveSummary,
    '',
    '## 今日AI领域主要热点',
    topSection,
    '',
    '## 重要事件深度总结',
    deepDives,
    '## 趋势判断',
    trends,
  ].join('\n')
}

function enrichReport(report, rawNewsItems) {
  const newsIndex = new Map(rawNewsItems.map((item) => [item.contextId, item]))

  const enrichWithSources = (entity) => {
    const contextNewsIds = sanitizeIdList(entity.contextNewsIds)
    const relatedNews = contextNewsIds
      .map((contextId) => newsIndex.get(contextId))
      .filter(Boolean)

    return {
      ...entity,
      contextNewsIds,
      sourceNames: [...new Set(relatedNews.map((item) => item.source))],
      sourceUrls: [...new Set(relatedNews.map((item) => item.url).filter(Boolean))],
      contextNews: relatedNews,
    }
  }

  const topEvents = (report.topEvents || []).map(enrichWithSources)
  const eventIndex = new Map(topEvents.map((item) => [item.id, item]))
  const deepDives = (report.deepDives || []).map(enrichWithSources)
  const trendJudgments = (report.trendJudgments || []).map((item) => {
    const relatedEventIds = sanitizeIdList(item.relatedEventIds)
    const relatedEvents = relatedEventIds
      .map((eventId) => eventIndex.get(eventId))
      .filter(Boolean)

    return {
      ...item,
      relatedEventIds,
      contextNewsIds: [...new Set(relatedEvents.flatMap((event) => event.contextNewsIds || []))],
    }
  })

  const payload = {
    ...report,
    topEvents,
    deepDives,
    trendJudgments,
    rawNewsItems,
  }

  payload.markdown = buildMarkdown(payload)
  return payload
}

export function buildNormalizedNewsItems(rawItems) {
  return rawItems.map(buildNormalizedNewsItem)
}

export function createFallbackDashboardPayload(rawItems) {
  const rawNewsItems = buildNormalizedNewsItems(rawItems)
  const extractedInsights = createFallbackInsights(rawItems)
  const topEvents = rawNewsItems
    .slice()
    .sort((left, right) => importanceFrom(right, right.description) - importanceFrom(left, left.description))
    .slice(0, 5)
    .map(buildFallbackTopEvent)

  const newsIndex = new Map(rawNewsItems.map((item) => [item.contextId, item]))

  const payload = {
    generatedAt: new Date().toISOString(),
    reportTitle: 'AI 新闻日报',
    executiveSummary: '当前日报由规则回退路径生成，重点关注最近 15 条 AI 新闻中的高相关事件、影响分析与趋势信号。',
    topEvents,
    deepDives: topEvents.slice(0, 3).map((event) => buildFallbackDeepDive(event, newsIndex)),
    trendJudgments: buildFallbackTrendJudgments(topEvents),
    source: {
      type: 'NewsAPI /v2/everything',
      mode: 'snapshot-first',
      description: '以 NewsAPI 作为唯一新闻源，先生成快照再进行结构化分析与日报渲染。',
    },
    itemCount: rawNewsItems.length,
    extractedInsights,
  }

  return enrichReport(payload, rawNewsItems)
}

export function createDashboardPayloadFromStructuredReport(rawItems, report, extractedInsights = []) {
  const rawNewsItems = buildNormalizedNewsItems(rawItems)
  const payload = {
    ...report,
    source: {
      type: 'NewsAPI /v2/everything',
      mode: 'snapshot-first',
      description: '以 NewsAPI 作为唯一新闻源，先生成快照，再由 OpenAI Responses API 生成结构化日报。',
    },
    itemCount: rawNewsItems.length,
    extractedInsights: attachInsightMetadata(rawNewsItems, extractedInsights),
  }

  return enrichReport(payload, rawNewsItems)
}
