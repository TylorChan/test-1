export async function fetchDashboardPayload() {
  const response = await fetch('/api/dashboard')
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch dashboard payload.')
  }

  return data
}

export async function streamAssistantReply(payload, handlers = {}) {
  const response = await fetch('/api/chat', {
    body: JSON.stringify(payload),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to start assistant stream.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() || ''

    for (const eventChunk of events) {
      const dataLine = eventChunk
        .split('\n')
        .find((line) => line.startsWith('data:'))

      if (!dataLine) {
        continue
      }

      const payload = JSON.parse(dataLine.slice(5).trim())

      if (payload.type === 'delta') {
        handlers.onDelta?.(payload.delta)
      }

      if (payload.type === 'error') {
        throw new Error(payload.error || 'Assistant stream failed.')
      }
    }
  }
}
