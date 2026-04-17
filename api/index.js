import '../lib/load-env.js'
import express from 'express'
import { createAssistantAnswer, streamText } from './lib/assistant.js'
import { loadDashboardPayload } from './lib/data-store.js'

const app = express()

app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'daily-ai-insight-engine' })
})

app.get('/api/dashboard', async (_req, res) => {
  try {
    const payload = await loadDashboardPayload()
    res.status(200).json(payload)
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load dashboard payload.' })
  }
})

app.post('/api/chat', async (req, res) => {
  try {
    const { context, messages } = req.body || {}

    if (!Array.isArray(messages) || !messages.length) {
      res.status(400).json({ error: 'Messages are required.' })
      return
    }

    const answer = await createAssistantAnswer(context || {}, messages)
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Content-Type', 'text/event-stream')
    await streamText(res, answer)
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to stream assistant reply.' })
      return
    }

    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Assistant failed.' })}\n\n`)
    res.end()
  }
})

export default app
