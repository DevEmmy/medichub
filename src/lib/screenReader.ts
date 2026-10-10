// Built-in screen reader, modelled on NVDA (computers) and TalkBack / VoiceOver (phones).
//
// Computer keyboard
//   Tab / Shift+Tab     move to the next / previous link, button or field and read it
//   Enter / Space       open the link or press the button that is being read
//   ↓ / ↑               read the next / previous thing on the page (NVDA "browse mode")
//   H / Shift+H         next / previous heading      K  next link
//   B                   next button                  F  next form field
//   Insert+↓ or Alt+Shift+R   read the whole page from here
//   Ctrl                stop talking                 Esc  stop talking
// Phone
//   Tap once            read what you touched (does not open it)
//   Double-tap          open / press the thing that was just read
//   Swipe right / left  next / previous thing on the page
//   (Scroll with a normal up/down swipe.)

export interface ReaderItem { el: HTMLElement; text: string }

const INTERACTIVE = 'a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=switch],[role=tab],[role=checkbox],[role=radio],[tabindex]:not([tabindex="-1"])'
const SKIP = '[data-no-read],[aria-hidden="true"],script,style,noscript'

const visible = (el: HTMLElement) => ((el as HTMLElement & { checkVisibility?: () => boolean }).checkVisibility?.() ?? el.getClientRects().length > 0)

export function headingLevel(el: Element): number | null {
  const m = /^H([1-6])$/.exec(el.tagName)
  if (m) return Number(m[1])
  if (el.getAttribute('role') === 'heading') return Number(el.getAttribute('aria-level') || 2)
  return null
}

function roleOf(el: HTMLElement): string {
  const r = el.getAttribute('role')
  if (r === 'switch' || (el as HTMLInputElement).type === 'checkbox' || r === 'checkbox') return 'check box'
  if (r === 'radio' || (el as HTMLInputElement).type === 'radio') return 'radio button'
  if (r === 'tab') return 'tab'
  if (r === 'link' || el.tagName === 'A') return 'link'
  if (r === 'button' || el.tagName === 'BUTTON' || el.tagName === 'SUMMARY') return 'button'
  if (el.tagName === 'SELECT') return 'combo box'
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return (el as HTMLInputElement).type === 'password' ? 'password edit' : 'edit'
  return ''
}

function labelOf(el: HTMLElement): string {
  const by = el.getAttribute('aria-labelledby')
  const fromBy = by ? by.split(/\s+/).map((id) => document.getElementById(id)?.innerText ?? '').join(' ') : ''
  const wrapLabel = el.closest('label')?.innerText
  const forLabel = el.id ? document.querySelector<HTMLElement>(`label[for="${CSS.escape(el.id)}"]`)?.innerText : ''
  const txt = el.matches('input,select,textarea') ? '' : el.innerText
  return (el.getAttribute('aria-label') || fromBy || forLabel || wrapLabel || txt || el.getAttribute('title') || (el as HTMLInputElement).placeholder || (el as HTMLImageElement).alt || '').replace(/\s+/g, ' ').trim()
}

/** What NVDA would say for this element, e.g. "Book now, button" or "Email, edit, you@example.com". */
const clean = (t: string) => t.replace(/\s+/g, ' ').trim().replace(/[.,;:!?]+$/, '')

export function describe(el: HTMLElement, fallbackText?: string): string {
  const lvl = headingLevel(el)
  if (lvl) return `${clean(fallbackText ?? el.innerText)}, heading level ${lvl}`
  const role = roleOf(el)
  if (!role) return (fallbackText ?? el.innerText).replace(/\s+/g, ' ').trim()
  const parts = [clean(labelOf(el) || fallbackText || ''), role]
  const checked = el.getAttribute('aria-checked') ?? ((el as HTMLInputElement).type === 'checkbox' || (el as HTMLInputElement).type === 'radio' ? String((el as HTMLInputElement).checked) : null)
  if (checked === 'true') parts.push('checked'); else if (checked === 'false') parts.push('not checked')
  if (el.getAttribute('aria-pressed') === 'true') parts.push('pressed')
  if (el.getAttribute('aria-expanded') === 'true') parts.push('expanded'); else if (el.getAttribute('aria-expanded') === 'false') parts.push('collapsed')
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') parts.push('unavailable')
  if (el.matches('input,textarea') && (el as HTMLInputElement).type !== 'password' && (el as HTMLInputElement).value) parts.push((el as HTMLInputElement).value)
  if (el.matches('select')) parts.push((el as HTMLSelectElement).selectedOptions[0]?.text ?? '')
  if (el.matches('[required],[aria-required="true"]')) parts.push('required')
  return parts.filter(Boolean).join(', ')
}

