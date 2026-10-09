import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Small, safe Markdown renderer for AI answers (no HTML injection):
 * headings, paragraphs, ordered / bulleted lists (one level of nesting), blockquotes, code blocks,
 * horizontal rules, simple tables, **bold**, *italic*, `code`, and [links](https://…).
 */
export function Markdown({ text, streaming }: { text: string; streaming?: boolean }) {
  const blocks = parseBlocks(text)
  return (
    <div className="md space-y-3 break-words">
      {blocks.map((b, i) => <Block key={i} b={b} last={streaming && i === blocks.length - 1} />)}
      {streaming && !blocks.length && <Caret />}
    </div>
  )
}

const Caret = () => <span className="ml-0.5 inline-block h-[1.05em] w-[7px] translate-y-[3px] animate-blink rounded-sm bg-ink/70" aria-hidden />

type B =
  | { k: 'h'; level: number; text: string }
  | { k: 'p'; text: string }
  | { k: 'ul' | 'ol'; items: { text: string; sub: string[] }[]; start: number }
  | { k: 'quote'; text: string }
  | { k: 'code'; text: string; lang: string }
  | { k: 'hr' }
  | { k: 'table'; head: string[]; rows: string[][] }

function parseBlocks(src: string): B[] {
  const lines = src.replace(/\r/g, '').split('\n')
  const out: B[] = []
  let i = 0
  const isList = (l: string) => /^\s*([-*•]|\d+[.)])\s+/.test(l)
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    const fence = line.match(/^\s*```(\w*)/)
    if (fence) {
      const buf: string[] = []; i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++])
      i++
      out.push({ k: 'code', text: buf.join('\n'), lang: fence[1] }); continue
    }
    const h = line.match(/^\s*(#{1,6})\s+(.*)$/)
    if (h) { out.push({ k: 'h', level: h[1].length, text: h[2].replace(/#+\s*$/, '') }); i++; continue }
    if (/^\s*(-\s*){3,}$|^\s*(\*\s*){3,}$|^\s*(_\s*){3,}$/.test(line)) { out.push({ k: 'hr' }); i++; continue }
    if (/^\s*>/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''))
      out.push({ k: 'quote', text: buf.join('\n') }); continue
    }
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const head = cells(line); i += 2
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]))
      out.push({ k: 'table', head, rows }); continue
    }
    if (isList(line)) {
      const ordered = /^\s*\d+[.)]/.test(line)
      const start = ordered ? parseInt(line.trim(), 10) || 1 : 1
      const items: { text: string; sub: string[] }[] = []
      const baseIndent = line.match(/^\s*/)![0].length
      while (i < lines.length && (isList(lines[i]) || (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length))) {
        const l = lines[i]
        const indent = l.match(/^\s*/)![0].length
        if (isList(l) && indent <= baseIndent + 1) items.push({ text: l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''), sub: [] })
        else if (isList(l)) items[items.length - 1].sub.push(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''))
        else items[items.length - 1].text += ' ' + l.trim()
        i++
        if (i < lines.length && !lines[i].trim() && i + 1 < lines.length && isList(lines[i + 1]) && /^\s*\d+[.)]/.test(lines[i + 1]) === ordered) i++
      }
      out.push({ k: ordered ? 'ol' : 'ul', items, start }); continue
    }
    const buf: string[] = []
    while (i < lines.length && lines[i].trim() && !isList(lines[i]) && !/^\s*(#{1,6}\s|```|>)/.test(lines[i])) buf.push(lines[i++])
    out.push({ k: 'p', text: buf.join('\n') })
  }
  return out
}

function Block({ b, last }: { b: B; last?: boolean }) {
  const c = last ? <Caret /> : null
  switch (b.k) {
    case 'h': {
      const cls = b.level <= 2 ? 'text-[18px] font-extrabold tracking-[-0.01em]' : 'text-[16px] font-bold'
      return <p role="heading" aria-level={Math.min(b.level + 1, 6)} className={`${cls} pt-1 text-ink`}>{inline(b.text)}{c}</p>
    }
    case 'p': return <p className="whitespace-pre-line">{inline(b.text)}{c}</p>
    case 'quote': return <blockquote className="border-l-4 border-lime-400 bg-lime-50/60 py-1.5 pl-3 pr-2 text-slate-700">{inline(b.text)}{c}</blockquote>
    case 'hr': return <hr className="border-line" />
    case 'code': return <pre className="overflow-x-auto rounded-2xl bg-ink p-3 text-[13px] leading-relaxed text-lime-100"><code>{b.text}</code>{c}</pre>
    case 'table': return (
      <div className="overflow-x-auto rounded-2xl ring-1 ring-line">
        <table className="w-full text-left text-[14px]">
          <thead className="bg-canvas"><tr>{b.head.map((h, i) => <th key={i} className="px-3 py-2 font-bold text-ink">{inline(h)}</th>)}</tr></thead>
          <tbody>{b.rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((x, j) => <td key={j} className="px-3 py-2 align-top">{inline(x)}</td>)}</tr>)}</tbody>
        </table>{c}
      </div>
    )
    case 'ul':
    case 'ol': {
      const Tag = b.k
      return (
        <Tag start={b.k === 'ol' ? b.start : undefined} className={`${b.k === 'ol' ? 'list-decimal' : 'list-disc'} space-y-1.5 pl-5 marker:font-bold marker:text-brand-600`}>
          {b.items.map((it, i) => (
            <li key={i} className="pl-1">
              {inline(it.text)}
              {it.sub.length > 0 && <ul className="mt-1 list-[circle] space-y-1 pl-5">{it.sub.map((s, j) => <li key={j}>{inline(s)}</li>)}</ul>}
              {last && i === b.items.length - 1 && c}
            </li>
          ))}
        </Tag>
      )
    }
  }
}

/** Inline formatting: `code`, **bold**, *italic* / _italic_, [text](url). */
function inline(text: string): ReactNode {
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))/g
  const out: ReactNode[] = []
  let last = 0; let m: RegExpExecArray | null; let n = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const t = m[0]
    if (m[1]) out.push(<code key={n++} className="rounded-md bg-canvas px-1.5 py-0.5 text-[0.9em] text-ink ring-1 ring-line">{t.slice(1, -1)}</code>)
    else if (m[2]) out.push(<strong key={n++} className="font-semibold text-ink">{inline(t.slice(2, -2))}</strong>)
    else if (m[3]) out.push(<em key={n++}>{inline(t.slice(1, -1))}</em>)
    else if (m[4]) {
      const [, label, href] = t.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!
      if (/^https?:\/\//i.test(href)) out.push(<a key={n++} href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline underline-offset-2">{label}</a>)
      else if (/^#?\//.test(href)) out.push(<Link key={n++} to={href.replace(/^#/, '')} className="font-semibold text-brand-700 underline underline-offset-2">{label}</Link>)
      else out.push(label)
    }
    last = m.index + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out.map((x, i) => <Fragment key={i}>{x}</Fragment>)
}
