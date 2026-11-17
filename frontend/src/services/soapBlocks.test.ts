import 'fake-indexeddb/auto'
import { afterEach, expect, it } from 'vitest'
import { exampleVisit, emptyVisit, upgradeVisit } from '../types/visit'
import { localSoapOutput, restoreSoap, withSoapEdits } from './soap'
import { db, saveLocal, applySync } from './offlineDb'

afterEach(async () => { await db.visits.clear(); await db.drafts.clear() })

it('separa medidas, exame físico, história e plano e omite A vazio', () => {
  const output = localSoapOutput(exampleVisit())
  expect(output.vitals_formatted).toEqual({ PAS: '150', PAD: '90', SatO2: '97%', FC: '76', FR: '18', Tax: '36,5 °C', HGT: '145' })
  expect(output.objective_text).toContain('PA 150/90 mmHg')
  expect(output.objective_text).toContain('Mini-Mental (MEEM) 24/30')
  expect(output.subjective_text).toContain('Internada por pneumonia por cinco dias')
  expect(output.subjective_text).toContain('utilizou Ceftriaxona')
  expect(output.subjective_text).not.toContain('Adesão medicamentosa:')
  expect(output.plan_text).toContain('Retorno VD em 30 dias')
  expect(output.assessment_text).toBeNull()
  expect(output.full_text_fallback).not.toContain('\nA:')
})

it('o texto completo reflete as edições de cada campo sem perder medidas', () => {
  const output = withSoapEdits(localSoapOutput(exampleVisit()), { subjective_text: 'História revisada.', objective_text: 'Exame revisado.', plan_text: 'Retorno combinado.', assessment_text: 'Observação clínica.' })
  expect(output.full_text_fallback).toContain('S: História revisada.')
  expect(output.full_text_fallback).toContain('PAS 150 mmHg')
  expect(output.full_text_fallback).toContain('Exame revisado.')
  expect(output.full_text_fallback).toContain('P: Retorno combinado.')
  expect(withSoapEdits(output, { assessment_text: null }).full_text_fallback).not.toContain('\nA:')
})

it('mantém os blocos editados no histórico, rascunho e retorno da sincronização', async () => {
  const visit = exampleVisit()
  const output = withSoapEdits(localSoapOutput(visit), { plan_text: 'Plano editado pelo médico.' })
  await db.drafts.put({ key: 'active', visit, soap: output.full_text_fallback, soap_blocks: output, baseRevision: 0, source: 'local' })
  const draft = (await db.drafts.get('active'))!
  expect(restoreSoap(draft.visit, draft.soap, draft.soap_blocks).plan_text).toBe('Plano editado pelo médico.')
  await saveLocal(visit, output.full_text_fallback, 0, output)
  const sent = (await db.visits.get(visit.id))!
  await applySync(sent, { visit, soap_text: sent.soap_text, soap_blocks: output, revision: 1 })
  const saved = (await db.visits.get(visit.id))!
  expect(saved.soap_blocks).toEqual(output)
  expect(saved.pending).toBe(false)
})

it('abre SOAP legado preservando a cópia integral original e separa vitais conhecidos do O', () => {
  const visit = exampleVisit()
  const original = 'S: História editada antiga.\nO: PA 150/90 mmHg; FC 76 bpm; ACV: sem alterações.\nA: Avaliação revisada.\nP: Conduta antiga.'
  const output = restoreSoap(visit, original)
  expect(output.full_text_fallback).toBe(original)
  expect(output.subjective_text).toBe('História editada antiga.')
  expect(output.objective_text).toBe('ACV: sem alterações.')
  expect(output.assessment_text).toBe('Avaliação revisada.')
})

it('não gera resultados neurológicos ou normalidade a partir de campos vazios', () => {
  const output = localSoapOutput(emptyVisit())
  expect(output.objective_text).toBe('Exame físico não registrado.')
  expect(output.vitals_formatted).toEqual({})
  expect(output.assessment_text).toBeNull()
  expect(output.full_text_fallback).not.toContain('estável')
})

it('não substitui medidas corrigidas manualmente em uma evolução legada', () => {
  const visit = exampleVisit() // dado estruturado original: 130/80
  const original = 'S: Relato.\nO: PA 160/90 mmHg; Exame revisado.\nP: Conduta.'
  const output = restoreSoap(visit, original)
  expect(output.vitals_formatted).toEqual({})
  expect(output.objective_text).toContain('PA 160/90 mmHg')
  const edited = withSoapEdits(output, { plan_text: 'Plano revisado.' })
  expect(edited.full_text_fallback).toContain('PA 160/90 mmHg')
  expect(edited.full_text_fallback).not.toContain('130')
})

it('migra o relato antigo de intercorrência para perto dos chips sem perder texto', () => {
  const current = exampleVisit()
  const { intercurrence_details, vitals_context, ...old } = current
  const legacy = { ...old, subjective_notes: 'Relato antigo digitado pelo médico.' }
  const upgraded = upgradeVisit(legacy as typeof current)
  expect(upgraded.intercurrence_details).toEqual({ 'Internação hospitalar': 'Relato antigo digitado pelo médico.' })
  expect(upgraded.subjective_notes).toBe('')
})
