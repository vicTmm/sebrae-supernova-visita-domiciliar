import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { expect, it } from 'vitest'
import { emptyVisit, emptyWomensHealth, exampleVisit, upgradeVisit, type Visit } from '../types/visit'
import { clinicalRuleError, localSoapOutput, normalizeSoapBlocks, restoreSoap, withSoapEdits } from './soap'
import { db } from './offlineDb'

it('mantém títulos fora dos blocos e limpa prefixos vindos de edições ou respostas antigas', () => {
  const original = localSoapOutput(exampleVisit())
  const edited = withSoapEdits(original, { subjective_text: 'S: S: História revisada.', objective_text: 'O: Exame.', plan_text: 'P: Conduta.', assessment_text: 'A: Avaliação.' })
  expect(edited.subjective_text).toBe('História revisada.')
  expect(edited.objective_text).toBe('Exame.')
  expect(edited.plan_text).toBe('Conduta.')
  expect(edited.assessment_text).toBe('Avaliação.')
  expect(edited.full_text_fallback).not.toContain('S: S:')
  const legacy = { ...original, subjective_text: 'S: História antiga.', plan_text: 'P: Conduta antiga.' }
  expect(restoreSoap(exampleVisit(), legacy.full_text_fallback, legacy).subjective_text).toBe('História antiga.')
  expect(normalizeSoapBlocks(original)).toBe(original)
})

it('registra o rastreio informado sem inventar pedido no plano', () => {
  const visit = exampleVisit(), health = emptyWomensHealth()
  health.cervical = { status: 'Em dia', year: 2024, notes: 'Resultado informado pela paciente.' }
  health.mammography = { status: 'Atrasado / Solicitar', year: 2022, notes: '' }
  visit.womens_health = health
  const soap = localSoapOutput(visit)
  expect(soap.subjective_text).toContain('2024')
  expect(soap.subjective_text).toContain('Resultado informado pela paciente')
  expect(soap.subjective_text).toContain('mamografia em atraso')
  expect(soap.plan_text).not.toContain('Solicitar')
  visit.sex = 'Masculino'
  expect(clinicalRuleError(visit)).toContain('Feminino')
})

it('não atribui rastreio, pontuação geriátrica ou sintomas negativos a módulos vazios', () => {
  const visit = emptyVisit()
  visit.sex = 'Feminino'; visit.womens_health = emptyWomensHealth()
  visit.neuro_exam = { rankin: null, directed_flags: [], neuro_notes: null, geriatric_screening: { flags: [], notes: '' } }
  const soap = localSoapOutput(visit)
  expect(soap.full_text_fallback).not.toContain('mamografia')
  expect(soap.full_text_fallback).not.toContain('citopatológico')
  expect(soap.full_text_fallback).not.toContain('rastreio geriátrico')
  visit.neuro_exam.geriatric_screening!.flags = ['Humor deprimido / desânimo frequente']
  const assessed = localSoapOutput(visit)
  expect(assessed.subjective_text).toContain('humor deprimido')
  expect(assessed.objective_text).not.toContain('MEEM')
  expect(assessed.objective_text).not.toContain('Rankin')
  expect(assessed.assessment_text).toBeNull()
})

it('recusa ano futuro e realização prévia incompatível com Nunca realizou', () => {
  const visit = exampleVisit(); visit.womens_health = emptyWomensHealth()
  visit.womens_health.cervical.year = new Date().getFullYear() + 1
  expect(clinicalRuleError(visit)).toContain('ano')
  visit.womens_health.cervical = { year: 2020, status: 'Nunca realizou', notes: '' }
  expect(clinicalRuleError(visit)).toContain('histórico')
})

it('migra v5→v6 preservando os textos revisados e retirando campos estruturados descontinuados', async () => {
  await db.delete()
  const old = new Dexie(db.name)
  old.version(5).stores({ visits: 'visit.id, visit.visited_at', drafts: 'key' })
  const visit = exampleVisit()
  const legacy = { ...visit, neuro_exam: { ...visit.neuro_exam, retired_test: { score: 15 } } }
  await old.table('visits').put({ visit: legacy, soap_text: 'Texto revisado intocável', revision: 1, localVersion: 2, pending: true })
  await old.table('drafts').put({ key: 'active', visit: legacy, soap: 'Rascunho revisado', baseRevision: 0, source: 'legacy' })
  old.close(); await db.open()
  const saved = (await db.visits.get(visit.id))!
  expect(saved.visit.neuro_exam).not.toHaveProperty('retired_test')
  expect(saved.soap_text).toBe('Texto revisado intocável')
  expect(saved.pending).toBe(true)
  expect((await db.drafts.get('active'))!.soap).toBe('Rascunho revisado')
  expect(upgradeVisit(legacy as Visit).neuro_exam).not.toHaveProperty('retired_test')
  await db.visits.clear(); await db.drafts.clear()
})
