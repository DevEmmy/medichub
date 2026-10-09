// One branded, mobile-friendly email layout for account emails (welcome, confirm email, password reset).
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export interface BrandEmail { heading: string; lines: string[]; cta?: { label: string; url: string }; after?: string[]; footer: string }

export function brandEmail(e: BrandEmail): { text: string; html: string } {
  const text = [e.heading, '', ...e.lines.flatMap((l) => [l, '']), ...(e.cta ? [`${e.cta.label}: ${e.cta.url}`, ''] : []), ...(e.after ?? []).flatMap((l) => [l, '']), e.footer, '', 'Medic Hub'].join('\n')
  const p = (l: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155">${esc(l)}</p>`
  const html = `<!doctype html><html><body style="margin:0;background:#FBF8F1;font-family:Arial,Helvetica,sans-serif;color:#06281F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF8F1;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #ece6d8">
<tr><td style="background:#06281F;padding:18px 24px;color:#C6F36B;font-weight:800;font-size:18px">Medic Hub</td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25">${esc(e.heading)}</h1>
${e.lines.map(p).join('')}
${e.cta ? `<p style="margin:18px 0"><a href="${esc(e.cta.url)}" style="display:inline-block;background:#C6F36B;color:#06281F;text-decoration:none;font-weight:800;padding:13px 22px;border-radius:999px;font-size:15px">${esc(e.cta.label)}</a></p><p style="margin:0 0 14px;font-size:12px;color:#64748b;word-break:break-all">Or paste this link into your browser: ${esc(e.cta.url)}</p>` : ''}
${(e.after ?? []).map(p).join('')}
</td></tr>
<tr><td style="padding:14px 24px;background:#f7f5ee;font-size:12px;color:#64748b">${esc(e.footer)}</td></tr>
</table></td></tr></table></body></html>`
  return { text, html }
}
