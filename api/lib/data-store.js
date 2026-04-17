import fs from 'node:fs/promises'
import path from 'node:path'
import { createFallbackDashboardPayload } from '../../shared/report-builder.js'

const dashboardFile = path.join(process.cwd(), 'data', 'report', 'dashboard.json')
const rawFile = path.join(process.cwd(), 'data', 'raw', 'releases.json')

export async function loadDashboardPayload() {
  try {
    const dashboard = JSON.parse(await fs.readFile(dashboardFile, 'utf8'))
    return dashboard
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }

  const raw = JSON.parse(await fs.readFile(rawFile, 'utf8'))
  return createFallbackDashboardPayload(raw.items || [])
}
