import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { expect, it } from 'vitest'
import cases from '../../../backend/tests/fixtures/clinical_cases.json'
import { evaluateClinical } from './clinicalRules'
import { clinicalRuleError, localSoapOutput, restoreSoap } from './soap'
import { changeVisitSex, conditionsForSex, exampleVisit, miniMentalTotal, upgradeVisit, type Visit } from '../types/visit'
import { db } from './offlineDb'

it('produz os mesmos alertas e SOAP offline que o backend para todos os casos de referência', () => {
  for (const c of cases) {
    const visit = c.visit as Visit
    expect(evaluateClinical(visit), c.name).toEqual(c.analysis)
    expect(localSoapOutput(visit), c.name).toEqual(c.soap)
  }
})

it('não confunde domínio cognitivo não avaliado com zero e valida o total', () => {
  const domains = { temporal: 4, spatial: 5, registration: 3, attention: 3, recall: 2, language: 7 }
  expect(miniMentalTotal({ ...domains, recall: null })).toBeNull()
  expect(miniMentalTotal(domains)).toBe(24)
  expect(miniMentalTotal({ ...domains, language: 10 })).toBeNull()
  const v = exampleVisit()
  v.neuro_exam!.mini_mental = { score: 25, domains, education_years: 4, notes: '' }
  expect(clinicalRuleError(v)).toContain('seis domínios')
  v.neuro_exam!.mini_mental = null
  expect(clinicalRuleError(v)).toBeNull()
})

it('preserva avaliações estruturadas e os tópicos ao reabrir o SOAP', () => {
  const visit = upgradeVisit(cases.find(testCase => testCase.name === 'ivcf_maximum_and_meem')!.visit as Visit)
  const result = localSoapOutput(visit)
  expect(visit.neuro_exam!.ivcf20!.score).toBe(40)
  expect(visit.neuro_exam!.mini_mental!.attention_method).toBe('mundo_reverse')
  expect(result.objective_text).toContain('Idoso Frágil')
  expect(result.plan_text.match(/acompanhamento multiprofissional/g)).toHaveLength(1)
  expect(restoreSoap(visit, result.full_text_fallback).plan_text).toBe(result.plan_text)
  visit.age = 84
  expect(clinicalRuleError(visit)).toContain('faixa etária do IVCF-20')
})

it('separa exames externos dos sinais vitais e aplica apenas os alertas do perfil', () => {
  const visit = exampleVisit()
  visit.lab_results = { exam_date: '2026-11-10', creatinina: 1.3, ldl: 99, hba1c: 6.9, tsh: 0.4, psa: 4, hb: 12, plaquetas: 0 }
  expect(evaluateClinical(visit).filter(alert => alert.code.startsWith('lab_'))).toEqual([])
  expect(localSoapOutput(visit).objective_text).toContain('Plaquetas 0 /mm³')
  visit.lab_results.ldl_target = 70
  expect(evaluateClinical(visit).some(alert => alert.code === 'lab_ldl')).toBe(true)
  visit.conditions.push('Gestante')
  expect(evaluateClinical(visit).some(alert => alert.code.startsWith('lab_'))).toBe(false)
  visit.lab_results = { exam_date: '2026-11-10', ldl_target: 70, eas_urina: ' ' }
  expect(localSoapOutput(visit).objective_text).not.toContain('Exames laboratoriais')
  visit.lab_results.plaquetas = 1.5
  expect(clinicalRuleError(visit)).toContain('Plaquetas')
})

it('filtra condições exclusivas por sexo e remove seleções incompatíveis ao trocar', () => {
  expect(conditionsForSex('Feminino')).toEqual(expect.arrayContaining(['Gestante', 'Puérpera', 'Hipertenso']))
  expect(conditionsForSex('Masculino')).toEqual(conditionsForSex(null))
  expect(conditionsForSex('Masculino')).not.toContain('Gestante')
  expect(conditionsForSex('Masculino')).not.toContain('Puérpera')

  const visit = exampleVisit()
  visit.conditions = ['Gestante', 'Hipertenso', 'Outra']
  visit.other_condition = 'Condição registrada'
  const changed = changeVisitSex(visit, 'Masculino')
  expect(changed.conditions).toEqual(['Hipertenso', 'Outra'])
  expect(changed.other_condition).toBe(visit.other_condition)
  expect(changeVisitSex(changed, 'Feminino').conditions).toEqual(changed.conditions)
  expect(clinicalRuleError({ ...visit, sex: 'Masculino' })).toContain('condições obstétricas')
})