/** Everything a screen reader would stop on, in page order: headings, text blocks, links, buttons and fields. */
export function readerItems(root: HTMLElement = document.body): ReaderItem[] {
  const BLOCKS = 'h1,h2,h3,h4,h5,h6,p,li,dt,dd,th,td,blockquote,figcaption,legend,label,[role=heading],[role=alert],[role=status],[data-read]'
  const out: ReaderItem[] = []
  const seen = new Set<HTMLElement>()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const el = (n.nodeType === 1 ? n : n.parentElement) as HTMLElement | null
      if (!el || el.closest(SKIP)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 1) {
      const el = n as HTMLElement
      if (seen.has(el) || !el.matches(INTERACTIVE) || !visible(el)) continue
      if (el.closest('label') && !el.matches('input,select,textarea')) continue
      seen.add(el); out.push({ el, text: describe(el) })
      continue
    }
    if (!n.textContent?.trim()) continue
    const p = n.parentElement!
    if (p.closest(INTERACTIVE) || !visible(p)) continue // read as part of its link or button
    const block = p.closest<HTMLElement>(BLOCKS) ?? p
    if (seen.has(block)) continue
    if (block.matches('label') && block.querySelector('input,select,textarea')) continue
    seen.add(block)
    const text = describe(block)
    if (text.replace(/[\s.,]/g, '')) out.push({ el: block, text })
  }
  return out.filter((x) => x.text.trim())
}

/**
 * Keeps the keyboard where the voice is, like NVDA: moves real focus to the thing being read, so
 * Enter opens it and Tab continues from there. Text that can't normally take focus gets tabindex=-1
 * (it still isn't a Tab stop). Fields are left alone so arrow keys keep reading instead of typing.
 */
let quiet = 0
export const isQuietFocus = () => quiet > 0
export function followFocus(el: HTMLElement | null) {
  if (!el || !document.contains(el) || el.matches('input,select,textarea,[contenteditable=true]') || document.activeElement === el) return
  if (!el.matches(INTERACTIVE) && !el.hasAttribute('tabindex')) { el.setAttribute('tabindex', '-1'); el.setAttribute('data-sr-tab', '') }
  quiet++
  try { el.focus({ preventScroll: true }) } finally { setTimeout(() => { quiet-- }, 0) }
}
export function clearFollowFocus() { document.querySelectorAll('[data-sr-tab]').forEach((x) => { x.removeAttribute('tabindex'); x.removeAttribute('data-sr-tab') }) }

interface Options { say: (text: string) => void; stop: () => void; readFrom: (el: HTMLElement | null) => void; onMove?: (el: HTMLElement | null) => void }

