import { useSetAtom } from 'jotai'
import ReactMarkdown from 'react-markdown'
// import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { openAssistantForContextAtom } from '../atoms/report-atoms.js'

const CATEGORY_LABELS = {
  technology: '技术',
  application: '应用',
  policy: '政策',
  capital: '资本',
}

function renderDeepDiveMarkdown(items) {
  return items
    .map(
      (item) =>
        `### ${item.title}

**背景**  
${item.background}

**影响**  
${item.impact}

**风险 / 机会**  
${item.riskOrOpportunity}`,
    )
    .join('\n\n')
}

function renderTrendMarkdown(items) {
  return items
    .map(
      (item) =>
        `### ${CATEGORY_LABELS[item.dimension] || item.dimension}

${item.judgment}

${item.signals?.length ? `- 关键信号：${item.signals.join('；')}` : ''}`,
    )
    .join('\n\n')
}

function buildContext(kind, selectedItem, dashboard) {
  const contextNewsIds = selectedItem?.contextNewsIds || []
  const contextNews = selectedItem
    ? (dashboard.rawNewsItems || []).filter((item) => contextNewsIds.includes(item.contextId))
    : dashboard.rawNewsItems || []

  return {
    kind,
    selectedItem,
    reportDate: dashboard.generatedAt,
    reportTitle: dashboard.reportTitle,
    executiveSummary: dashboard.executiveSummary,
    topEvents: dashboard.topEvents,
    deepDives: dashboard.deepDives,
    trendJudgments: dashboard.trendJudgments,
    contextNews,
    markdown: dashboard.markdown,
  }
}

function AskAiButton({ context }) {
  const openAssistantForContext = useSetAtom(openAssistantForContextAtom)

  return (
    <button
      className="control-pill-sm type-button"
      onClick={() => openAssistantForContext(context)}
      type="button"
    >
      问AI
    </button>
  )
}

export function ReportColumn({ dashboard, error, isLoading }) {
  if (isLoading) {
    return (
      <section className="report-column">
        <header className="report-header">
          <p className="type-section-title">正在生成日报视图</p>
        </header>
      </section>
    )
  }

  if (error) {
    return (
      <section className="report-column">
        <header className="report-header">
          <p className="type-section-title">数据加载失败</p>
          <p className="type-body">{error}</p>
        </header>
      </section>
    )
  }

  if (!dashboard) {
    return null
  }

  const reportContext = buildContext('report', null, dashboard)
  const deepDiveMarkdown = renderDeepDiveMarkdown(dashboard.deepDives || [])
  const trendMarkdown = renderTrendMarkdown(dashboard.trendJudgments || [])

  return (
    <section className="report-column">
      <header className="report-header">
        <div>
          {/* <p className="type-micro report-eyebrow">Daily AI Insight Engine</p> */}
          <h1 className="type-hero-title">AI 新闻日报</h1>
          <p className="type-body report-subtitle">
            {dashboard.executiveSummary || `唯一消息源为 NewsAPI，当前展示 ${dashboard.itemCount} 条近期 AI 相关新闻。`}
          </p>
        </div>
        <AskAiButton context={reportContext} />
      </header>

      <div className="report-scroll">
        <section className="report-section">
          <div className="section-title-row">
            <h2 className="type-panel-title">今日AI领域主要热点</h2>
          </div>

          <div className="stack-list">
            {dashboard.topEvents.map((event, index) => (
              <article className="report-item" key={event.id}>
                <div className="report-item-main">
                  <p className="type-micro">Top {index + 1}</p>
                  <h3 className="type-item-title">{event.title}</h3>
                  <p className="type-body">{event.summary}</p>
                  <p className="type-body"><strong>为什么重要：</strong>{event.whyImportant}</p>
                  <div className="meta-row">
                    {(event.sourceNames || []).slice(0, 2).map((sourceName) => (
                      <span className="compact-outline-pill" key={`${event.id}-${sourceName}`}>
                        {sourceName}
                      </span>
                    ))}
                    <span className="compact-outline-pill">{CATEGORY_LABELS[event.category] || event.category}</span>
                  </div>
                </div>
                <div className="report-item-actions">
                  {event.sourceUrls?.[0] ? (
                    <a
                      className="control-pill-sm type-button link-pill"
                      href={event.sourceUrls[0]}
                      rel="noreferrer"
                      target="_blank"
                    >
                      原文链接
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="report-section">
          <div className="section-title-row">
            <h2 className="type-panel-title">重要事件深度总结</h2>
          </div>

          <div className="markdown-section type-body">
            <ReactMarkdown>{deepDiveMarkdown}</ReactMarkdown>
          </div>
        </section>

        <section className="report-section">
          <div className="section-title-row">
            <h2 className="type-panel-title">趋势判断</h2>
          </div>

          <div className="markdown-section type-body">
            <ReactMarkdown>{trendMarkdown}</ReactMarkdown>
          </div>
        </section>

        {/* <section className="report-section">
          <div className="section-title-row">
            <h2 className="type-panel-title">可视化概览</h2>
          </div>
          <div className="chart-grid">
            <div className="chart-card">
              <p className="type-section-title">Category 分布</p>
              <div className="chart-shell">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.categoryBreakdown} margin={{ left: -20, top: 16, right: 12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="rgba(10,19,23,0.08)" />
                    <XAxis dataKey="category" stroke="rgba(10,19,23,0.48)" tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(10,19,23,0.48)" tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0a1317" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="chart-card">
              <p className="type-section-title">Repo 更新分布</p>
              <div className="chart-shell">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.sourceBreakdown} layout="vertical" margin={{ left: 16, top: 16, right: 16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="rgba(10,19,23,0.08)" />
                    <XAxis type="number" stroke="rgba(10,19,23,0.48)" tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis
                      dataKey="repo"
                      type="category"
                      width={124}
                      stroke="rgba(10,19,23,0.48)"
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0a1317" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section> */}
      </div>
    </section>
  )
}