it('recusa detalhes de queixas não selecionadas e meta de PA incompleta', () => {
  const v = exampleVisit()
  v.intercurrence_details = { Dor: 'Dor não selecionada' }
  expect(clinicalRuleError(v)).toContain('queixa correspondente')
  v.intercurrence_details = {}
  v.bp_target = { systolic: 130, diastolic: null }
  expect(clinicalRuleError(v)).toContain('duas metas')
})

it('migra o relato compartilhado apenas uma vez sem atribuí-lo a todos os sintomas', () => {
  const old = { ...exampleVisit(), complaints: ['Dor', 'Tontura'], intercurrence_details: 'Relato compartilhado antigo.' } as unknown as Visit
  const next = upgradeVisit(old)
  expect(next.intercurrence_details).toEqual({ Dor: 'Relato compartilhado antigo.' })
  expect(upgradeVisit(next)).toEqual(next)
})

it('migra IndexedDB v3 preservando rascunho, histórico, conflito e SOAP editado', async () => {
  await db.delete()
  const old = new Dexie(db.name)
  old.version(3).stores({ visits: 'visit.id, visit.visited_at', drafts: 'key' })
  const visit = { ...exampleVisit(), intercurrence_details: 'Relato antigo único.' }
  const conflict = { visit, soap_text: 'Remoto revisado', revision: 3 }
  await old.table('visits').put({ visit, soap_text: 'Local revisado', revision: 2, pending: true, localVersion: 7, conflict })
  await old.table('drafts').put({ key: 'active', visit, soap: 'Rascunho revisado', baseRevision: 2, source: 'legacy' })
  old.close()
  await db.open()
  const saved = (await db.visits.get(visit.id))!
  expect(saved.visit.intercurrence_details).toEqual({ 'Internação hospitalar': 'Relato antigo único.' })
  expect(saved.conflict!.visit.intercurrence_details).toEqual(saved.visit.intercurrence_details)
  expect(saved.soap_text).toBe('Local revisado')
  expect(saved.pending).toBe(true)
  expect(saved.localVersion).toBe(7)
  expect((await db.drafts.get('active'))!.soap).toBe('Rascunho revisado')
  await db.visits.clear(); await db.drafts.clear()
})

it('inclui nome de enfermagem e condição especificada na evolução offline', () => {
  const v = exampleVisit()
  v.companions = { has_nurse: true, nurse_name: 'Ana', has_acs: false, acs_name: null, has_student: false, student_name: null, is_solo: false }
  v.conditions = ['Outra']; v.other_condition = 'Doença de Parkinson'
  const output = localSoapOutput(v)
  expect(output.subjective_text).toContain('enfermeiro(a)/técnico(a) Ana')
  expect(output.subjective_text).toContain('Em acompanhamento por Doença de Parkinson')
  v.companions.has_nurse = false
  expect(clinicalRuleError(v)).toContain('acompanhante')
  v.companions.nurse_name = null; v.conditions = ['Hipertenso']
  expect(clinicalRuleError(v)).toContain('Outra')
})

it('migra IndexedDB v4 sem inventar sexo ou alterar a evolução revisada', async () => {
  await db.delete()
  const old = new Dexie(db.name)
  old.version(4).stores({ visits: 'visit.id, visit.visited_at', drafts: 'key' })
  const visit = { ...exampleVisit(), sex: 'Outro' }
  await old.table('drafts').put({ key: 'active', visit, soap: 'Texto revisado', baseRevision: 0, source: 'legacy' })
  old.close(); await db.open()
  const draft = (await db.drafts.get('active'))!
  expect(draft.visit.sex).toBeNull()
  expect(draft.visit.companions.nurse_name).toBeNull()
  expect(draft.visit.other_condition).toBe('')
  expect(draft.soap).toBe('Texto revisado')
  await db.drafts.clear()
})
