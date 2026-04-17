import { useAtomValue, useSetAtom } from 'jotai'
import ReactMarkdown from 'react-markdown'
import { RefreshGlyph } from './refresh-glyph.jsx'
import {
  assistantErrorAtom,
  assistantMessagesAtom,
  assistantStatusAtom,
  closeAssistantAtom,
  selectedContextAtom,
  sendAssistantPromptAtom,
} from '../atoms/report-atoms.js'
import { useEffect, useRef, useState } from 'react'

const STARTER_PROMPTS = ['总结风险投资', '判断趋势方向']

function MarkdownMessage({ content }) {
  return (
    <div className="type-body markdown-body">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}

export function AssistantDrawer() {
  const context = useAtomValue(selectedContextAtom)
  const messages = useAtomValue(assistantMessagesAtom)
  const status = useAtomValue(assistantStatusAtom)
  const error = useAtomValue(assistantErrorAtom)
  const closeAssistant = useSetAtom(closeAssistantAtom)
  const sendAssistantPrompt = useSetAtom(sendAssistantPromptAtom)
  const [input, setInput] = useState('')
  const viewportRef = useRef(null)

  useEffect(() => {
    if (!viewportRef.current) {
      return
    }

    viewportRef.current.scrollTop = viewportRef.current.scrollHeight
  }, [messages])

  if (!context) {
    return null
  }

  async function submitPrompt(prompt) {
    await sendAssistantPrompt(prompt)
    setInput('')
  }

  return (
    <aside className="assistant-drawer">
      <header className="assistant-header">
        <div>
          {/* <p className="type-micro report-eyebrow">AI Assistant</p> */}
          <h2 className="type-panel-title">围绕当前日报继续追问</h2>
          <p className="type-body assistant-subtitle">
            助手会基于整页日报的结构化信息回答，包括热点事件、深度总结、趋势判断，以及关联原始新闻。
          </p>
        </div>
        <button
          aria-label="关闭AI助手"
          className="icon-button"
          onClick={() => closeAssistant()}
          type="button"
        >
          ×
        </button>
      </header>

      <section className="assistant-starters">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            className="control-pill-sm type-button starter-button"
            key={prompt}
            onClick={() => submitPrompt(prompt)}
            type="button"
          >
            {prompt}
          </button>
        ))}
      </section>

      <div className="assistant-thread" ref={viewportRef}>
        {messages.length === 0 ? null : (
          messages.map((message, index) => (
            <article
              className={`message-bubble ${message.role === 'user' ? 'message-bubble--user' : ''}`}
              key={`${message.role}-${index}`}
            >
              {message.role === 'assistant' ? (
                status === 'loading' && index === messages.length - 1 && !message.content ? (
                  <div className="message-loading-shell">
                    <span className="icon-button message-loading-button" aria-hidden="true">
                      <RefreshGlyph className="refresh-glyph-spin-loop assistant-loading-glyph" />
                    </span>
                  </div>
                ) : (
                  <MarkdownMessage content={message.content} />
                )
              ) : (
                <p className="type-body message-user">{message.content}</p>
              )}
            </article>
          ))
        )}

        {error ? <p className="type-meta assistant-error">{error}</p> : null}
      </div>

      <form
        className="assistant-composer"
        onSubmit={(event) => {
          event.preventDefault()
          submitPrompt(input)
        }}
      >
        <textarea
          className="composer-input"
          onChange={(event) => setInput(event.target.value)}
          placeholder="继续追问这个日报事件…"
          value={input}
        />
        <button className="icon-button" disabled={!input.trim() || status === 'loading'} type="submit">
          {status === 'loading' ? (
            <RefreshGlyph className="refresh-glyph-spin-loop assistant-loading-glyph" />
          ) : (
            '>'
          )}
        </button>
      </form>
    </aside>
  )
}
