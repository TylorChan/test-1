import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'

const configFile = path.join(process.cwd(), 'config', 'news-query.json')

function parseArgs(argv) {
  const parsed = {
    addDomains: [],
    excludeDomains: [],
    from: null,
    to: null,
    clearFrom: false,
    clearTo: false,
    runPipeline: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    const next = argv[index + 1]

    if (token === '--add-domain' && next) {
      parsed.addDomains.push(...next.split(','))
      index += 1
      continue
    }

    if (token === '--exclude-domain' && next) {
      parsed.excludeDomains.push(...next.split(','))
      index += 1
      continue
    }

    if (token === '--from' && next) {
      parsed.from = next
      index += 1
      continue
    }

    if (token === '--to' && next) {
      parsed.to = next
      index += 1
      continue
    }

    if (token === '--run-pipeline') {
      parsed.runPipeline = true
    }

    if (token === '--clear-from') {
      parsed.clearFrom = true
    }

    if (token === '--clear-to') {
      parsed.clearTo = true
    }
  }

  return parsed
}

function normalizeDomainList(value) {
  return [...new Set((value || []).map((item) => String(item).trim().toLowerCase()).filter(Boolean))]
}

function assertIsoDate(value, label) {
  if (!value) {
    return
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date string. Received: ${value}`)
  }
}

async function runPipeline() {
  await new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'pipeline'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`npm run pipeline exited with code ${code}`))
    })
  })
}

async function updateNewsQuery() {
  const args = parseArgs(process.argv.slice(2))
  assertIsoDate(args.from, 'from')
  assertIsoDate(args.to, 'to')

  const config = JSON.parse(await fs.readFile(configFile, 'utf8'))
  const nextDomains = new Set(normalizeDomainList(config.domains))
  const nextExcludeDomains = new Set(normalizeDomainList(config.excludeDomains))

  for (const domain of normalizeDomainList(args.addDomains)) {
    nextDomains.add(domain)
    nextExcludeDomains.delete(domain)
  }

  for (const domain of normalizeDomainList(args.excludeDomains)) {
    nextExcludeDomains.add(domain)
    nextDomains.delete(domain)
  }

  config.domains = [...nextDomains]
  config.excludeDomains = [...nextExcludeDomains]

  if (args.clearFrom) {
    config.from = ''
  } else if (args.from !== null) {
    config.from = args.from
  }

  if (args.clearTo) {
    config.to = ''
  } else if (args.to !== null) {
    config.to = args.to
  }

  await fs.writeFile(configFile, JSON.stringify(config, null, 2) + '\n')

  console.log(`Updated ${configFile}`)
  console.log(`domains: ${config.domains.join(', ') || '(empty)'}`)
  console.log(`excludeDomains: ${config.excludeDomains.join(', ') || '(empty)'}`)
  console.log(`from: ${config.from || '(auto from lookbackDays)'}`)
  console.log(`to: ${config.to || '(none)'}`)

  if (args.runPipeline) {
    await runPipeline()
  }
}

updateNewsQuery().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
