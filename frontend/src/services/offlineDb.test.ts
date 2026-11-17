import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { db, saveLocal, applySync, mergeRemote } from './offlineDb'
import { emptyVisit, exampleVisit, glasgowTotal } from '../types/visit'
import { clinicalRuleError, localSoap } from './soap'

afterEach(async () => { await db.visits.clear(); await db.drafts.clear() })
describe('offline-first', () => {
  it('gera SOAP sem rede e sem presumir exame normal', () => {
    const visit = exampleVisit(); visit.exam.respiratory = { status: 'Não avaliado', notes: '' }
    const text = localSoap(visit)
    expect(text.split('\n').map(s => s.slice(0, 2))).toEqual(['S:', 'O:', 'P:'])
    expect(text).toContain('PAS 150 mmHg'); expect(text).not.toContain('Ausculta pulmonar sem alterações')
  })
  it('persiste a fila e preserva edição durante sincronização', async () => {
    const visit = exampleVisit()
    await saveLocal(visit, 'primeira', 0)
    const sent = (await db.visits.get(visit.id))!
    await saveLocal(visit, 'edição nova', 0)
    await applySync(sent, { visit, soap_text: 'primeira', revision: 1 })
    const current = (await db.visits.get(visit.id))!
    expect(current.pending).toBe(true); expect(current.soap_text).toBe('edição nova'); expect(current.revision).toBe(1)
    await applySync(current, { visit, soap_text: 'edição nova', revision: 2 })
    expect((await db.visits.get(visit.id))!.pending).toBe(false)
  })
  it('mantém conflito e não sobrescreve pendências com histórico remoto', async () => {
    const visit = exampleVisit(); await saveLocal(visit, 'local', 0)
    const sent = (await db.visits.get(visit.id))!
    const remote = { visit, soap_text: 'remoto', revision: 2 }
    await applySync(sent, remote, true); await mergeRemote([remote])
    const row = (await db.visits.get(visit.id))!
    expect(row.soap_text).toBe('local'); expect(row.conflict?.soap_text).toBe('remoto'); expect(row.pending).toBe(true)
  })
  it('gera o novo padrão VitaCare offline', () => {
    const text = localSoap(exampleVisit())
    expect(text).toMatch(/^S: Realizada visita domiciliar acompanhado\(a\) da ACS Maria e do estudante João\./)
    expect(text).toContain('está em uso contínuo de Losartana')
    expect(text).toContain('utilizou Ceftriaxona durante a internação por pneumonia')
    expect(text).toContain('Mini-Mental (MEEM) 24/30 (escolaridade: 4 anos completos)')
    expect(text).toContain('Rankin modificado 4, LOTE, PIFR')
    expect(text.indexOf('Ausculta pulmonar')).toBeLessThan(text.indexOf('Exame neurológico'))
    expect(text.indexOf('Exame neurológico')).toBeLessThan(text.indexOf('Exame abdominal'))
  })
  it('preserva Rankin zero e não presume Glasgow ou equipe ausente', () => {
    const v = emptyVisit(); v.neuro_exam = { glasgow: null, rankin: 0, directed_flags: [], neuro_notes: null }
    expect(localSoap(v)).toContain('Rankin modificado 0')
    expect(localSoap(v)).not.toContain('Glasgow')
    expect(localSoap(v)).toContain('Acompanhantes da equipe não informados')
    v.companions.is_solo = true
    expect(localSoap(v)).toContain('Realizada visita domiciliar sem acompanhantes da equipe.')
  })
  it('calcula Glasgow e impede gerar SOAP com escala incompleta', () => {
    expect(glasgowTotal({ eye: 4, verbal: 5, motor: 6 })).toBe(15)
    expect(glasgowTotal({ eye: 2, verbal: 3, motor: 4 })).toBe(9)
    expect(glasgowTotal({ eye: 4, verbal: null, motor: 6 })).toBeNull()
    const v = exampleVisit(); v.neuro_exam!.glasgow = { eye: 4, verbal: null, motor: 6, total: null }
    expect(clinicalRuleError(v)).toContain('Glasgow')
    expect(() => localSoap(v)).toThrow('Glasgow')
  })
  it('migra banco v1 com rascunho, pendência e conflito sem alterar SOAP', async () => {
    await db.delete()
    const old = new Dexie(db.name)
    old.version(1).stores({ visits: 'visit.id, visit.visited_at', drafts: 'key' })
    const { companions, medications_in_use, recent_medications, neuro_exam, ...fields } = exampleVisit()
    const visit = { ...fields, medications: 'Losartana legada' }
    const remote = { visit, soap_text: 'Texto remoto revisado', revision: 2 }
    await old.table('visits').put({ visit, soap_text: 'Texto local revisado', revision: 1, localVersion: 3, pending: true, conflict: remote })
    await old.table('drafts').put({ key: 'active', visit, soap: 'Rascunho revisado', baseRevision: 1, source: 'local' })
    old.close()
    await db.open()
    const migrated = (await db.visits.get(visit.id))!
    expect(migrated.visit.medications_in_use).toBe('Losartana legada')
    expect(migrated.visit.companions.is_solo).toBe(false)
    expect(migrated.visit.neuro_exam).toBeNull()
    expect(migrated.pending).toBe(true)
    expect(migrated.soap_text).toBe('Texto local revisado')
    expect(migrated.conflict!.visit.medications_in_use).toBe('Losartana legada')
    expect((await db.drafts.get('active'))!.soap).toBe('Rascunho revisado')
  })
})