/** Turns the screen reader on. Returns a function that turns it off. */
export function startScreenReader(o: Options): () => void {
  let current: HTMLElement | null = null
  const mark = (el: HTMLElement | null) => {
    document.querySelectorAll('.sr-cursor').forEach((x) => x.classList.remove('sr-cursor'))
    current = el
    if (el) { el.classList.add('sr-cursor'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); followFocus(el) }
    o.onMove?.(el)
  }
  const sayItem = (it: ReaderItem | undefined) => { if (!it) { o.say('Bottom of page'); return } mark(it.el); o.say(it.text) }

  const move = (dir: 1 | -1, test?: (el: HTMLElement) => boolean) => {
    const items = readerItems().filter((x) => !test || test(x.el))
    if (!items.length) return o.say('None found')
    if (!current || !document.contains(current)) return sayItem(dir === 1 ? items[0] : items[items.length - 1])
    const after = (el: HTMLElement) => !!(current!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) && !current!.contains(el)
    const before = (el: HTMLElement) => !!(current!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) && !el.contains(current!)
    const next = dir === 1 ? items.find((x) => after(x.el)) : [...items].reverse().find((x) => before(x.el))
    if (!next) return o.say(dir === 1 ? 'Bottom of page' : 'Top of page')
    sayItem(next)
  }

  const activate = () => {
    const el = current?.closest<HTMLElement>(INTERACTIVE) ?? current
    if (!el || !document.contains(el)) return o.say('Nothing selected. Swipe right to move to the next item.')
    if (el.matches('input,select,textarea')) { el.focus(); o.say(`${describe(el)}. Editing`); return }
    allowClick = true
    try { el.focus({ preventScroll: true }); el.click() } finally { allowClick = false }
    setTimeout(() => { if (document.contains(el)) o.say(describe(el)) }, 250)
  }

  // ---- keyboard (NVDA style)
  let insertDown = false
  const typing = () => { const a = document.activeElement as HTMLElement | null; return !!a && (a.matches('input:not([type=checkbox]):not([type=radio]),textarea,select,[contenteditable=true]')) }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Insert') { insertDown = true; return }
    if (e.key === 'Control' || e.key === 'Escape') { o.stop(); return }
    if (insertDown && e.key === 'ArrowDown') { e.preventDefault(); o.readFrom(current); return }
    if (typing() || e.altKey || e.ctrlKey || e.metaKey) return
    const k = e.key.toLowerCase()
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (k === 'h') { e.preventDefault(); move(e.shiftKey ? -1 : 1, (el) => headingLevel(el) !== null) }
    else if (k === 'k') { e.preventDefault(); move(e.shiftKey ? -1 : 1, (el) => el.matches('a[href],[role=link]')) }
    else if (k === 'b') { e.preventDefault(); move(e.shiftKey ? -1 : 1, (el) => el.matches('button,[role=button]')) }
    else if (k === 'f') { e.preventDefault(); move(e.shiftKey ? -1 : 1, (el) => el.matches('input,select,textarea,[role=switch],[role=checkbox]')) }
    else if (e.key === 'Enter' && current && !document.activeElement?.matches(INTERACTIVE) && current.closest(INTERACTIVE)) { e.preventDefault(); activate() }
  }
  const onKeyUp = (e: KeyboardEvent) => { if (e.key === 'Insert') insertDown = false }
  // Tab moves real focus; read whatever arrives
  const onFocus = (e: FocusEvent) => {
    const el = e.target as HTMLElement
    if (isQuietFocus() || !el?.matches?.(INTERACTIVE + ',h1,h2,h3,[role=heading]')) return
    mark(el); o.say(describe(el))
  }

  // ---- touch (TalkBack / VoiceOver style)
  let allowClick = false
  let lastPointer = 'mouse'
  let start: { x: number; y: number; t: number } | null = null
  let lastTap = 0
  const onPointerDown = (e: PointerEvent) => { lastPointer = e.pointerType }
  const onTouchStart = (e: TouchEvent) => { if (e.touches.length === 1) start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } }
  const onTouchEnd = (e: TouchEvent) => {
    if (!start || e.changedTouches.length !== 1) return
    const dx = e.changedTouches[0].clientX - start.x, dy = e.changedTouches[0].clientY - start.y, dt = Date.now() - start.t
    start = null
    if (Math.abs(dx) > 60 && Math.abs(dy) < 45 && dt < 600) { e.preventDefault(); move(dx > 0 ? 1 : -1); lastTap = 0; return }
    if (Math.abs(dx) > 15 || Math.abs(dy) > 15 || dt > 400) return // a scroll or a long press
    const now = Date.now()
    if (now - lastTap < 450 && current) { e.preventDefault(); lastTap = 0; activatedAt = now; activate(); return }
    lastTap = now
  }
  // A single tap reads (it never opens anything); the double-tap above opens what was read
  let activatedAt = 0
  const onClick = (e: MouseEvent) => {
    if (allowClick || lastPointer !== 'touch') return
    e.preventDefault(); e.stopPropagation()
    if (Date.now() - activatedAt < 600) return
    const t = e.target as HTMLElement
    const el = t.closest<HTMLElement>(INTERACTIVE) ?? readerItems().find((x) => x.el.contains(t))?.el ?? t
    if (el === current) return // second tap of a double-tap: already read
    mark(el); o.say(describe(el))
  }

  document.addEventListener('keydown', onKey, true)
  document.addEventListener('keyup', onKeyUp, true)
  document.addEventListener('focusin', onFocus)
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('touchstart', onTouchStart, { passive: true })
  document.addEventListener('touchend', onTouchEnd, { passive: false })
  document.addEventListener('click', onClick, true)
  document.documentElement.classList.add('sr-on')
  return () => {
    document.removeEventListener('keydown', onKey, true)
    document.removeEventListener('keyup', onKeyUp, true)
    document.removeEventListener('focusin', onFocus)
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('touchstart', onTouchStart)
    document.removeEventListener('touchend', onTouchEnd)
    document.removeEventListener('click', onClick, true)
    document.documentElement.classList.remove('sr-on')
    mark(null)
    clearFollowFocus()
  }
}
