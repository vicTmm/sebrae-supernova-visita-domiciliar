import { expect, it } from 'vitest'
import { emptyHousehold, exampleVisit, upgradeVisit } from '../types/visit'
import { clinicalRuleError, localSoapOutput } from './soap'
it('preserva moradia e cuidador independente no Subjetivo', () => {
  const v = exampleVisit()
  v.household = { ...emptyHousehold(), living_arrangement: 'alone', caregiver_status: 'yes', caregiver_name: 'M.', caregiver_relationship: 'filha', caregiver_notes: 'Visita diariamente; não reside no domicílio' }
  const s = localSoapOutput(v).subjective_text
  expect(s).toContain('Relata morar sozinho(a)')
  expect(s).toContain('Cuidador de referência: M. (vínculo: filha)')
  expect(s).toContain('Visita diariamente; não reside no domicílio')
  expect(s).not.toContain('não possuir cuidador')
})
it('não inventa rede de apoio em visitas novas ou antigas', () => {
  const v = exampleVisit(); delete v.household
  const before = localSoapOutput(v)
  expect(localSoapOutput(upgradeVisit(v))).toEqual(before)
  v.household = emptyHousehold()
  expect(localSoapOutput(v)).toEqual(before)
})
it('inclui moradores e ausência de cuidador apenas quando declarados', () => {
  const v = exampleVisit(); v.household = { ...emptyHousehold(), living_arrangement: 'with_others', cohabitants: 'filha e dois netos', caregiver_status: 'no' }
  expect(localSoapOutput(v).subjective_text).toContain('Reside com filha e dois netos')
  expect(localSoapOutput(v).subjective_text).toContain('Relata não possuir cuidador de referência')
  v.household.caregiver_name = 'M.'
  expect(clinicalRuleError(v)).toContain('presença de cuidador')
})
it('narra vínculos e quantidades sem expor nome completo ou telefone dos moradores', () => {
  const v = exampleVisit()
  v.household = { ...emptyHousehold(), living_arrangement: 'with_others', residents: [{ id: crypto.randomUUID(), relationship: 'child', count: 2, other_relationship: '', members: [{ name: 'Pessoa fictícia', phone: '11999990000' }] }] }
  const text = localSoapOutput(v).full_text_fallback
  expect(text).toContain('Reside com 2 filhos(as)')
  expect(text).not.toContain('Pessoa fictícia'); expect(text).not.toContain('11999990000')
  v.household.residents![0].members[0].phone = '123'
  expect(clinicalRuleError(v)).toContain('telefone com DDD')
})
