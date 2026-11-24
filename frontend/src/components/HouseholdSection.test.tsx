// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import HouseholdSection from './HouseholdSection'
import { emptyHousehold, type Household } from '../types/visit'
afterEach(() => { cleanup(); vi.restoreAllMocks() })
function Editor({ initial = emptyHousehold() }: { initial?: Household }) {
  const [value, setValue] = useState(initial)
  return <><HouseholdSection value={value} onChange={setValue}/><output data-testid="value">{JSON.stringify(value)}</output></>
}
const result = () => JSON.parse(screen.getByTestId('value').textContent!)
it('permite selecionar vínculo e ajustar quantidade pelas setas sem exigir dados pessoais', () => {
  render(<Editor/> )
  fireEvent.change(screen.getByLabelText('Com quem o paciente mora?'), { target: { value: 'with_others' } })
  fireEvent.click(screen.getByText('Adicionar vínculo'))
  fireEvent.change(screen.getByLabelText('Vínculo 1'), { target: { value: 'child' } })
  fireEvent.click(screen.getByLabelText('Aumentar quantidade do vínculo 1'))
  expect(result().residents[0]).toMatchObject({ relationship: 'child', count: 2, members: [] })
  fireEvent.click(screen.getByLabelText('Diminuir quantidade do vínculo 1'))
  expect(result().residents[0].count).toBe(1)
  expect((screen.getByLabelText('Diminuir quantidade do vínculo 1') as HTMLButtonElement).disabled).toBe(true)
})
it('protege dados ao reduzir quantidade, e não vincula cuidador à moradia', () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<Editor initial={{ ...emptyHousehold(), living_arrangement: 'with_others', caregiver_status: 'yes', caregiver_relationship: 'filha', residents: [{ id: crypto.randomUUID(), relationship: 'child', count: 2, other_relationship: '', members: [{ name: '', phone: '' }, { name: 'Pessoa fictícia', phone: '11999990000' }] }] }}/> )
  fireEvent.click(screen.getByLabelText('Diminuir quantidade do vínculo 1'))
  expect(confirm).toHaveBeenCalled(); expect(result().residents[0].count).toBe(2)
  confirm.mockReturnValue(true)
  fireEvent.change(screen.getByLabelText('Com quem o paciente mora?'), { target: { value: 'alone' } })
  expect(result()).toMatchObject({ living_arrangement: 'alone', residents: [], caregiver_status: 'yes', caregiver_relationship: 'filha' })
})
it('identifica pessoas sob demanda e preserva o relato de versões anteriores', () => {
  render(<Editor initial={{ ...emptyHousehold(), living_arrangement: 'with_others', cohabitants: 'filha e neto' }}/> )
  expect((screen.getByLabelText('Relato complementar sobre os moradores') as HTMLTextAreaElement).value).toBe('filha e neto')
  fireEvent.click(screen.getByText('Adicionar vínculo'))
  fireEvent.change(screen.getByLabelText('Vínculo 1'), { target: { value: 'child' } })
  fireEvent.click(screen.getByRole('button', { name: /Identificar pessoas ou contato/ }))
  fireEvent.change(screen.getByLabelText('Nome completo (opcional)'), { target: { value: 'Pessoa Fictícia' } })
  fireEvent.change(screen.getByLabelText('Celular ou telefone com DDD (opcional)'), { target: { value: '(11) 99999-0000' } })
  expect(result().residents[0].members[0]).toEqual({ name: 'Pessoa Fictícia', phone: '11999990000' })
  expect(result().cohabitants).toBe('filha e neto')
})
