// Verification documents are stored privately on the server (never in the synced data).
// Only the uploader and platform reviewers can open them.
import { API_URL, BACKEND } from '../config'
import { getToken, RemoteError } from './rpc'

export const MAX_DOC_BYTES = 10 * 1024 * 1024

export async function uploadFile(file: File): Promise<string | undefined> {
  if (!BACKEND) return undefined
  if (file.size > MAX_DOC_BYTES) throw new RemoteError('too_large', 'Upload a file under 10 MB.')
  const res = await fetch(`${API_URL}/api/files`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name), Authorization: `Bearer ${getToken() ?? ''}` },
    body: file,
  }).catch(() => { throw new RemoteError('network', 'Upload failed. Check your connection.') })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new RemoteError(j?.error?.code ?? 'server', j?.error?.message ?? 'Upload failed.')
  return j.id as string
}

export const fileUrl = (id: string) => `${API_URL}/api/files/${id}?token=${encodeURIComponent(getToken() ?? '')}`
