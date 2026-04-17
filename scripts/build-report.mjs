import fs from 'node:fs/promises'
import path from 'node:path'
import { generateDashboardPayload } from '../lib/report-generator.js'

const inputFile = path.join(process.cwd(), 'data', 'raw', 'releases.json')
const insightsFile = path.join(process.cwd(), 'data', 'structured', 'insights.json')
const dashboardFile = path.join(process.cwd(), 'data', 'report', 'dashboard.json')
const markdownFile = path.join(process.cwd(), 'data', 'report', 'daily-report.md')

export async function buildReportArtifacts() {
  const raw = JSON.parse(await fs.readFile(inputFile, 'utf8'))
  const payload = await generateDashboardPayload(raw.items || [])

  await fs.mkdir(path.dirname(insightsFile), { recursive: true })
  await fs.mkdir(path.dirname(dashboardFile), { recursive: true })

  await fs.writeFile(
    insightsFile,
    JSON.stringify(
      {
        generatedAt: payload.generatedAt,
        itemCount: payload.itemCount,
        rawNewsItems: payload.rawNewsItems,
        extractedInsights: payload.extractedInsights || [],
        report: {
          reportTitle: payload.reportTitle,
          executiveSummary: payload.executiveSummary,
          topEvents: payload.topEvents,
          deepDives: payload.deepDives,
          trendJudgments: payload.trendJudgments,
        },
      },
      null,
      2,
    ),
  )
  await fs.writeFile(dashboardFile, JSON.stringify(payload, null, 2))
  await fs.writeFile(markdownFile, payload.markdown)

  console.log(`Wrote dashboard artifacts to ${path.dirname(dashboardFile)}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildReportArtifacts().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
