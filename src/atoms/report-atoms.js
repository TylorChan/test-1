import { atom } from 'jotai'
import { fetchDashboardPayload, streamAssistantReply } from '../services/dashboard-api.js'

export const dashboardAtom = atom(null)
export const dashboardLoadingAtom = atom(false)
export const dashboardErrorAtom = atom('')
export const assistantOpenAtom = atom(false)
export const selectedContextAtom = atom(null)
export const assistantMessagesAtom = atom([])
export const assistantStatusAtom = atom('idle')
export const assistantErrorAtom = atom('')

export const fetchDashboardAtom = atom(null, async (_get, set) => {
  set(dashboardLoadingAtom, true)
  set(dashboardErrorAtom, '')

  try {
    const payload = await fetchDashboardPayload()
    set(dashboardAtom, payload)
  } catch (error) {
    set(dashboardErrorAtom, error.message || '日报数据加载失败。')
  } finally {
    set(dashboardLoadingAtom, false)
  }
})

export const openAssistantForContextAtom = atom(null, (_get, set, context) => {
  set(selectedContextAtom, context)
  set(assistantMessagesAtom, [])
  set(assistantStatusAtom, 'idle')
  set(assistantErrorAtom, '')
  set(assistantOpenAtom, true)
})

export const closeAssistantAtom = atom(null, (_get, set) => {
  set(assistantOpenAtom, false)
  set(assistantStatusAtom, 'idle')
  set(assistantErrorAtom, '')
})

export const sendAssistantPromptAtom = atom(null, async (get, set, prompt) => {
  const content = prompt.trim()
  const context = get(selectedContextAtom)
  const messages = get(assistantMessagesAtom)
  const status = get(assistantStatusAtom)

  if (!content || !context || status === 'loading') {
    return
  }

  const nextMessages = [...messages, { role: 'user', content }, { role: 'assistant', content: '' }]

  set(assistantMessagesAtom, nextMessages)
  set(assistantStatusAtom, 'loading')
  set(assistantErrorAtom, '')

  try {
    await streamAssistantReply(
      {
        context,
        messages: nextMessages.filter((message) => message.role === 'user'),
      },
      {
        onDelta(delta) {
          set(assistantMessagesAtom, (current) => {
            const updated = [...current]
            const lastMessage = updated[updated.length - 1]

            if (!lastMessage || lastMessage.role !== 'assistant') {
              return current
            }

            updated[updated.length - 1] = {
              ...lastMessage,
              content: `${lastMessage.content}${delta}`,
            }

            return updated
          })
        },
      },
    )
    set(assistantStatusAtom, 'idle')
  } catch (error) {
    set(assistantStatusAtom, 'error')
    set(assistantErrorAtom, error.message || 'AI 助手回复失败。')
  }
})
