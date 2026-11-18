import 'fake-indexeddb/auto'
import { afterEach, expect, it } from 'vitest'
import { exampleVisit, emptyVisit, upgradeVisit } from '../types/visit'
import { localSoapOutput, restoreSoap, updateSoapVitals, withSoapEdits } from './soap'
import { validateVitals } from '../types/vitals'
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

it('corrige medidas na revisão e atualiza os alertas sem perder texto revisado ou alertas de outros exames', async () => {
  const visit = exampleVisit()
  visit.lab_results = { ldl: 145 }
  const generated = localSoapOutput(visit)
  const reviewed = withSoapEdits(generated, {
    subjective_text: 'História revisada.',
    objective_text: 'Observação do médico. ' + generated.objective_text,
    plan_text: generated.plan_text + '\n- Conduta revisada pelo médico.',
    assessment_text: 'Avaliação revisada.',
  })
  const next = updateSoapVitals(visit, reviewed, { ...visit.vitals, systolic: 125, diastolic: 78, temperature: null })
  expect(next.needsReview).toBe(false)
  expect(next.result.subjective_text).toBe('História revisada.')
  expect(next.result.assessment_text).toBe('Avaliação revisada.')
  expect(next.result.objective_text).toContain('Observação do médico.')
  expect(next.result.objective_text).toContain('LDL 145 mg/dL')
  expect(next.result.objective_text).not.toContain('150/90')
  expect(next.result.plan_text).toContain('Conduta revisada pelo médico.')
  expect(next.result.plan_text).toContain('risco cardiovascular')
  expect(next.result.plan_text).not.toContain('curva pressórica')
  expect(next.result.full_text_fallback).toContain('PAS 125 mmHg, PAD 78 mmHg')
  expect(next.result.full_text_fallback).not.toContain('Tax 36,5')
  await saveLocal(next.visit, next.result.full_text_fallback, 0, next.result)
  expect(await db.visits.get(visit.id)).toMatchObject({ visit: { vitals: { systolic: 125 } }, soap_blocks: next.result })
})

it('sinaliza revisão de menções manuais e permite corrigir novamente os alertas acrescentados', () => {
  const visit = exampleVisit()
  const result = withSoapEdits(localSoapOutput(visit), { objective_text: 'PA de 150/90 no relato.', plan_text: 'Conduta manual.' })
  const first = updateSoapVitals(visit, result, { ...visit.vitals, systolic: 190 })
  expect(first.needsReview).toBe(true)
  expect(first.result.objective_text).toContain(result.objective_text)
  expect(first.result.objective_text).toContain('PA 190/90')
  expect(first.result.plan_text).toContain('Conduta manual.')
  const second = updateSoapVitals(first.visit, first.result, { ...visit.vitals, systolic: 125, diastolic: 78 })
  expect(second.result.objective_text).toBe(result.objective_text)
  expect(second.result.plan_text).toBe('Conduta manual.')
  expect(validateVitals({ ...visit.vitals, diastolic: null })).toContain('dois valores')
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
