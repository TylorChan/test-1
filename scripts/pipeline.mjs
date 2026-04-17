import { buildSnapshot } from './build-snapshot.mjs'
import { buildReportArtifacts } from './build-report.mjs'

async function main() {
  await buildSnapshot()
  await buildReportArtifacts()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
