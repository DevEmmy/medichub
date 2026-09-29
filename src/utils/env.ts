/** True when the app runs inside a sandboxed frame (e.g. the hosted demo), where tel:, print, downloads and embeds may be blocked. */
export const isFramed = (() => { try { return window.self !== window.top } catch { return true } })()
export const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
export const isMobileUA = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
