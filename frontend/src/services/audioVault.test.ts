import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { audioDb, CONSENT_VERSION, listAudio, openAudio, purgeExpiredAudio, sealAudio, storeAudio, type AudioConsent } from './audioVault'
const authorization: AudioConsent = { professional: 'Profissional fictício / TESTE', mode: 'encounter', authorizedBy: 'patient', acceptedAt: new Date().toISOString(), version: CONSENT_VERSION }
const password = 'senha de teste exclusiva'
const blob = () => new Blob(['audio original de teste'], { type: 'audio/webm' })
afterEach(async () => { await audioDb.clips.clear() })
describe('cofre de áudio', () => {
  it('persiste conteúdo criptografado e recupera áudio e autorização com a senha', async () => {
    const clip = await sealAudio(blob(), 'visita-a', password, authorization, 12, 1)
    await audioDb.clips.add(clip)
    const stored = (await listAudio('visita-a'))[0]
    expect(new TextDecoder().decode(stored.cipher)).not.toContain(authorization.professional)
    expect(JSON.stringify(stored)).not.toContain(password)
    const result = await openAudio(stored, password)
    expect(await result.blob.text()).toBe(await blob().text())
    expect(result.consent).toEqual(authorization)
    expect(result.blob.type).toBe('audio/webm')
    expect(await listAudio('visita-b')).toEqual([])
  })
  it('recusa senha errada e adulteração do conteúdo, vínculo ou prazo', async () => {
    const clip = await sealAudio(blob(), 'visita-a', password, authorization, 12, 1)
    await expect(openAudio(clip, 'senha incorreta')).rejects.toThrow('Senha incorreta')
    await expect(openAudio({ ...clip, visitId: 'visita-b' }, password)).rejects.toThrow('integridade')
    await expect(openAudio({ ...clip, expiresAt: clip.expiresAt + 1000 }, password)).rejects.toThrow('integridade')
    const cipher = clip.cipher.slice(0); new Uint8Array(cipher)[0] ^= 1
    await expect(openAudio({ ...clip, cipher }, password)).rejects.toThrow('integridade')
  })
  it('usa salt e IV aleatórios e bloqueia e remove áudios expirados', async () => {
    const a = await sealAudio(blob(), 'a', password, authorization, 12, 1)
    const b = await sealAudio(blob(), 'a', password, authorization, 12, 7)
    expect(a.iv).not.toEqual(b.iv); expect(a.salt).not.toEqual(b.salt)
    await expect(openAudio({ ...a, expiresAt: Date.now() - 1 }, password)).rejects.toThrow('prazo')
    await audioDb.clips.bulkAdd([{ ...a, expiresAt: Date.now() - 1 }, b])
    await purgeExpiredAudio()
    expect((await listAudio('a')).map(c => c.id)).toEqual([b.id])
  })
  it('serializa o limite por visita e exclui sem alterar visitas clínicas', async () => {
    const row = await sealAudio(blob(), 'a', password, authorization, 12, 1)
    await audioDb.clips.bulkAdd(Array.from({ length: 5 }, (_, index) => ({ ...row, id: `clip-${index}` })))
    await expect(storeAudio(row)).rejects.toThrow('cinco áudios')
    await audioDb.clips.delete('clip-0')
    await storeAudio(row)
    expect((await listAudio('a')).length).toBe(5)
  })
  it('recusa autorização incompatível, senha fraca e limites fora da política', async () => {
    await expect(sealAudio(blob(), 'a', 'curta', authorization, 12, 1)).rejects.toThrow('12 caracteres')
    await expect(sealAudio(blob(), 'a', password, { ...authorization, authorizedBy: 'professional' }, 12, 1)).rejects.toThrow('autorização')
    await expect(sealAudio(blob(), 'a', password, authorization, 12, 30)).rejects.toThrow('prazo')
    await expect(sealAudio(new Blob([]), 'a', password, authorization, 12, 1)).rejects.toThrow('vazia')
    await expect(sealAudio(blob(), 'a', password, authorization, 9999, 1)).rejects.toThrow('limite')
  })
})
