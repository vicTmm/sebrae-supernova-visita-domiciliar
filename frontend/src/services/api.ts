import type { Visit, ServerVisit, SOAPOutput } from '../types/visit'
import { db, applySync, mergeRemote } from './offlineDb'
const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${base}${path}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000), cache: 'no-store' })
  if (!response.ok) throw new Error(response.status === 422 ? 'Dados recusados pela API. Confira os campos clínicos.' : `API indisponível (${response.status}).`)
  return response.json()
}
export async function generateSoap(visit: Visit): Promise<SOAPOutput> {
  const result = await request<SOAPOutput>('/visits/generate-soap', visit)
  if (!result || typeof result.subjective_text !== 'string' || typeof result.objective_text !== 'string' || typeof result.plan_text !== 'string' || typeof result.full_text_fallback !== 'string') throw new Error('O servidor precisa ser atualizado para a saída por blocos do VitaCare.')
  return result
}
let running: Promise<void> | undefined
export function syncVisits(): Promise<void> {
  if (running) return running
  running = performSync().finally(() => { running = undefined })
  return running
}
async function performSync() {
  const pending = (await db.visits.toArray()).filter(v => v.pending && !v.conflict)
  for (let i = 0; i < pending.length; i += 100) {
    const batch = pending.slice(i, i + 100)
    const result = await request<{ saved: ServerVisit[]; conflicts: ServerVisit[] }>('/visits/sync', { visits: batch.map(v => ({ visit: v.visit, soap_text: v.soap_text, soap_blocks: v.soap_blocks ?? null, base_revision: v.revision })) })
    for (const row of result.saved) { const sent = batch.find(v => v.visit.id === row.visit.id); if (sent) await applySync(sent, row) }
    for (const row of result.conflicts) { const sent = batch.find(v => v.visit.id === row.visit.id); if (sent) await applySync(sent, row, true) }
  }
  const now = new Date(); const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  for (let offset = 0; ; offset += 100) {
    const rows = await request<ServerVisit[]>(`/visits?day=${day}&offset_minutes=${-now.getTimezoneOffset()}&limit=100&offset=${offset}`)
    await mergeRemote(rows)
    if (rows.length < 100) break
  }
}
