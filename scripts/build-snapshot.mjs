import '../lib/load-env.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import { URLSearchParams } from 'node:url'

const queryFile = path.join(process.cwd(), 'config', 'news-query.json')
const outputFile = path.join(process.cwd(), 'data', 'raw', 'releases.json')
const endpoint = 'https://newsapi.org/v2/everything'

function getNewsApiKey() {
  return (process.env.NEWS_API_KEY || process.env.NEWS_API || '').trim()
}

function normalizeDomainList(value) {
  if (!value) {
    return []
  }

  const values = Array.isArray(value) ? value : String(value).split(',')

  return [...new Set(values.map((item) => String(item).trim()).filter(Boolean))]
}

function isoDateDaysAgo(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString()
}

function normalizeArticle(article, index) {
  const sourceName = article.source?.name || article.source?.id || 'Unknown Source'
  const body = [article.description, article.content].filter(Boolean).join('\n').trim()

  return {
    id: article.url || `${sourceName}:${article.publishedAt || index}:${article.title || 'untitled'}`,
    repo: sourceName,
    source: 'newsapi_article',
    title: article.title || 'Untitled article',
    tagName: '',
    body: body.slice(0, 6000),
    url: article.url || '',
    publishedAt: article.publishedAt || '',
    author: article.author || '',
  }
}

export async function buildSnapshot() {
  const newsApiKey = getNewsApiKey()

  if (!newsApiKey) {
    throw new Error('Missing NewsAPI key. Set NEWS_API_KEY or NEWS_API before running the snapshot pipeline.')
  }

  const config = JSON.parse(await fs.readFile(queryFile, 'utf8'))
  const params = new URLSearchParams({
    q: config.query,
    searchIn: config.searchIn,
    language: config.language,
    sortBy: config.sortBy,
    pageSize: String(config.pageSize),
  })

  const domains = normalizeDomainList(config.domains)
  const excludeDomains = normalizeDomainList(config.excludeDomains)
  const from = config.from?.trim() || isoDateDaysAgo(config.lookbackDays)
  const to = config.to?.trim() || ''

  params.set('from', from)

  if (to) {
    params.set('to', to)
  }

  if (domains.length) {
    params.set('domains', domains.join(','))
  }

  if (excludeDomains.length) {
    params.set('excludeDomains', excludeDomains.join(','))
  }

  const response = await fetch(`${endpoint}?${params.toString()}`, {
    headers: {
      'X-Api-Key': newsApiKey,
    },
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok || payload.status !== 'ok') {
    throw new Error(payload.message || `NewsAPI request failed with status ${response.status}`)
  }

  const sorted = (payload.articles || [])
    .map(normalizeArticle)
    .sort((left, right) => new Date(right.publishedAt) - new Date(left.publishedAt))
    .slice(0, config.pageSize)

  if (!sorted.length) {
    throw new Error('NewsAPI snapshot build produced 0 articles. Adjust the query or lookback window.')
  }

  await fs.mkdir(path.dirname(outputFile), { recursive: true })
  await fs.writeFile(
    outputFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        itemCount: sorted.length,
        source: 'newsapi_everything',
        itemSource: 'newsapi_article',
        items: sorted,
      },
      null,
      2,
    ),
  )

  console.log(`Wrote ${sorted.length} AI news articles to ${outputFile} via NewsAPI`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildSnapshot().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
