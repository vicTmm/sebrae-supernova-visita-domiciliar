import Dexie, { type Table } from 'dexie'

export const MAX_AUDIO_BYTES = 32 * 1024 * 1024
export const MAX_AUDIO_SECONDS = 15 * 60
export const CONSENT_VERSION = 'audio-review-v1'
const ITERATIONS = 600_000
export interface AudioConsent {
  professional: string
  mode: 'dictation' | 'encounter'
  authorizedBy: 'professional' | 'patient' | 'representative'
  acceptedAt: string
  version: string
}
export interface StoredAudio {
  id: string; visitId: string; createdAt: number; expiresAt: number; duration: number; mime: string
  salt: Uint8Array<ArrayBuffer>; iv: Uint8Array<ArrayBuffer>; cipher: ArrayBuffer
}
class AudioDatabase extends Dexie {
  clips!: Table<StoredAudio, string>
  constructor() { super('visitario-audio-v1'); this.version(1).stores({ clips: 'id, visitId, expiresAt' }) }
}
export const audioDb = new AudioDatabase()
function aad(row: Omit<StoredAudio, 'cipher' | 'salt' | 'iv'>) {
  return new TextEncoder().encode(JSON.stringify([row.id, row.visitId, row.createdAt, row.expiresAt, row.duration, row.mime]))
}
async function derive(password: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
export async function sealAudio(blob: Blob, visitId: string, password: string, consent: AudioConsent, duration: number, days: number): Promise<StoredAudio> {
  if (password.length < 12 || password.length > 256) throw new Error('Use uma senha com pelo menos 12 caracteres.')
  if (!blob.size || blob.size > MAX_AUDIO_BYTES || !Number.isFinite(duration) || duration < 0 || duration > MAX_AUDIO_SECONDS + 2) throw new Error('Gravação vazia ou acima do limite permitido.')
  if (!['dictation', 'encounter'].includes(consent.mode) || !Number.isFinite(Date.parse(consent.acceptedAt)) || ![1, 7].includes(days) || !consent.professional.trim() || consent.version !== CONSENT_VERSION ||
    (consent.mode === 'encounter' ? !['patient', 'representative'].includes(consent.authorizedBy) : consent.authorizedBy !== 'professional')) throw new Error('Confira a autorização e o prazo do áudio.')
  const createdAt = Date.now()
  const row = { id: crypto.randomUUID(), visitId, createdAt, expiresAt: createdAt + days * 86400000, duration, mime: blob.type }
  const header = new TextEncoder().encode(JSON.stringify(consent))
  const length = new Uint8Array(4); new DataView(length.buffer).setUint32(0, header.length)
  const payload = await new Blob([length, header, blob]).arrayBuffer()
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await derive(password, salt)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(row) }, key, payload)
  return { ...row, salt, iv, cipher }
}
export async function openAudio(row: StoredAudio, password: string): Promise<{ blob: Blob; consent: AudioConsent }> {
  if (row.expiresAt <= Date.now()) throw new Error('O prazo deste áudio terminou.')
  try {
    const key = await derive(password, row.salt)
    const payload = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: row.iv, additionalData: aad(row) }, key, row.cipher)
    const length = new DataView(payload).getUint32(0)
    const consent = JSON.parse(new TextDecoder().decode(payload.slice(4, 4 + length))) as AudioConsent
    return { blob: new Blob([payload.slice(4 + length)], { type: row.mime }), consent }
  } catch { throw new Error('Senha incorreta ou arquivo sem integridade. Não foi possível abrir o áudio.') }
}
export async function purgeExpiredAudio() {
  await audioDb.clips.where('expiresAt').belowOrEqual(Date.now()).delete()
}
export async function listAudio(visitId: string) {
  await purgeExpiredAudio()
  return (await audioDb.clips.where('visitId').equals(visitId).toArray()).sort((a, b) => b.createdAt - a.createdAt)
}

// Limite por origem. A transação também serializa gravações feitas por outras abas.
export async function storeAudio(row: StoredAudio) {
  await audioDb.transaction('rw', audioDb.clips, async () => {
    await purgeExpiredAudio()
    const clips = await audioDb.clips.toArray()
    if (clips.filter(c => c.visitId === row.visitId).length >= 5) throw new Error('Limite de cinco áudios por visita atingido.')
    if (clips.reduce((bytes, clip) => bytes + clip.cipher.byteLength, 0) + row.cipher.byteLength > 128 * 1024 * 1024) throw new Error('Limite de 128 MB de áudios neste navegador atingido. Exclua áudios revisados.')
    await audioDb.clips.add(row)
  })
}
