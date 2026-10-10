// Verification documents are stored privately on the server (never in the synced data).
// Only the uploader and platform reviewers can open them.
import { API_URL, BACKEND } from '../config'
import { getToken, RemoteError } from './rpc'

export const MAX_DOC_BYTES = 10 * 1024 * 1024

export async function uploadFile(file: File): Promise<string | undefined> {
  if (!BACKEND) return undefined
  if (file.size > MAX_DOC_BYTES) throw new RemoteError('too_large', 'Upload a file under 10 MB.')
  // Some phones give PDFs and photos no type: work it out from the file name
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = file.type || ({ pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic' } as Record<string, string>)[ext] || 'application/octet-stream'
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(type)) throw new RemoteError('unsupported', `${file.name}: upload a PDF, JPG or PNG.`)
  const res = await fetch(`${API_URL}/api/files`, {
    method: 'POST',
    headers: { 'Content-Type': type, 'X-File-Name': encodeURIComponent(file.name), Authorization: `Bearer ${getToken() ?? ''}` },
    body: file,
  }).catch(() => { throw new RemoteError('network', `Could not upload ${file.name}. Try again; if it keeps failing, use a PDF, JPG or PNG under 10 MB.`) })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new RemoteError(j?.error?.code ?? 'server', j?.error?.message ?? 'Upload failed.')
  return j.id as string
}

export const fileUrl = (id: string) => `${API_URL}/api/files/${id}?token=${encodeURIComponent(getToken() ?? '')}`
