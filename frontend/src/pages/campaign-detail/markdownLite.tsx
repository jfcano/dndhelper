import { type ReactNode } from 'react'

export function renderInlineBold(text: string): ReactNode {
  const parts = text.split('**')
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <strong key={i}>{p}</strong> : <span key={i}>{p}</span>))}
    </>
  )
}

export function renderMarkdownLite(md: string): ReactNode {
  const text = (md ?? '').replace(/\r\n/g, '\n').trimEnd()
  if (!text.trim()) return <div style={{ opacity: 0.75 }}>(vacío)</div>

  const lines = text.split('\n')
  const blocks: Array<
    | { kind: 'h2' | 'h3'; text: string }
    | { kind: 'ul'; items: string[] }
    | { kind: 'p'; text: string }
    | { kind: 'hr' }
  > = []

  let paragraph: string[] = []
  let listItems: string[] = []

  function flushParagraph() {
    const t = paragraph.join(' ').trim()
    if (t) blocks.push({ kind: 'p', text: t })
    paragraph = []
  }

  function flushList() {
    if (listItems.length) blocks.push({ kind: 'ul', items: listItems })
    listItems = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      flushList()
      flushParagraph()
      continue
    }

    if (trimmed === '---') {
      flushList()
      flushParagraph()
      blocks.push({ kind: 'hr' })
      continue
    }

    if (trimmed.startsWith('### ')) {
      flushList()
      flushParagraph()
      blocks.push({ kind: 'h3', text: trimmed.slice(4).trim() })
      continue
    }

    if (trimmed.startsWith('## ')) {
      flushList()
      flushParagraph()
      blocks.push({ kind: 'h2', text: trimmed.slice(3).trim() })
      continue
    }

    if (trimmed.startsWith('- ')) {
      flushParagraph()
      listItems.push(trimmed.slice(2).trim())
      continue
    }

    flushList()
    paragraph.push(trimmed)
  }

  flushList()
  flushParagraph()

  return (
    <div style={{ display: 'grid', gap: 14, lineHeight: 1.65, textAlign: 'justify' }}>
      {blocks.map((b, idx) => {
        if (b.kind === 'hr') return <hr key={`hr-${idx}`} style={{ borderColor: 'var(--border-subtle)' }} />
        if (b.kind === 'h2')
          return (
            <h2 key={`h2-${idx}`} style={{ margin: '4px 0 0', fontSize: 18, textAlign: 'left' }}>
              {renderInlineBold(b.text)}
            </h2>
          )
        if (b.kind === 'h3')
          return (
            <h3 key={`h3-${idx}`} style={{ margin: '4px 0 0', fontSize: 15, opacity: 0.95, textAlign: 'left' }}>
              {renderInlineBold(b.text)}
            </h3>
          )
        if (b.kind === 'ul')
          return (
            <div key={`ul-${idx}`} style={{ display: 'grid', gap: 8 }}>
              {b.items.map((it, j) => (
                <div
                  key={`li-${idx}-${j}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '14px 1fr',
                    gap: 10,
                    alignItems: 'start',
                    paddingLeft: 2,
                    textAlign: 'left',
                  }}
                >
                  <div style={{ opacity: 0.7, lineHeight: 1.65 }}>•</div>
                  <div style={{ opacity: 0.95 }}>{renderInlineBold(it)}</div>
                </div>
              ))}
            </div>
          )
        return (
          <p key={`p-${idx}`} style={{ margin: '2px 0', opacity: 0.95 }}>
            {renderInlineBold(b.text)}
          </p>
        )
      })}
    </div>
  )
}
